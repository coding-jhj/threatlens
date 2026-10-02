import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useReducer } from 'react'
import { Button } from '../ui/components'
import { Icon } from '../ui/Icon'
import { Canvas } from './Canvas'
import { EMPTY_STATE, reducer } from './model'
import { Palette } from './Palette'
import './editor.css'

function Inner() {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE)
  const { screenToFlowPosition } = useReactFlow()
  const addAtCenter = (partId: string) => {
    const pane = document.querySelector('.tl-canvas')?.getBoundingClientRect()
    const center = pane ? screenToFlowPosition({ x: pane.left + pane.width / 2, y: pane.top + pane.height / 2 }) : { x: 200, y: 200 }
    const jitter = (state.graph.nodes.length % 6) * 24
    dispatch({ type: 'addNode', partId, x: Math.round(center.x - 88 + jitter), y: Math.round(center.y - 30 + jitter) })
  }
  return (
    <div className="tl-editor">
      <Palette onAdd={addAtCenter} />
      <Canvas state={state} dispatch={dispatch} />
    </div>
  )
}

export default function EditorPage() {
  return (
    <div className="tl-app">
      <header className="tl-header">
        <div className="tl-logo">
          <span className="tl-logo__mark">
            <Icon name="shield" size={18} />
          </span>
          ThreatLens
        </div>
        <div style={{ flex: 1 }} />
        <Button variant="primary" disabled>
          분석 다시 실행
        </Button>
      </header>
      <ReactFlowProvider>
        <Inner />
      </ReactFlowProvider>
    </div>
  )
}
