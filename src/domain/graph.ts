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
