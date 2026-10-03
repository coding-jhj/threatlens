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
import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { getPart } from '../domain/parts'
import { Button } from '../ui/components'
import { RISK_COLOR, useTheme } from '../theme'
import type { Action, EditorState } from './model'
import { DRAG_MIME } from './Palette'
import { PartNode, type PartFlowNode } from './PartNode'
import './editor.css'

const nodeTypes = { part: PartNode }
const alreadyConnected = (state: EditorState, from: string, to: string) => state.graph.edges.some((e) => e.from === from && e.to === to)

const ARIA_LABELS = {
  'node.a11yDescription.default': '선택하려면 Enter나 Space를 누르세요. 삭제는 Delete, 취소는 Esc입니다.',
  'node.a11yDescription.keyboardDisabled': '선택하려면 Enter나 Space를 누르세요. 선택한 뒤 방향키로 옮기고, 삭제는 Delete, 취소는 Esc입니다.',
  'node.a11yDescription.ariaLiveMessage': ({ direction }: { direction: string; x: number; y: number }) => `선택한 부품을 ${direction} 방향으로 옮겼습니다.`,
  'edge.a11yDescription.default': '선택하려면 Enter나 Space를 누르세요. 선택한 뒤 Delete로 지울 수 있고, 취소는 Esc입니다.',
  'controls.ariaLabel': '화면 조절',
  'controls.zoomIn.ariaLabel': '확대',
  'controls.zoomOut.ariaLabel': '축소',
  'controls.fitView.ariaLabel': '전체 보기',
  'controls.interactive.ariaLabel': '조작 잠금 전환',
}

/** 받침 없거나 ㄹ 받침이면 '로', 그 외 받침이면 '으로' */
const toward = (w: string) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00
  return c < 0 || c > 11171 || c % 28 === 0 || c % 28 === 8 ? '로' : '으로'
}

const nameOf = (state: EditorState, id: string) => {
  const n = state.graph.nodes.find((x) => x.id === id)
  return (n && getPart(n.partId)?.label) ?? id
}

const nodeLabel = (partId: string) => {
  const part = getPart(partId)
  return `${part?.label ?? partId}. ${part?.description ?? ''}`
}

const toFlowNodes = (state: EditorState, prev: PartFlowNode[]): PartFlowNode[] =>
  state.graph.nodes.map((n) => ({
    id: n.id,
    type: 'part',
    position: { x: n.x, y: n.y },
    data: { partId: n.partId, attributes: n.attributes },
    ariaLabel: nodeLabel(n.partId),
    selected: prev.find((p) => p.id === n.id)?.selected ?? false,
  }))

const toFlowEdges = (state: EditorState, prev: Edge[]): Edge[] =>
  state.graph.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    ariaLabel: `${nameOf(state, e.from)}에서 ${nameOf(state, e.to)}${toward(nameOf(state, e.to))} 이어지는 화살표`,
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    selected: prev.find((p) => p.id === e.id)?.selected ?? false,
  }))


