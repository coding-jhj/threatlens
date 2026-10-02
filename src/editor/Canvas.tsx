import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useState, type DragEvent, type KeyboardEvent } from 'react'
import { Button } from '../ui/components'
import type { Action, EditorState } from './model'
import { DRAG_MIME } from './Palette'
import { PartNode, type PartFlowNode } from './PartNode'
import './editor.css'

const nodeTypes = { part: PartNode }

const toFlowNodes = (state: EditorState, prev: PartFlowNode[]): PartFlowNode[] =>
  state.graph.nodes.map((n) => ({
    id: n.id,
    type: 'part',
    position: { x: n.x, y: n.y },
    data: { partId: n.partId, attributes: n.attributes },
    selected: prev.find((p) => p.id === n.id)?.selected ?? false,
  }))

const toFlowEdges = (state: EditorState, prev: Edge[]): Edge[] =>
  state.graph.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    selected: prev.find((p) => p.id === e.id)?.selected ?? false,
  }))

export function Canvas({ state, dispatch, onSelect }: { state: EditorState; dispatch: (a: Action) => void; onSelect?: (nodeId: string | null) => void }) {
  const { screenToFlowPosition, fitView } = useReactFlow()
  const [nodes, setNodes] = useState<PartFlowNode[]>(() => toFlowNodes(state, []))
  const [edges, setEdges] = useState<Edge[]>(() => toFlowEdges(state, []))
  const [layoutTick, setLayoutTick] = useState(0)

  // 편집 상태가 바뀌면 렌더 중에 React Flow용 노드·간선을 다시 만든다 (선택 상태는 유지)
  const [seenNodes, setSeenNodes] = useState(state.graph.nodes)
  const [seenEdges, setSeenEdges] = useState(state.graph.edges)
  if (seenNodes !== state.graph.nodes) {
    setSeenNodes(state.graph.nodes)
    setNodes(toFlowNodes(state, nodes))
  }
  if (seenEdges !== state.graph.edges) {
    setSeenEdges(state.graph.edges)
    setEdges(toFlowEdges(state, edges))
  }
  useEffect(() => {
    if (layoutTick > 0) void fitView({ duration: 250, padding: 0.2 })
  }, [layoutTick, fitView])

  const onNodesChange = useCallback(
    (changes: NodeChange<PartFlowNode>[]) => {
      setNodes((prev) => applyNodeChanges(changes, prev))
      if (changes.some((c) => c.type === 'select')) {
        // 선택 상태는 다음 렌더에서 nodes에 반영되므로 변경 목록으로 직접 계산한다
        const selectedNow = changes.filter((c): c is Extract<NodeChange<PartFlowNode>, { type: 'select' }> => c.type === 'select' && c.selected)
        onSelect?.(selectedNow.length > 0 ? selectedNow[selectedNow.length - 1].id : null)
      }
    },
    [onSelect],
  )
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((prev) => applyEdgeChanges(changes, prev)), [])

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const partId = e.dataTransfer.getData(DRAG_MIME)
    if (!partId) return
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    dispatch({ type: 'addNode', partId, x: Math.round(p.x - 88), y: Math.round(p.y - 30) })
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return
    const key = e.key.toLowerCase()
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      dispatch({ type: 'undo' })
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault()
      dispatch({ type: 'redo' })
    }
  }

  return (
    <div className="tl-canvas" onKeyDown={onKeyDown} tabIndex={-1} data-testid="canvas">
      <div className="tl-toolbar" role="toolbar" aria-label="캔버스 도구">
        <Button onClick={() => dispatch({ type: 'undo' })} disabled={state.past.length === 0} aria-label="되돌리기">
          되돌리기
        </Button>
        <Button onClick={() => dispatch({ type: 'redo' })} disabled={state.future.length === 0} aria-label="다시 실행">
          다시 실행
        </Button>
        <Button
          onClick={() => {
            dispatch({ type: 'autoLayout' })
            setLayoutTick((t) => t + 1)
          }}
          disabled={state.graph.nodes.length === 0}
        >
          자동 정렬
        </Button>
      </div>
      {state.graph.nodes.length === 0 && (
        <div className="tl-canvas__empty">
          <div>
            <strong>부품을 끌어다 놓아 보세요</strong>
            왼쪽 목록에서 부품을 캔버스로 끌어 놓고, 점에서 점으로 이어 서비스 구조를 그립니다.
          </div>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(c) => c.source && c.target && dispatch({ type: 'connect', from: c.source, to: c.target })}
        onNodeDragStop={(_e, _n, dragged) => {
          const positions: Record<string, { x: number; y: number }> = {}
          for (const d of dragged) positions[d.id] = { x: Math.round(d.position.x), y: Math.round(d.position.y) }
          dispatch({ type: 'moveNodes', positions })
        }}
        onDelete={({ nodes: delNodes, edges: delEdges }) =>
          dispatch({ type: 'remove', nodeIds: delNodes.map((n) => n.id), edgeIds: delEdges.map((e) => e.id) })
        }
        onPaneClick={() => onSelect?.(null)}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={onDrop}
        deleteKeyCode={['Backspace', 'Delete']}
        minZoom={0.3}
        maxZoom={1.8}
        colorMode="dark"
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#243350" />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
