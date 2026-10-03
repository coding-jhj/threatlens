import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { RULES } from '../data'
import { analyze } from '../domain/analyze'
import { appliedKey } from '../domain/engine'
import type { Graph } from '../domain/graph'
import { planActions } from '../domain/plan'
import { scoreGraph } from '../domain/score'
import { ThreatPanel } from './ThreatPanel'
import { findingKey, highlightEdges, pruneApplied } from './threat'

const graph: Graph = {
  nodes: [
    { id: 'a', partId: 'web_page', attributes: ['input.untrusted'] },
    { id: 'b', partId: 'ai_agent', attributes: ['data.sensitive'] },
    { id: 'c', partId: 'mail_tool', attributes: ['tool.send'] },
    { id: 'd', partId: 'external_party', attributes: [] },
    { id: 'z', partId: 'doc_store', attributes: [] },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'b', to: 'c' },
    { id: 'e3', from: 'c', to: 'd' },
    { id: 'e4', from: 'z', to: 'a' },
  ],
}

test('highlightEdges: 선택 없으면 위험 경로의 간선 전부, 경로 밖 간선은 제외', () => {
  const an = analyze(graph, RULES)
  expect([...highlightEdges(graph, an, null)].sort()).toEqual(['e1', 'e2', 'e3'])
})

test('highlightEdges: 선택한 위협이 걸린 경로만', () => {
  const an = analyze(graph, RULES)
  const f = an.findings.find((x) => x.ruleId === 'R-01')!
  expect([...highlightEdges(graph, an, f)].sort()).toEqual(['e1', 'e2', 'e3'])
})

test('highlightEdges: 구조가 비면 빈 집합', () => {
  const g: Graph = { nodes: [], edges: [] }
  expect(highlightEdges(g, analyze(g, RULES), null).size).toBe(0)
})

test('pruneApplied: 지워진 노드의 체크만 버리고, 변화 없으면 같은 객체를 돌려준다', () => {
  const keep = appliedKey('b', 'R-01', 'human_approval')
  const drop = appliedKey('gone', 'R-01', 'human_approval')
  const same = new Set([keep])
  expect(pruneApplied(same, graph)).toBe(same)
  expect([...pruneApplied(new Set([keep, drop]), graph)]).toEqual([keep])
})

let openThreats = true
const renderPanel = (over: Partial<Parameters<typeof ThreatPanel>[0]> = {}) => {
  const applied = over.applied ?? new Set<string>()
  const analysis = analyze(graph, RULES, applied)
  const props = {
    graph,
    analysis,
    rules: RULES,
    applied,
    before: scoreGraph(graph, RULES).overall,
    after: scoreGraph(graph, RULES, applied).overall,
    hasAi: true,
    activeKey: null,
    onToggleActive: vi.fn(),
    onToggleFix: vi.fn(),
    onApplyKeys: vi.fn(),
    onClearApplied: vi.fn(),
    ...over,
  }
  render(<ThreatPanel {...props} />)
  // 기본 화면은 "행동 계획" 탭이므로, 위협 카드를 보는 시험은 "위협" 탭으로 옮긴다
  if (props.hasAi && openThreats) fireEvent.click(screen.getByRole('tab', { name: /^위협/ }))
  return props
}

test('ThreatPanel: AI 부품이 없으면 안내 문구', () => {
  renderPanel({ hasAi: false })
  expect(screen.getByText(/AI 부품을 놓고/)).toBeTruthy()
})

test('ThreatPanel: 위협 개수 제목과 카드가 발견 수만큼 나온다', () => {
  const p = renderPanel()
  expect(screen.getByText(`발견된 위협 ${p.analysis.findings.length}개`)).toBeTruthy()
  expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(p.analysis.findings.length)
})

test('ThreatPanel: 카드를 누르면 onToggleActive(키)', () => {
  const p = renderPanel()
  fireEvent.click(screen.getAllByRole('button', { expanded: false })[0])
  expect(p.onToggleActive).toHaveBeenCalledWith(findingKey(p.analysis.findings[0]))
})

test('ThreatPanel: 펼친 카드에 요약·대응 체크·근거가 보이고, 체크하면 onToggleFix(키, true)', () => {
  const p = renderPanel({ activeKey: findingKey(analyze(graph, RULES).findings.find((f) => f.ruleId === 'R-01')!) })
  const open = screen.getByRole('button', { expanded: true })
  const card = open.closest('section')!
  expect(within(card).getByText(/숨은 지시를 AI가 따르면/)).toBeTruthy()
  fireEvent.click(within(card).getByRole('checkbox', { name: /사람 승인 단계 추가/ }))
  expect(p.onToggleFix).toHaveBeenCalledWith(appliedKey('b', 'R-01', 'human_approval'), true)
  expect(within(card).getByRole('link', { name: /LLM01/ })).toBeTruthy()
})

test('ThreatPanel: 대응 적용 시 대응 전→후 점수와 감소 칩', () => {
  const applied = new Set([appliedKey('b', 'R-01', 'human_approval')])
  const p = renderPanel({ applied })
  expect(p.after).toBeLessThan(p.before)
  expect(screen.getByLabelText(`대응 전 ${p.before}, 대응 후 ${p.after}`)).toBeTruthy()
  expect(screen.getByText(`−${p.before - p.after}`)).toBeTruthy()
})

test('ThreatPanel: 대응 전후가 같으면 감소 칩이 없다', () => {
  renderPanel()
  expect(screen.queryByText(/^−\d+$/)).toBeNull()
})

describe('ThreatPanel: 행동 계획 탭', () => {
  const open = () => {
    openThreats = false
    const p = renderPanel()
    openThreats = true
    return p
  }

  test('처음 열면 행동 계획 탭이 선택되어 있고 가장 먼저 막을 위험과 대응 목록이 보인다', () => {
    open()
    expect(screen.getByRole('tab', { name: '행동 계획', selected: true })).toBeTruthy()
    expect(screen.getByRole('region', { name: '가장 먼저 막을 위험' })).toBeTruthy()
    expect(screen.getByRole('list').querySelectorAll('li').length).toBeGreaterThan(0)
  })

  test('[대응 N개 적용]을 누르면 계획의 모든 키가 onApplyKeys로 전달된다', () => {
    const p = open()
    fireEvent.click(screen.getByRole('button', { name: /^대응 \d+개 적용/ }))
    const keys = (p.onApplyKeys as ReturnType<typeof vi.fn>).mock.calls[0][0] as string[]
    expect(keys.length).toBeGreaterThanOrEqual(3)
    const applied = new Set(keys)
    expect(scoreGraph(graph, RULES, applied).overall).toBe(planActions(graph, RULES).after)
  })

  test('경로 보기 버튼은 onToggleActive(가장 위험한 위협의 키)를 부른다', () => {
    const p = open()
    fireEvent.click(screen.getByRole('button', { name: '캔버스에서 경로 보기' }))
    expect(p.onToggleActive).toHaveBeenCalledTimes(1)
  })

  test('적용한 대응이 있으면 개수와 [모두 해제]가 보이고, 누르면 onClearApplied', () => {
    openThreats = false
    const p = renderPanel({ applied: new Set([appliedKey('b', 'R-01', 'human_approval')]) })
    openThreats = true
    expect(screen.getByText(/적용한 대응 1개/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '모두 해제' }))
    expect(p.onClearApplied).toHaveBeenCalled()
  })
})
