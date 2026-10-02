import { isAttributeId } from '../domain/attributes'
import { getPart } from '../domain/parts'
import type { EditorGraph } from '../editor/model'

export const FORMAT_VERSION = 1
export const MAX_NODES = 60
export const MAX_EDGES = 200
export const MAX_TEXT = 200_000

export interface Saved {
  graph: EditorGraph
  applied: string[]
}
export type ParseResult = ({ ok: true } & Saved) | { ok: false; error: string }

interface FileShape {
  version: number
  nodes: { id: string; part: string; attributes: string[]; x: number; y: number }[]
  edges: { id: string; from: string; to: string }[]
  applied: string[]
}

export function serialize(graph: EditorGraph, applied: ReadonlySet<string>, pretty = false): string {
  const data: FileShape = {
    version: FORMAT_VERSION,
    nodes: graph.nodes.map((n) => ({ id: n.id, part: n.partId, attributes: [...n.attributes], x: n.x, y: n.y })),
    edges: graph.edges.map((e) => ({ id: e.id, from: e.from, to: e.to })),
    applied: [...applied].sort(),
  }
  return JSON.stringify(data, null, pretty ? 2 : undefined)
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64
const fail = (error: string): ParseResult => ({ ok: false, error })

/** 파일·링크·자동 저장에서 읽은 글자를 검사해 구조로 바꾼다. 어긋난 곳이 있으면 한국어 이유를 돌려준다. */
export function parseSaved(text: string): ParseResult {
  if (text.length > MAX_TEXT) return fail('내용이 너무 큽니다.')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return fail('JSON 형식이 아닙니다.')
  }
  if (!isObj(raw)) return fail('최상위가 객체가 아닙니다.')
  if (raw.version !== FORMAT_VERSION) return fail(`지원하지 않는 버전입니다 (version: ${String(raw.version)}).`)
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return fail('nodes와 edges가 배열이어야 합니다.')
  if (raw.nodes.length > MAX_NODES) return fail(`부품이 너무 많습니다 (최대 ${MAX_NODES}개).`)
  if (raw.edges.length > MAX_EDGES) return fail(`연결이 너무 많습니다 (최대 ${MAX_EDGES}개).`)

  const ids = new Set<string>()
  const nodes: EditorGraph['nodes'] = []
  for (const [i, n] of raw.nodes.entries()) {
    const where = `${i + 1}번째 부품`
    if (!isObj(n) || !isStr(n.id) || !isStr(n.part)) return fail(`${where}: id 또는 part가 올바르지 않습니다.`)
    if (ids.has(n.id)) return fail(`${where}: id "${n.id}"가 중복됩니다.`)
    if (!getPart(n.part)) return fail(`${where}: 알 수 없는 부품 "${n.part}"입니다.`)
    if (!Array.isArray(n.attributes) || !n.attributes.every((a): a is string => typeof a === 'string')) return fail(`${where}: attributes가 문자열 배열이어야 합니다.`)
    const bad = n.attributes.find((a) => !isAttributeId(a))
    if (bad) return fail(`${where}: 알 수 없는 속성 "${bad}"입니다.`)
    if (typeof n.x !== 'number' || typeof n.y !== 'number' || !Number.isFinite(n.x) || !Number.isFinite(n.y)) return fail(`${where}: 위치(x, y)가 숫자가 아닙니다.`)
    ids.add(n.id)
    nodes.push({ id: n.id, partId: n.part, attributes: [...new Set(n.attributes)].filter(isAttributeId), x: n.x, y: n.y })
  }

  const edgeIds = new Set<string>()
  const pairs = new Set<string>()
  const edges: EditorGraph['edges'] = []
  for (const [i, e] of raw.edges.entries()) {
    const where = `${i + 1}번째 연결`
    if (!isObj(e) || !isStr(e.id) || !isStr(e.from) || !isStr(e.to)) return fail(`${where}: id, from, to가 올바르지 않습니다.`)
    if (edgeIds.has(e.id)) return fail(`${where}: id "${e.id}"가 중복됩니다.`)
    if (!ids.has(e.from) || !ids.has(e.to)) return fail(`${where}: 없는 부품을 가리킵니다.`)
    if (e.from === e.to) return fail(`${where}: 같은 부품끼리는 이을 수 없습니다.`)
    if (pairs.has(`${e.from}>${e.to}`)) return fail(`${where}: 같은 방향 연결이 중복됩니다.`)
    edgeIds.add(e.id)
    pairs.add(`${e.from}>${e.to}`)
    edges.push({ id: e.id, from: e.from, to: e.to })
  }

  const appliedRaw = raw.applied ?? []
  if (!Array.isArray(appliedRaw) || !appliedRaw.every((k): k is string => typeof k === 'string')) return fail('applied가 문자열 배열이어야 합니다.')
  const applied = appliedRaw.filter((k) => ids.has(k.split('|')[0]))
  return { ok: true, graph: { nodes, edges }, applied }
}

// ---- 공유 링크 ---------------------------------------------------------------

export const SHARE_PREFIX = '#/s/'

const toB64Url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64Url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/'))

export function shareHash(graph: EditorGraph, applied: ReadonlySet<string>): string {
  return SHARE_PREFIX + toB64Url(serialize(graph, applied))
}

export function parseShareHash(hash: string): ParseResult | null {
  if (!hash.startsWith(SHARE_PREFIX)) return null
  try {
    return parseSaved(fromB64Url(hash.slice(SHARE_PREFIX.length)))
  } catch {
    return fail('링크가 깨졌습니다 (복사하다 잘렸을 수 있습니다).')
  }
}
