import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useMemo, useReducer, useState } from 'react'
import { RULES } from '../data'
import { analyze } from '../domain/analyze'
import { isAiNode } from '../domain/graph'
import { scoreGraph } from '../domain/score'
import { Button } from '../ui/components'
import { Icon } from '../ui/Icon'
import { Canvas } from './Canvas'
import { Inspector } from './Inspector'
import { EMPTY_STATE, reducer } from './model'
import { Palette } from './Palette'
import { Summary } from './Summary'
import './editor.css'

function Inner() {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  const analysis = useMemo(() => analyze(state.graph, RULES), [state.graph])
  const score = useMemo(() => scoreGraph(state.graph, RULES).overall, [state.graph])
  const hasAi = state.graph.nodes.some(isAiNode)
  const selected = state.graph.nodes.find((n) => n.id === selectedId) ?? null

  const addAtCenter = (partId: string) => {
    const pane = document.querySelector('.tl-canvas')?.getBoundingClientRect()
    const center = pane ? screenToFlowPosition({ x: pane.left + pane.width / 2, y: pane.top + pane.height / 2 }) : { x: 200, y: 200 }
    const jitter = (state.graph.nodes.length % 6) * 24
    dispatch({ type: 'addNode', partId, x: Math.round(center.x - 88 + jitter), y: Math.round(center.y - 30 + jitter) })
  }

  return (
    <>
      <header className="tl-header">
        <div className="tl-logo">
          <span className="tl-logo__mark">
            <Icon name="shield" size={18} />
          </span>
          ThreatLens
        </div>
        <div style={{ flex: 1 }} />
        <Summary score={score} analysis={analysis} hasAi={hasAi} />
        <Button variant="primary" disabled>
          분석 다시 실행
        </Button>
      </header>
      <div className="tl-editor">
        <Palette onAdd={addAtCenter} />
        <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
          <Canvas state={state} dispatch={dispatch} onSelect={setSelectedId} />
          {selected && <Inspector node={selected} onChange={(attributes) => dispatch({ type: 'setAttributes', nodeId: selected.id, attributes })} />}
        </div>
      </div>
    </>
  )
}

export default function EditorPage() {
  return (
    <div className="tl-app">
      <ReactFlowProvider>
        <Inner />
      </ReactFlowProvider>
    </div>
  )
}
