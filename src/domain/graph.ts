import type { AttributeId } from './attributes'
import { getPart } from './parts'

export interface GraphNode {
  id: string
  partId: string
  attributes: AttributeId[]
}

export interface GraphEdge {
  id: string
  from: string
  to: string
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export const EMPTY_GRAPH: Graph = { nodes: [], edges: [] }

export function isAiNode(node: GraphNode): boolean {
  return getPart(node.partId)?.kind === 'ai'
}

export function neighborIds(graph: Graph, nodeId: string): string[] {
  const ids = new Set<string>()
  for (const e of graph.edges) {
    if (e.from === nodeId) ids.add(e.to)
    if (e.to === nodeId) ids.add(e.from)
  }
  ids.delete(nodeId)
  return [...ids]
}

/**
 * nodeId에서 간선을 타고(방향 무시) 도달할 수 있는 모든 노드를 너비 우선 탐색으로 찾는다.
 * 중간에 속성 없는 "통로" 부품(게이트웨이·히스토리안 등)이 끼어도 끊기지 않는다 — 이 점이
 * neighborIds(1-hop만 봄)와의 차이다. nodeId 자신은 결과에 포함하지 않는다.
 *
 * stopAt(id)가 true인 노드는 결과에는 포함하되 그 너머로는 탐색하지 않는다. 다른 AI 노드에서
 * 멈추도록 쓰면(engine.ts), 한 AI가 "다른 AI 노드까지는 닿지만 그 AI의 또 다른 도구까지는
 * 떠안지 않는다"는 경계를 지킬 수 있다 — 안 그러면 같은 그래프에 여러 AI를 그렸을 때 서로
 * 무관한 위험이 섞여 붙는다.
 */
export function reachableIds(graph: Graph, nodeId: string, stopAt: (id: string) => boolean = () => false): string[] {
  const adjacency = new Map<string, Set<string>>()
  for (const e of graph.edges) {
    if (!adjacency.has(e.from)) adjacency.set(e.from, new Set())
    if (!adjacency.has(e.to)) adjacency.set(e.to, new Set())
    adjacency.get(e.from)!.add(e.to)
    adjacency.get(e.to)!.add(e.from)
  }
  const visited = new Set<string>([nodeId])
  const queue: string[] = [nodeId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur !== nodeId && stopAt(cur)) continue
    for (const next of adjacency.get(cur) ?? []) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  visited.delete(nodeId)
  return [...visited]
}
