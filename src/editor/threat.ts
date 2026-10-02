import type { Analysis } from '../domain/analyze'
import type { Finding } from '../domain/engine'
import type { Graph } from '../domain/graph'
import { pathEdgeIds } from '../domain/paths'

export const findingKey = (f: Pick<Finding, 'nodeId' | 'ruleId'>) => `${f.nodeId}|${f.ruleId}`

/**
 * 캔버스에서 빨갛게 칠할 간선.
 * 카드를 펼쳤으면 그 위협이 걸린 경로만, 아니면 위험 경로 전체.
 */
export function highlightEdges(graph: Graph, analysis: Analysis, active: Finding | null): Set<string> {
  const paths = active
    ? analysis.paths.filter((p) => p.nodeIds.includes(active.nodeId) && p.ruleIds.includes(active.ruleId))
    : analysis.paths
  return new Set(paths.flatMap((p) => pathEdgeIds(graph, p.nodeIds)))
}

/** 지워진 노드에 걸린 대응 체크는 버린다 (남아 있으면 같은 id가 재사용될 때 엉뚱하게 적용됨) */
export function pruneApplied(applied: ReadonlySet<string>, graph: Graph): ReadonlySet<string> {
  const ids = new Set(graph.nodes.map((n) => n.id))
  const kept = [...applied].filter((k) => ids.has(k.split('|')[0]))
  return kept.length === applied.size ? applied : new Set(kept)
}
