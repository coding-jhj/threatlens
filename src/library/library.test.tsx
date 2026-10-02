import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { RULES } from '../data'
import { routeFromHash } from '../route'
import { countByCategory, filterRules } from './filter'
import RuleLibrary from './RuleLibrary'

test('filterRules: 조건 없으면 전부, 순서 유지', () => {
  expect(filterRules(RULES, 'all', '').map((r) => r.id)).toEqual(RULES.map((r) => r.id))
})

test('filterRules: 카테고리 필터는 해당 카테고리만', () => {
  const chem = filterRules(RULES, 'chem', '')
  expect(chem).toHaveLength(5)
  expect(chem.every((r) => r.category === 'chem')).toBe(true)
})

test('filterRules: 검색은 대소문자 무시, 규칙 번호·제목·대응·근거까지 찾는다', () => {
  expect(filterRules(RULES, 'all', 'r-09').map((r) => r.id)).toEqual(['R-09'])
  expect(filterRules(RULES, 'all', 'owasp').length).toBeGreaterThan(5)
  expect(filterRules(RULES, 'all', '사람 승인').length).toBeGreaterThan(0)
})

test('filterRules: 여러 단어는 모두 포함해야 하고, 카테고리와 함께 걸린다', () => {
  const both = filterRules(RULES, 'chem', 'owasp')
  expect(both.every((r) => r.category === 'chem')).toBe(true)
  expect(filterRules(RULES, 'all', '존재하지않는단어xyz')).toEqual([])
  expect(filterRules(RULES, 'all', '  ').length).toBe(RULES.length)
})

test('countByCategory: 합이 전체와 같다', () => {
  const c = countByCategory(RULES)
  expect(c['prompt-injection'] + c['data-leak'] + c['tool-abuse'] + c['store-log'] + c.chem).toBe(RULES.length)
  expect(c.all).toBe(RULES.length)
})

test('routeFromHash', () => {
  expect(routeFromHash('#/rules')).toBe('rules')
  expect(routeFromHash('#/report')).toBe('report')
  expect(routeFromHash('#/eval')).toBe('eval')
  expect(routeFromHash('#/styleguide')).toBe('styleguide')
  expect(routeFromHash('')).toBe('editor')
  expect(routeFromHash('#/모르는길')).toBe('editor')
})

test('RuleLibrary: 처음에는 전체 규칙 카드가 나온다', () => {
  render(<RuleLibrary />)
  expect(screen.getAllByRole('article')).toHaveLength(RULES.length)
  expect(screen.getByText(`${RULES.length}개 중 ${RULES.length}개 표시`)).toBeTruthy()
})

test('RuleLibrary: 카테고리 탭을 누르면 걸러진다', () => {
  render(<RuleLibrary />)
  fireEvent.click(screen.getByRole('tab', { name: /화공 특화/ }))
  expect(screen.getAllByRole('article')).toHaveLength(5)
  expect(screen.getByRole('tab', { name: /화공 특화/ }).getAttribute('aria-selected')).toBe('true')
})

test('RuleLibrary: 검색하면 걸러지고, 결과가 없으면 안내 문구', () => {
  render(<RuleLibrary />)
  fireEvent.change(screen.getByLabelText('규칙 검색'), { target: { value: 'R-01' } })
  expect(screen.getAllByRole('article')).toHaveLength(1)
  fireEvent.change(screen.getByLabelText('규칙 검색'), { target: { value: 'zzzzqqq' } })
  expect(screen.queryAllByRole('article')).toHaveLength(0)
  expect(screen.getByText(/조건에 맞는 규칙이 없습니다/)).toBeTruthy()
})

test('RuleLibrary: 카드에 발동 조건·대응·근거 링크가 있고, 부정 조건은 "없을 때"로 표시', () => {
  render(<RuleLibrary />)
  const r01 = screen.getByRole('article', { name: /^R-01 / })
  expect(within(r01).getByText('믿을 수 없는 입력을 읽음')).toBeTruthy()
  expect(within(r01).getByText('전송 전 사람 승인 단계 추가')).toBeTruthy()
  expect(within(r01).getByRole('link', { name: /LLM01/ })).toBeTruthy()
  const neg = RULES.find((r) => r.when.some((w) => w.startsWith('!')))!
  expect(within(screen.getByRole('article', { name: new RegExp(`^${neg.id} `) })).getAllByText(/없을 때/).length).toBeGreaterThan(0)
})
