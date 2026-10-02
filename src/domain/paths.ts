import { getPart } from './parts'
import { isAiNode, type Graph, type GraphNode } from './graph'

export const MAX_DEPTH = 12
export const MAX_PATHS = 500

export interface RiskPath {
  /** 입력 노드 → … → 출구 노드 순서 */
  nodeIds: string[]
  /** 같은 입력·출구를 잇는 다른(더 긴) 경로들 */
  alternatives: string[][]
}

/** 위험한 입력의 출발점: 믿을 수 없는 입력 또는 센서 입력 속성을 가진 노드 */
export function isEntry(node: GraphNode): boolean {
  return node.attributes.includes('input.untrusted') || node.attributes.includes('input.sensor')
}

/** 출구: 회사 밖 수신자, 설비, 또는 더 이어지는 곳이 없는 도구 */
export function isExit(node: GraphNode, graph: Graph): boolean {
  const kind = getPart(node.partId)?.kind
  if (kind === 'external' || kind === 'equipment') return true
  return kind === 'tool' && !graph.edges.some((e) => e.from === node.id)
}

/**
 * 간선 방향(데이터·명령이 흐르는 방향)을 따라 입력→AI→출구 경로를 찾는다.
 * 같은 노드를 두 번 지나지 않으므로 순환이 있어도 끝난다.
 * 입력·출구가 같은 쌍은 가장 짧은 경로 하나로 합치고 나머지는 alternatives에 담는다.
 */
export function findPaths(graph: Graph): RiskPath[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const out = new Map<string, string[]>()
  for (const e of graph.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue
    out.set(e.from, [...(out.get(e.from) ?? []), e.to])
  }
  const found: string[][] = []

  const walk = (trail: string[], hasAi: boolean) => {
    if (found.length >= MAX_PATHS) return
    const cur = byId.get(trail[trail.length - 1])!
    if (trail.length > 1 && hasAi && isExit(cur, graph)) found.push([...trail])
    if (trail.length >= MAX_DEPTH) return
    for (const next of [...(out.get(cur.id) ?? [])].sort()) {
      if (trail.includes(next)) continue
      const n = byId.get(next)!
      walk([...trail, next], hasAi || isAiNode(n))
    }
  }

  for (const start of graph.nodes.filter(isEntry).sort((a, b) => a.id.localeCompare(b.id))) walk([start.id], isAiNode(start))

  const groups = new Map<string, string[][]>()
  for (const p of found) {
    const key = `${p[0]}>${p[p.length - 1]}`
    groups.set(key, [...(groups.get(key) ?? []), p])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, list]) => {
      const sorted = [...list].sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()))
      return { nodeIds: sorted[0], alternatives: sorted.slice(1) }
    })
}

/** 경로를 이루는 간선 id들 (캔버스에서 빨갛게 칠할 대상) */
export function pathEdgeIds(graph: Graph, nodeIds: readonly string[]): string[] {
  const ids: string[] = []
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const e = graph.edges.find((x) => x.from === nodeIds[i] && x.to === nodeIds[i + 1])
    if (e) ids.push(e.id)
  }
  return ids
}