export function Canvas({
  state,
  dispatch,
  onSelect,
  riskEdgeIds,
  toolbarExtra,
  emptyExtra,
  onNotice,
  onClearAll,
  active = true,
  fitSignal = 0,
  badges,
  warnIds,
}: {
  state: EditorState
  dispatch: (a: Action) => void
  onSelect?: (nodeId: string | null) => void
  riskEdgeIds?: ReadonlySet<string>
  toolbarExtra?: ReactNode
  emptyExtra?: ReactNode
  onNotice?: (msg: string) => void
  onClearAll?: () => void
  active?: boolean
  fitSignal?: number
  badges?: Readonly<Record<string, number>>
  warnIds?: ReadonlySet<string>
}) {
  const theme = useTheme()
  const riskMarker = useMemo(() => ({ type: MarkerType.ArrowClosed, width: 18, height: 18, color: RISK_COLOR[theme] }), [theme])
  const { screenToFlowPosition, fitView } = useReactFlow()
  const [nodes, setNodes] = useState<PartFlowNode[]>(() => toFlowNodes(state, []))
  const [edges, setEdges] = useState<Edge[]>(() => toFlowEdges(state, []))
  const [layoutTick, setLayoutTick] = useState(0)
  const hasBadges = !!badges && Object.keys(badges).length > 0
  const hasWarn = !!warnIds && warnIds.size > 0
  const shownNodes = useMemo(
    () =>
      hasBadges || hasWarn
        ? nodes.map((n) => ({
            ...n,
            data: { ...n.data, ...(hasBadges ? { badge: badges![n.id], dim: badges![n.id] === undefined } : {}), ...(hasWarn && warnIds!.has(n.id) ? { warn: true } : {}) },
          }))
        : nodes,
    [nodes, badges, hasBadges, warnIds, hasWarn],
  )
  const shownEdges = useMemo(
    () => (riskEdgeIds && riskEdgeIds.size > 0 ? edges.map((e) => (riskEdgeIds.has(e.id) ? { ...e, className: 'tl-risk', markerEnd: riskMarker } : e)) : edges),
    [edges, riskEdgeIds, riskMarker],
  )

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
    if (fitSignal === 0) return
    // 새 부품의 크기가 측정된 뒤에 맞춰야 하므로 한 박자 늦춘다
    const t = window.setTimeout(() => void fitView({ duration: 0, padding: 0.2 }), 60)
    return () => window.clearTimeout(t)
  }, [fitSignal, fitView])
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

  const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id)
  const selectedEdgeIds = edges.filter((e) => e.selected).map((e) => e.id)
  const hasSelection = selectedNodeIds.length + selectedEdgeIds.length > 0
  const deleteSelected = () => {
    if (!hasSelection) return
    dispatch({ type: 'remove', nodeIds: selectedNodeIds, edgeIds: selectedEdgeIds })
    onSelect?.(null)
  }

  // 단축키는 포커스가 어디 있든(메뉴를 누른 뒤에도) 편집 화면이 보일 때 작동한다. 입력 칸에서는 건드리지 않는다.
  useEffect(() => {
    if (!active) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        dispatch({ type: 'undo' })
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        dispatch({ type: 'redo' })
      } else if (key === 'a') {
        e.preventDefault()
        setNodes((prev) => prev.map((n) => ({ ...n, selected: true })))
        setEdges((prev) => prev.map((x) => ({ ...x, selected: true })))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, dispatch])

  return (
    <div className="tl-canvas" tabIndex={-1} data-testid="canvas">
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
        <Button onClick={deleteSelected} disabled={!hasSelection} >
          선택 삭제
        </Button>
        <Button onClick={onClearAll} disabled={state.graph.nodes.length === 0}>
          모두 지우기
        </Button>
        {toolbarExtra}
      </div>
      {state.graph.nodes.length === 0 && (
        <div className="tl-canvas__empty">
          <div className="tl-canvas__start">
            <strong>부품을 끌어다 놓아 보세요</strong>
            왼쪽 목록에서 부품을 캔버스로 끌어 놓고, 점에서 점으로 이어 서비스 구조를 그립니다. 막막하면 아래 예시로 시작해 보세요.
            {emptyExtra}
          </div>
        </div>
      )}
      <ul className="tl-sr" aria-label="연결 목록">
        {state.graph.edges.length === 0 ? <li>이어진 부품이 없습니다</li> : state.graph.edges.map((e) => <li key={e.id}>{nameOf(state, e.from)}에서 {nameOf(state, e.to)}{toward(nameOf(state, e.to))} 이어짐</li>)}
      </ul>
      <ReactFlow
        nodes={shownNodes}
        edges={shownEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(c) => {
          if (!c.source || !c.target) return
          if (c.source === c.target) return onNotice?.('같은 부품끼리는 이을 수 없습니다.')
          if (state.graph.edges.some((e) => e.from === c.source && e.to === c.target)) return onNotice?.('이미 같은 방향으로 이어져 있습니다.')
          dispatch({ type: 'connect', from: c.source, to: c.target })
        }}
        connectionRadius={36}
        onConnectEnd={(event, conn) => {
          // 점에 정확히 놓은 경우는 onConnect가 처리한다. 여기서는 부품 몸통이나 빈 곳에 놓은 경우를 돕는다.
          if (conn.isValid || !conn.fromNode) return
          const pt = 'changedTouches' in event ? event.changedTouches[0] : event
          const over = document.elementFromPoint(pt.clientX, pt.clientY)?.closest('.react-flow__node')
          const targetId = over?.getAttribute('data-id')
          if (!targetId) return onNotice?.('화살표는 다른 부품 위에 놓아 주세요. 놓은 곳에 부품이 없습니다.')
          const [from, to] = conn.fromHandle?.type === 'target' ? [targetId, conn.fromNode.id] : [conn.fromNode.id, targetId]
          if (from === to) return onNotice?.('같은 부품끼리는 이을 수 없습니다.')
          if (alreadyConnected(state, from, to)) return onNotice?.('이미 같은 방향으로 이어져 있습니다.')
          dispatch({ type: 'connect', from, to })
        }}
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
        colorMode={theme}
        ariaLabelConfig={ARIA_LABELS}
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background id="minor" variant={BackgroundVariant.Lines} gap={24} lineWidth={1} color="var(--grid-minor)" />
        <Background id="major" variant={BackgroundVariant.Lines} gap={120} lineWidth={1} color="var(--grid-major)" />
        <Controls position="top-right" showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
