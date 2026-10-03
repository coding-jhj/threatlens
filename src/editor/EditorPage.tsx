import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { RULES } from '../data'
import { analyze } from '../domain/analyze'
import { isAiNode } from '../domain/graph'
import { getPart } from '../domain/parts'
import { scoreGraph } from '../domain/score'
import { Button } from '../ui/components'
import { SAMPLES, type Sample } from '../samples/samples'
import { Brand, ThemeToggle } from '../AppNav'
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

function Inner({ nav, ws, active }: { nav: ReactNode; ws: Workspace; active: boolean }) {
  const { state, dispatch, applied, setApplied, replaceAll, notice, flash } = ws
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [fitSignal, setFitSignal] = useState(0)
  const refit = () => setFitSignal((n) => n + 1)

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
  useEffect(() => {
    if (!menuOpen && !fileMenuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      setFileMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, fileMenuOpen])
  const [todayStr] = useState(() => reportDate(new Date().toISOString()))
  const today = () => todayStr
  const drawingNo = `TL-${today().replace(/\D/g, '')}-${String(state.graph.nodes.length).padStart(2, '0')}`

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
    refit()
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
    refit()
    setApplied(new Set())
    setSelectedId(null)
    setActiveKey(null)
    setMenuOpen(false)
    closeHelp()
    flash(`"${s.title}" 예시를 불러왔습니다. 되돌리려면 Ctrl+Z 또는 [되돌리기]를 누르세요.`)
  }
  const clearAll = () => {
    if (state.graph.nodes.length === 0) return
    dispatch({ type: 'replace', graph: { nodes: [], edges: [] } })
    setApplied(new Set())
    setSelectedId(null)
    setActiveKey(null)
    flash('모두 지웠습니다. 되돌리려면 Ctrl+Z 또는 [되돌리기]를 누르세요.')
  }
  const deleteSelectedNode = (id: string) => {
    dispatch({ type: 'remove', nodeIds: [id], edgeIds: [] })
    setSelectedId(null)
  }
  const hasAi = state.graph.nodes.some(isAiNode)
  const selected = state.graph.nodes.find((n) => n.id === selectedId) ?? null

  const addAtCenter = (partId: string) => {
    const pane = document.querySelector('.tl-canvas')?.getBoundingClientRect()
    const center = pane ? screenToFlowPosition({ x: pane.left + pane.width / 2, y: pane.top + pane.height / 2 }) : { x: 200, y: 200 }
    const W = 200
    const H = 100
    const base = { x: Math.round(center.x - 88), y: Math.round(center.y - 30) }
    const free = (x: number, y: number) => state.graph.nodes.every((n) => Math.abs(n.x - x) >= W || Math.abs(n.y - y) >= H)
    // 가운데에서 바깥으로 격자를 훑어 겹치지 않는 첫 자리를 쓴다
    let spot = base
    search: for (let ring = 0; ring < 12; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue
          const x = base.x + dx * W
          const y = base.y + dy * H
          if (free(x, y)) {
            spot = { x, y }
            break search
          }
        }
      }
    }
    dispatch({ type: 'addNode', partId, x: spot.x, y: spot.y })
  }

  return (
    <>
      <header className="tl-header">
        <Brand />
        {nav}
        <div style={{ flex: 1 }} />
        <Summary score={score} analysis={analysis} hasAi={hasAi} />
        <ThemeToggle />
        <Button onClick={() => setShowHelp(true)}>사용법</Button>
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
            onClearAll={clearAll}
            active={active}
            fitSignal={fitSignal}
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
          {state.graph.nodes.length > 0 && (
            <dl className="tl-titleblock" aria-label="도면 표제란">
              <div>
                <dt>도면 번호</dt>
                <dd>{drawingNo}</dd>
              </div>
              <div>
                <dt>작성일</dt>
                <dd>{today()}</dd>
              </div>
              <div>
                <dt>부품·연결</dt>
                <dd>
                  {state.graph.nodes.length}개 · {state.graph.edges.length}개
                </dd>
              </div>
              <div>
                <dt>위험 점수</dt>
                <dd>{hasAi ? score : '-'}</dd>
              </div>
            </dl>
          )}
          {selected && (
            <Inspector
              node={selected}
              others={state.graph.nodes.filter((n) => n.id !== selected.id)}
              onChange={(attributes) => dispatch({ type: 'setAttributes', nodeId: selected.id, attributes })}
              onConnect={(to) => dispatch({ type: 'connect', from: selected.id, to })}
              links={state.graph.edges
                .filter((e) => e.from === selected.id || e.to === selected.id)
                .map((e) => {
                  const name = (id: string) => getPart(state.graph.nodes.find((n) => n.id === id)?.partId ?? '')?.label ?? id
                  return { id: e.id, text: `${name(e.from)} → ${name(e.to)}` }
                })}
              onDelete={() => deleteSelectedNode(selected.id)}
              onRemoveLink={(id) => dispatch({ type: 'remove', nodeIds: [], edgeIds: [id] })}
            />
          )}
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
      <footer className="tl-status">
        <div className="tl-status__msg" role="status">
          {notice}
        </div>
        {!notice && state.graph.nodes.length > 0 && (
          <div className="tl-status__keys" aria-hidden>
            삭제: 부품 클릭 후 Delete · 취소: Ctrl+Z · 전체 선택: Ctrl+A · 여러 개 선택: Shift+드래그 · 화면 이동: 빈 곳 드래그
          </div>
        )}
        <div className="tl-status__meta">
          부품 {state.graph.nodes.length} · 연결 {state.graph.edges.length}
        </div>
      </footer>
      {showHelp && <Onboarding onClose={closeHelp} onSample={() => loadSample(SAMPLES.find((x) => x.id === 'mail-assistant')!)} />}
    </>
  )
}

export default function EditorPage({ nav, ws, active = true }: { nav?: ReactNode; ws: Workspace; active?: boolean }) {
  return (
    <div className="tl-app">
      <ReactFlowProvider>
        <Inner nav={nav} ws={ws} active={active} />
      </ReactFlowProvider>
    </div>
  )
}
