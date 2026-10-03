import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { RULES } from '../data'
import { appliedKey } from '../domain/engine'
import type { Graph } from '../domain/graph'
import { EMPTY_STATE } from '../editor/model'
import type { Workspace } from '../workspace'
import { buildReport, nodeNames, reportDate, reportToMarkdown } from './report'
import { BASIS_SOURCES } from '../domain/rules'
import ReportPage from './ReportPage'

const graph: Graph = {
  nodes: [
    { id: 'a', partId: 'web_page', attributes: ['input.untrusted'] },
    { id: 'b', partId: 'ai_agent', attributes: ['data.sensitive'] },
    { id: 'c', partId: 'mail_tool', attributes: ['tool.send'] },
    { id: 'd', partId: 'external_party', attributes: [] },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'b', to: 'c' },
    { id: 'e3', from: 'c', to: 'd' },
  ],
}
const NOW = new Date(2026, 9, 2, 12)
const ALL_R01 = ['human_approval', 'least_privilege', 'source_label'].map((f) => appliedKey('b', 'R-01', f))

afterEach(() => vi.restoreAllMocks())

test('nodeNames: 같은 부품이 여럿이면 번호를 붙이고, 하나면 그대로', () => {
  const g: Graph = { nodes: [...graph.nodes, { id: 'x', partId: 'ai_agent', attributes: [] }], edges: [] }
  const n = nodeNames(g)
  expect(n.get('b')).toBe('AI 에이전트 #1')
  expect(n.get('x')).toBe('AI 에이전트 #2')
  expect(n.get('a')).toBe('웹 페이지')
})

test('buildReport: 점수·경로·위협이 분석과 같다 (대응 전 55, 경로 1개)', () => {
  const r = buildReport(graph, RULES, new Set(), NOW)
  expect(r.hasAi).toBe(true)
  expect(r.before).toBe(55)
  expect(r.after).toBe(55)
  expect(r.paths.map((p) => p.text)).toEqual(['웹 페이지 → AI 에이전트 → 메일 전송 → 외부 수신자'])
  expect(r.findings).toHaveLength(8)
  expect(r.appliedCount).toBe(0)
  expect(r.findings.every((f) => !f.resolved)).toBe(true)
})

test('buildReport: 대응을 적용하면 점수가 내려가고 적용 개수·체크가 반영된다', () => {
  const r = buildReport(graph, RULES, new Set(ALL_R01), NOW)
  expect(r.after).toBeLessThan(r.before)
  expect(r.appliedCount).toBe(3)
  const f = r.findings.find((x) => x.ruleId === 'R-01')!
  expect(f.fixes.every((x) => x.applied)).toBe(true)
})

test('buildReport: 사람 승인 대응이 다른 위협(예: 승인이 없을 때 발동하는 규칙)을 해결로 표시', () => {
  const r = buildReport(graph, RULES, new Set([appliedKey('b', 'R-01', 'human_approval')]), NOW)
  expect(r.findings.some((f) => f.resolved)).toBe(true)
})

test('buildReport: AI 부품이 없으면 hasAi=false', () => {
  expect(buildReport({ nodes: [], edges: [] }, RULES, new Set(), NOW).hasAi).toBe(false)
})

test('reportToMarkdown: 제목·요약 점수·경로·체크박스·근거 링크 포함', () => {
  const md = reportToMarkdown(buildReport(graph, RULES, new Set([appliedKey('b', 'R-01', 'human_approval')]), NOW))
  expect(md).toContain('# ThreatLens 위협 분석 보고서')
  expect(md).toContain('작성일: 2026-10-02')
  expect(md).toMatch(/위험 점수: \*\*55\*\* \(대응 전\) → \*\*\d+\*\* \(대응 후\)/)
  expect(md).toContain('- [높음] 웹 페이지 → AI 에이전트 → 메일 전송 → 외부 수신자')
  expect(md).toContain('- [x] 전송 전 사람 승인 단계 추가 (-30)')
  expect(md).toContain('- [ ] 도구 권한 최소화 (-20)')
  expect(md).toMatch(/\[LLM01:2025 Prompt Injection\]\(https:\/\/genai\.owasp\.org/)
  expect(md).toContain('## 읽는 법과 한계')
})

test('reportDate: YYYY-MM-DD', () => expect(reportDate(NOW.toISOString())).toBe('2026-10-02'))

const ws = (g: Graph, applied: string[] = []): Workspace =>
  ({ state: { ...EMPTY_STATE, graph: g as never }, dispatch: () => {}, applied: new Set(applied), setApplied: () => {} }) as unknown as Workspace

test('ReportPage: 구조가 없으면 안내와 위협 지도 링크', () => {
  render(<ReportPage ws={ws({ nodes: [], edges: [] })} />)
  expect(screen.getByText(/아직 분석할 구조가 없습니다/)).toBeTruthy()
  expect(screen.getByRole('link', { name: '위협 지도' }).getAttribute('href')).toBe('#/')
})

test('ReportPage: 보고서 본문이 렌더링되고 점수가 보인다', () => {
  render(<ReportPage ws={ws(graph)} />)
  expect(screen.getByRole('article', { name: '위협 분석 보고서' })).toBeTruthy()
  expect(screen.getAllByText('55').length).toBeGreaterThan(0)
  expect(screen.getAllByText(/위협 8개/).length).toBeGreaterThan(0)
})

test('ReportPage: Markdown 저장 버튼은 파일명 threatlens-report-날짜.md 로 내려받는다', () => {
  const create = vi.fn(() => 'blob:x')
  Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<ReportPage ws={ws(graph)} />)
  fireEvent.click(screen.getByRole('button', { name: 'Markdown으로 저장' }))
  expect(create).toHaveBeenCalledTimes(1)
  expect(click).toHaveBeenCalledTimes(1)
})

