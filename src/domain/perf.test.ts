import { expect, test } from 'vitest'
import { RULES } from '../data'
import { analyze } from './analyze'
import type { Graph } from './graph'
import { getPart } from './parts'
import { scoreGraph } from './score'

const IDS = ['web_page', 'upload_doc', 'ai_agent', 'doc_store', 'mail_tool', 'external_party', 'code_exec', 'sensor', 'control_api', 'plc']

function chain(n: number): Graph {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}`, partId: IDS[i % IDS.length], attributes: [...getPart(IDS[i % IDS.length])!.defaults] }))
  const edges: Graph['edges'] = []
  for (let i = 0; i < n; i++) {
    edges.push({ id: `a${i}`, from: `n${i}`, to: `n${(i + 1) % n}` })
    edges.push({ id: `b${i}`, from: `n${i}`, to: `n${(i + 3) % n}` })
  }
  return { nodes, edges }
}

test('성능: 부품 100개·연결 200개 구조의 분석과 점수 계산이 1초 안에 끝난다', () => {
  const g = chain(100)
  const t = performance.now()
  const a = analyze(g, RULES)
  const s = scoreGraph(g, RULES)
  const ms = performance.now() - t
  console.log(`perf100: ${ms.toFixed(0)}ms findings=${a.findings.length} score=${s.overall}`)
  expect(ms).toBeLessThan(1000)
})

test('성능: 경로가 폭증하는 촘촘한 구조(입력 30·AI 10·도구 30·수신자 30)도 1초 안에 끝난다', () => {
  const mk = (prefix: string, partId: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, partId, attributes: [...getPart(partId)!.defaults] }))
  const ins = mk('i', 'web_page', 30)
  const ais = mk('a', 'ai_agent', 10)
  const tools = mk('t', 'mail_tool', 30)
  const outs = mk('o', 'external_party', 30)
  const edges: Graph['edges'] = []
  let k = 0
  for (const i of ins) for (const a of ais) edges.push({ id: `e${k++}`, from: i.id, to: a.id })
  for (const a of ais) for (const t of tools) edges.push({ id: `e${k++}`, from: a.id, to: t.id })
  for (const t of tools) for (const o of outs) edges.push({ id: `e${k++}`, from: t.id, to: o.id })
  for (const a of ais) for (const b of ais) if (a !== b) edges.push({ id: `e${k++}`, from: a.id, to: b.id })
  const g: Graph = { nodes: [...ins, ...ais, ...tools, ...outs], edges }
  const t0 = performance.now()
  const a = analyze(g, RULES)
  const s = scoreGraph(g, RULES)
  const ms = performance.now() - t0
  console.log(`perfDense: nodes=${g.nodes.length} edges=${g.edges.length} ${ms.toFixed(0)}ms findings=${a.findings.length} score=${s.overall}`)
  expect(ms).toBeLessThan(1000)
})
