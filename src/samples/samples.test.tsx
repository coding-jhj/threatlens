import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { RULES } from '../data'
import { analyze } from '../domain/analyze'
import { getPart } from '../domain/parts'
import { scoreGraph } from '../domain/score'
import { EMPTY_STATE, reducer } from '../editor/model'
import { Onboarding } from '../editor/Onboarding'
import { hasOnboarded, markOnboarded, ONBOARDED_KEY } from '../editor/onboardingStore'
import { SAMPLES } from './samples'

beforeEach(() => localStorage.clear())

test('예시는 5개이고 id가 서로 다르다', () => {
  expect(SAMPLES).toHaveLength(5)
  expect(new Set(SAMPLES.map((s) => s.id)).size).toBe(5)
})

test.each(SAMPLES.map((s) => [s.id, s] as const))('예시 %s: 구조가 올바르다', (_id, s) => {
  const ids = s.graph.nodes.map((n) => n.id)
  expect(new Set(ids).size).toBe(ids.length)
  expect(s.graph.nodes.every((n) => getPart(n.partId))).toBe(true)
  expect(s.graph.edges.every((e) => ids.includes(e.from) && ids.includes(e.to) && e.from !== e.to)).toBe(true)
  expect(s.graph.nodes.some((n) => getPart(n.partId)?.kind === 'ai')).toBe(true)
  const xs = s.graph.nodes.map((n) => `${n.x},${n.y}`)
  expect(new Set(xs).size).toBe(xs.length) // 자동 정렬되어 겹치지 않는다
})

test('예시별 점수와 발동 규칙이 고정되어 있다 (규칙·점수 변경 감지용)', () => {
  const got = Object.fromEntries(
    SAMPLES.map((s) => [s.id, [scoreGraph(s.graph, RULES).overall, analyze(s.graph, RULES).findings.map((f) => f.ruleId).sort().join(',')]]),
  )
  expect(got).toEqual({
    'doc-qa': [25, 'R-06,R-14,R-16,R-17'],
    'support-bot': [63, 'R-01,R-02,R-05,R-06,R-14,R-16,R-17,R-20,R-22,R-24'],
    'code-agent': [61, 'R-03,R-04,R-07,R-08,R-15,R-17,R-25,R-28'],
    'mail-assistant': [51, 'R-01,R-02,R-14,R-17,R-22,R-24'],
    'process-assistant': [33, 'R-04,R-09,R-12'],
  })
})

test('공정 운전 보조 예시는 화공 규칙이 걸린다', () => {
  const s = SAMPLES.find((x) => x.id === 'process-assistant')!
  const cats = analyze(s.graph, RULES).findings.map((f) => RULES.find((r) => r.id === f.ruleId)!.category)
  expect(cats).toContain('chem')
})

test('replace: 예시로 바꿔도 되돌리기로 이전 구조가 돌아온다', () => {
  const drawn = reducer(EMPTY_STATE, { type: 'addNode', partId: 'user', x: 0, y: 0 })
  const loaded = reducer(drawn, { type: 'replace', graph: SAMPLES[0].graph })
  expect(loaded.graph).toBe(SAMPLES[0].graph)
  expect(reducer(loaded, { type: 'undo' }).graph).toBe(drawn.graph)
})

test('replace: 이후 새 노드 id가 예시 id와 겹치지 않는다', () => {
  const loaded = reducer(EMPTY_STATE, { type: 'replace', graph: SAMPLES[0].graph })
  const next = reducer(loaded, { type: 'addNode', partId: 'user', x: 0, y: 0 })
  const ids = next.graph.nodes.map((n) => n.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('안내 표시 여부는 localStorage에 저장된다', () => {
  expect(hasOnboarded()).toBe(false)
  markOnboarded()
  expect(localStorage.getItem(ONBOARDED_KEY)).toBe('1')
  expect(hasOnboarded()).toBe(true)
})

test('Onboarding: 3단계와 화살표 방향 설명, Esc로 닫힘', () => {
  let closed = 0
  render(<Onboarding onClose={() => closed++} onSample={() => {}} />)
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.getByText(/화살표는 정보·명령이 흐르는 방향/)).toBeTruthy()
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  act(() => {
    fireEvent.keyDown(window, { key: 'Escape' })
  })
  expect(closed).toBe(1)
})

test('Onboarding: 버튼 두 개가 각각 콜백을 부른다', () => {
  let sample = 0
  let closed = 0
  render(<Onboarding onClose={() => closed++} onSample={() => sample++} />)
  fireEvent.click(screen.getByRole('button', { name: /예시로 시작/ }))
  fireEvent.click(screen.getByRole('button', { name: '직접 그리기' }))
  expect([sample, closed]).toEqual([1, 1])
})