test('ReportPage: PDF 버튼은 인쇄 창을 연다', () => {
  const print = vi.fn()
  vi.stubGlobal('print', print)
  render(<ReportPage ws={ws(graph)} />)
  fireEvent.click(screen.getByRole('button', { name: /PDF로 저장/ }))
  expect(print).toHaveBeenCalled()
  vi.unstubAllGlobals()
})

test('buildReport v2: 요약 문단·마름모·행동 계획·도면이 채워진다', () => {
  const r = buildReport(graph, RULES, new Set(), NOW)
  expect(r.summary).toContain('위협 8개를 찾았습니다')
  expect(r.summary).toContain('위험 점수는 55점')
  expect(Object.values(r.levels).some((v) => v > 0)).toBe(true)
  expect(r.steps.length).toBeGreaterThan(0)
  expect(r.steps.length).toBeLessThanOrEqual(5)
  expect(r.steps.map((s) => s.order)).toEqual(r.steps.map((_, i) => i + 1))
  expect(r.steps.every((s) => s.after <= s.before && ['쉬움', '보통', '어려움'].includes(s.effort))).toBe(true)
  expect(r.steps[0].before).toBe(55)
  expect(r.diagram.nodes).toHaveLength(4)
  expect(r.diagram.edges).toHaveLength(3)
  expect(r.diagram.edges.every((e) => e.risk)).toBe(true)
  expect(r.diagram.width).toBeGreaterThan(0)
  expect(r.diagram.height).toBeGreaterThan(0)
})

test('buildReport v2: 사외 부품과 잇는 연결은 경계를 넘는 연결로 표시된다', () => {
  const g: Graph = {
    nodes: [
      { id: 'b', partId: 'ai_agent', attributes: [] },
      { id: 's', partId: 'model_server', attributes: ['model.external', 'zone.outside'] },
    ],
    edges: [{ id: 'e1', from: 'b', to: 's' }],
  }
  const r = buildReport(g, RULES, new Set(), NOW)
  expect(r.crossCount).toBe(1)
  expect(r.diagram.edges[0].cross).toBe(true)
  expect(r.diagram.nodes.find((n) => n.id === 's')!.outside).toBe(true)
  expect(r.connections[0]).toContain('(신뢰 경계를 넘음)')
  expect(r.summary).toContain('신뢰 경계를 넘습니다')
})

test('buildReport v2: 위협마다 공격 시나리오 3줄이 있다', () => {
  const r = buildReport(graph, RULES, new Set(), NOW)
  expect(r.findings.every((f) => f.story.length === 3 && f.story.every((s) => s.length > 0))).toBe(true)
})

test('reportToMarkdown v2: 행동 계획 표·마름모 표·시나리오·한계 문구 포함', () => {
  const md = reportToMarkdown(buildReport(graph, RULES, new Set(), NOW))
  expect(md).toContain('## 행동 계획')
  expect(md).toContain('| 순서 | 대응 | 대상 | 난이도 | 해결하는 위협 | 예상 점수 |')
  expect(md).toContain('| 주입 | 유출 | 오용 | 설비 |')
  expect(md).toContain('이런 일이 벌어질 수 있습니다:')
  expect(md).toContain('1. 원인:')
  expect(md).toContain('HAZOP')
})

test('링크 유효성: 모든 규칙의 근거 URL은 https이고, 보고서 근거 링크도 https만 쓴다', () => {
  for (const r of RULES) for (const b of r.basis) if (b.source !== 'unverified') expect(b.url?.startsWith('https://')).toBe(true)
  expect(BASIS_SOURCES.length).toBeGreaterThan(0)
  const md = reportToMarkdown(buildReport(graph, RULES, new Set(), NOW))
  const urls = [...md.matchAll(/\]\((https?:[^)]+)\)/g)].map((m) => m[1])
  expect(urls.length).toBeGreaterThan(0)
  expect(urls.every((u) => u.startsWith('https://'))).toBe(true)
})

test('ReportPage v2: 도면·행동 계획·위험 마름모가 보인다', () => {
  render(<ReportPage ws={ws(graph)} />)
  expect(screen.getByRole('img', { name: /구조 도면: 4개 부품과 3개 연결/ })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: '예상 점수' })).toBeTruthy()
  expect(screen.getByRole('img', { name: /위험 마름모/ })).toBeTruthy()
  expect(screen.getAllByRole('list', { name: '이런 일이 벌어질 수 있습니다' }).length).toBe(8)
})
