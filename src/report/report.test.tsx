import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { RULES } from '../data'
import { appliedKey } from '../domain/engine'
import type { Graph } from '../domain/graph'
import { EMPTY_STATE } from '../editor/model'
import type { Workspace } from '../workspace'
import { buildReport, nodeNames, reportDate, reportToMarkdown } from './report'
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
  expect(screen.getByText(/발견된 위협 8개/)).toBeTruthy()
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
