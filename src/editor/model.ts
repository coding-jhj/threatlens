import type { GraphEdge, GraphNode } from '../domain/graph'
import { getPart } from '../domain/parts'

export interface EditorNode extends GraphNode {
  x: number
  y: number
}

export interface EditorGraph {
  nodes: EditorNode[]
  edges: GraphEdge[]
}

export interface EditorState {
  graph: EditorGraph
  past: EditorGraph[]
  future: EditorGraph[]
  seq: number
}

export const HISTORY_LIMIT = 100
export const EMPTY_STATE: EditorState = { graph: { nodes: [], edges: [] }, past: [], future: [], seq: 1 }

export type Action =
  | { type: 'addNode'; partId: string; x: number; y: number }
  | { type: 'moveNodes'; positions: Record<string, { x: number; y: number }> }
  | { type: 'connect'; from: string; to: string }
  | { type: 'remove'; nodeIds: string[]; edgeIds: string[] }
  | { type: 'setAttributes'; nodeId: string; attributes: GraphNode['attributes'] }
  | { type: 'autoLayout' }
  | { type: 'load'; graph: EditorGraph }
  | { type: 'undo' }
  | { type: 'redo' }

function commit(state: EditorState, graph: EditorGraph, seq = state.seq): EditorState {
  return { graph, past: [...state.past, state.graph].slice(-HISTORY_LIMIT), future: [], seq }
}

export function reducer(state: EditorState, action: Action): EditorState {
  const { graph } = state
  switch (action.type) {
    case 'addNode': {
      const part = getPart(action.partId)
      if (!part) return state
      const node: EditorNode = { id: `n${state.seq}`, partId: part.id, attributes: [...part.defaults], x: action.x, y: action.y }
      return commit(state, { ...graph, nodes: [...graph.nodes, node] }, state.seq + 1)
    }
    case 'moveNodes': {
      const ids = Object.keys(action.positions)
      const changed = graph.nodes.some((n) => action.positions[n.id] && (action.positions[n.id].x !== n.x || action.positions[n.id].y !== n.y))
      if (ids.length === 0 || !changed) return state
      return commit(state, { ...graph, nodes: graph.nodes.map((n) => (action.positions[n.id] ? { ...n, ...action.positions[n.id] } : n)) })
    }
    case 'connect': {
      const { from, to } = action
      const exists = (id: string) => graph.nodes.some((n) => n.id === id)
      if (from === to || !exists(from) || !exists(to)) return state
      if (graph.edges.some((e) => e.from === from && e.to === to)) return state
      return commit(state, { ...graph, edges: [...graph.edges, { id: `e${state.seq}`, from, to }] }, state.seq + 1)
    }
    case 'remove': {
      const goneNodes = new Set(action.nodeIds)
      const goneEdges = new Set(action.edgeIds)
      const nodes = graph.nodes.filter((n) => !goneNodes.has(n.id))
      const edges = graph.edges.filter((e) => !goneEdges.has(e.id) && !goneNodes.has(e.from) && !goneNodes.has(e.to))
      if (nodes.length === graph.nodes.length && edges.length === graph.edges.length) return state
      return commit(state, { nodes, edges }) // 노드와 딸린 간선을 한 번에 지워 되돌리기 한 번으로 복원된다
    }
    case 'setAttributes': {
      const target = graph.nodes.find((n) => n.id === action.nodeId)
      if (!target) return state
      const same = target.attributes.length === action.attributes.length && target.attributes.every((a) => action.attributes.includes(a))
      if (same) return state
      return commit(state, { ...graph, nodes: graph.nodes.map((n) => (n.id === action.nodeId ? { ...n, attributes: [...action.attributes] } : n)) })
    }
    case 'autoLayout': {
      const placed = autoLayout(graph)
      return commit(state, placed)
    }
    case 'load': {
      const maxId = Math.max(0, ...action.graph.nodes.map((n) => Number(n.id.replace(/\D/g, '')) || 0), ...action.graph.edges.map((e) => Number(e.id.replace(/\D/g, '')) || 0))
      return { graph: action.graph, past: [], future: [], seq: maxId + 1 }
    }
    case 'undo': {
      if (state.past.length === 0) return state
      const prev = state.past[state.past.length - 1]
      return { ...state, graph: prev, past: state.past.slice(0, -1), future: [graph, ...state.future] }
    }
    case 'redo': {
      if (state.future.length === 0) return state
      const [next, ...rest] = state.future
      return { ...state, graph: next, past: [...state.past, graph], future: rest }
    }
  }
}

export const LAYOUT = { colWidth: 260, rowHeight: 130, originX: 40, originY: 60 }

/**
 * 왼쪽→오른쪽 층별 배치. 층 = 들어오는 간선 기준 가장 긴 경로 길이 (순환은 무시).
 * 같은 층 안에서는 기존 y 순서를 유지해 사용자가 만든 위아래 배치를 보존한다.
 */
export function autoLayout(graph: EditorGraph): EditorGraph {
  const level = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]))
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    let changed = false
    for (const e of graph.edges) {
      const lf = level.get(e.from)
      const lt = level.get(e.to)
      if (lf === undefined || lt === undefined) continue
      if (lt < lf + 1 && lf + 1 <= graph.nodes.length - 1) {
        level.set(e.to, lf + 1)
        changed = true
      }
    }
    if (!changed) break
  }
  const columns = new Map<number, EditorNode[]>()
  for (const n of graph.nodes) columns.set(level.get(n.id)!, [...(columns.get(level.get(n.id)!) ?? []), n])
  const pos = new Map<string, { x: number; y: number }>()
  for (const [lv, list] of columns) {
    list
      .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id))
      .forEach((n, i) => pos.set(n.id, { x: LAYOUT.originX + lv * LAYOUT.colWidth, y: LAYOUT.originY + i * LAYOUT.rowHeight }))
  }
  return { ...graph, nodes: graph.nodes.map((n) => ({ ...n, ...pos.get(n.id)! })) }
}
