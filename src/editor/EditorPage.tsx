import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useMemo, useState, type ReactNode } from 'react'
import { RULES } from '../data'
import { analyze } from '../domain/analyze'
import { isAiNode } from '../domain/graph'
import { scoreGraph } from '../domain/score'
import { Button } from '../ui/components'
import { SAMPLES, type Sample } from '../samples/samples'
import { Brand } from '../AppNav'
import { Canvas } from './Canvas'
import { Inspector } from './Inspector'
import { Onboarding } from './Onboarding'
import { hasOnboarded, markOnboarded } from './onboardingStore'
import { Palette } from './Palette'
import { SampleList } from './SampleMenu'
import { Summary } from './Summary'
import { ThreatPanel } from './ThreatPanel'
import { findingKey, highlightEdges } from './threat'
import type { Workspace } from '../workspace'
import './editor.css'

function Inner({ nav, ws }: { nav: ReactNode; ws: Workspace }) {
  const { state, dispatch, applied, setApplied } = ws
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  const [activeKey, setActiveKey] = useState<string | null>(null)

  const analysis = useMemo(() => analyze(state.graph, RULES, applied), [state.graph, applied])
  const score = useMemo(() => scoreGraph(state.graph, RULES, applied).overall, [state.graph, applied])
  const before = useMemo(() => scoreGraph(state.graph, RULES).overall, [state.graph])
  const activeFinding = analysis.findings.find((f) => findingKey(f) === activeKey) ?? null
  const riskEdgeIds = useMemo(() => highlightEdges(state.graph, analysis, activeFinding), [state.graph, analysis, activeFinding])

  const toggleFix = (key: string, on: boolean) =>
    setApplied((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  const [showHelp, setShowHelp] = useState(() => !hasOnboarded())
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 3500)
  }
  const closeHelp = () => {
    markOnboarded()
    setShowHelp(false)
  }
  const loadSample = (s: Sample) => {
    dispatch({ type: 'replace', graph: s.graph })
    setApplied(new Set())
    setSelectedId(null)
    setActiveKey(null)
    setMenuOpen(false)
    closeHelp()
  }
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
        <Brand />
        {nav}
        <div style={{ flex: 1 }} />
        <Summary score={score} analysis={analysis} hasAi={hasAi} />
        <Button onClick={() => setShowHelp(true)}>사용법</Button>
        <Button variant="primary" disabled>
          분석 다시 실행
        </Button>
      </header>
      <div className="tl-editor">
        <Palette onAdd={addAtCenter} />
        <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
          <Canvas
            state={state}
            dispatch={dispatch}
            onSelect={setSelectedId}
            riskEdgeIds={riskEdgeIds}
            onNotice={flash}
            toolbarExtra={
              <Button onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
                예시 불러오기
              </Button>
            }
            emptyExtra={<SampleList onPick={loadSample} />}
          />
          {menuOpen && (
            <div className="tl-samplemenu" role="menu" aria-label="예시 구조">
              <SampleList onPick={loadSample} />
            </div>
          )}
          {notice && (
            <div className="tl-toast" role="status">
              {notice}
            </div>
          )}
          {selected && <Inspector node={selected} onChange={(attributes) => dispatch({ type: 'setAttributes', nodeId: selected.id, attributes })} />}
        </div>
        <ThreatPanel
          graph={state.graph}
          analysis={analysis}
          rules={RULES}
          applied={applied}
          before={before}
          after={score}
          hasAi={hasAi}
          activeKey={activeFinding ? activeKey : null}
          onToggleActive={(k) => setActiveKey((cur) => (cur === k ? null : k))}
          onToggleFix={toggleFix}
        />
      </div>
      {showHelp && <Onboarding onClose={closeHelp} onSample={() => loadSample(SAMPLES.find((x) => x.id === 'mail-assistant')!)} />}
    </>
  )
}

export default function EditorPage({ nav, ws }: { nav?: ReactNode; ws: Workspace }) {
  return (
    <div className="tl-app">
      <ReactFlowProvider>
        <Inner nav={nav} ws={ws} />
      </ReactFlowProvider>
    </div>
  )
}
