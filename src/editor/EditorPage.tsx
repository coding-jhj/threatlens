import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
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
import { downloadText, reportDate } from '../report/report'
import { parseSaved, serialize, shareHash } from '../share/serialize'
import type { Workspace } from '../workspace'
import './editor.css'

function Inner({ nav, ws }: { nav: ReactNode; ws: Workspace }) {
  const { state, dispatch, applied, setApplied, replaceAll, notice, flash } = ws
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
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const today = () => reportDate(new Date().toISOString())

  const copyLink = async () => {
    setFileMenuOpen(false)
    if (state.graph.nodes.length === 0) return flash('공유할 구조가 없습니다. 먼저 부품을 놓아 주세요.')
    const url = `${location.origin}${location.pathname}${location.search}${shareHash(state.graph, applied)}`
    try {
      await navigator.clipboard.writeText(url)
      flash('공유 링크를 복사했습니다. 받는 사람이 열면 같은 구조가 보입니다.')
    } catch {
      window.prompt('아래 링크를 복사해 주세요 (Ctrl+C)', url)
    }
  }
  const exportJson = () => {
    setFileMenuOpen(false)
    if (state.graph.nodes.length === 0) return flash('저장할 구조가 없습니다. 먼저 부품을 놓아 주세요.')
    downloadText(`threatlens-structure-${today()}.json`, serialize(state.graph, applied, true), 'application/json')
  }
  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const r = parseSaved(await file.text())
    if (!r.ok) return flash(`불러올 수 없습니다: ${r.error}`)
    replaceAll(r.graph, r.applied)
    setSelectedId(null)
    setActiveKey(null)
    flash(`"${file.name}"을 불러왔습니다.`)
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
              <>
                <Button onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
                  예시 불러오기
                </Button>
                <Button onClick={() => setFileMenuOpen((o) => !o)} aria-expanded={fileMenuOpen}>
                  공유·저장
                </Button>
              </>
            }
            emptyExtra={<SampleList onPick={loadSample} />}
          />
          {menuOpen && (
            <div className="tl-samplemenu" role="menu" aria-label="예시 구조">
              <SampleList onPick={loadSample} />
            </div>
          )}
          {fileMenuOpen && (
            <div className="tl-samplemenu tl-filemenu" role="menu" aria-label="공유와 저장">
              <ul className="tl-samples">
                <li>
                  <button type="button" role="menuitem" onClick={copyLink}>
                    <b>공유 링크 복사</b>
                    <span>구조를 링크 하나에 담습니다. 서버에 올리지 않습니다.</span>
                  </button>
                </li>
                <li>
                  <button type="button" role="menuitem" onClick={exportJson}>
                    <b>JSON 파일로 저장</b>
                    <span>구조와 적용한 대응을 파일로 내려받습니다.</span>
                  </button>
                </li>
                <li>
                  <button type="button" role="menuitem" onClick={() => fileInput.current?.click()}>
                    <b>JSON 파일 불러오기</b>
                    <span>저장해 둔 파일로 지금 구조를 바꿉니다. 되돌리기로 복원할 수 있습니다.</span>
                  </button>
                </li>
              </ul>
            </div>
          )}
          <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importJson} aria-label="JSON 파일 선택" />
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
