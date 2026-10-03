import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { goTo, loadSample, openApp } from './helpers.ts'

test('스크린리더: 연결선과 부품에 한국어 이름이 붙고 연결 목록이 있다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  const edges = page.locator('.react-flow__edge')
  await expect(edges.first()).toHaveAttribute('aria-label', /에서 .+(으로|로) 이어지는 화살표/)
  expect(await edges.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? '').filter((l) => /Edge from/.test(l)))).toEqual([])
  await expect(page.locator('.react-flow__node').first()).toHaveAttribute('aria-label', /\./)
  await expect(page.getByRole('list', { name: '연결 목록' }).locator('li').first()).toContainText('이어짐')
  await expect(page.getByRole('button', { name: '확대' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: '전체 보기' })).toHaveCount(1)
})

test('제목 구조: h1 하나와 h2들이 있고, 위협 카드는 aria-controls로 본문과 이어진다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await expect(page.getByRole('heading', { level: 1, name: '위협 지도' })).toHaveCount(1)
  for (const n of ['가장 먼저 막을 위험', /^지금 할 일/, '위험 마름모']) await expect(page.getByRole('heading', { level: 2, name: n })).toHaveCount(1)
  await page.getByRole('tab', { name: /^위협/ }).click()
  const head = page.locator('.tl-threat__head').first()
  await head.click()
  const id = await head.getAttribute('aria-controls')
  expect(id).toBeTruthy()
  await expect(page.locator(`[id="${id}"]`)).toBeVisible()
})

test('대응을 적용하면 상태 줄이 점수 변화를 알리고 포커스가 "지금 할 일" 제목으로 간다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await page.locator('.tl-plan__one').first().click()
  await expect(page.getByRole('status').filter({ hasText: /위험 점수 51점에서 \d+점으로 낮아졌습니다/ })).toBeVisible()
  await expect(page.locator('.tl-plan__h')).toBeFocused()
})

test('점수 의미와 한계 문구가 행동 계획 탭에 보인다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  const note = page.locator('.tl-plan__disclaimer')
  await expect(note).toContainText('사고가 날 확률이 아니고')
  await expect(note).toContainText('HAZOP')
  await expect(note).toContainText('사람 전문가 검수 전')
  await expect(page.locator('.tl-plan__note')).toContainText('난이도')
})

test('화면을 옮기면 문서 제목이 바뀐다', async ({ page }) => {
  await openApp(page)
  await expect(page).toHaveTitle(/위협 지도/)
  await goTo(page, '평가표')
  await expect(page).toHaveTitle(/평가표/)
  await expect(page.getByRole('heading', { level: 1, name: '평가표' })).toBeVisible()
})

test('평가표: 용어 설명, 태그 설명(abbr), 접힘 상태, v2 수치가 있다', async ({ page }) => {
  await openApp(page, '#/eval')
  await expect(page.getByRole('heading', { level: 2, name: '용어' })).toBeVisible()
  expect(await page.locator('abbr[title^="OWASP LLM"]').count()).toBeGreaterThan(0)
  await expect(page.locator('p', { hasText: 'v2 기준' })).toContainText('재현율 느슨 69%')
  const toggle = page.getByRole('button', { name: /엄격 기준으로는 못 찾은 위협/ })
  await expect(toggle).toHaveAttribute('aria-controls', 'tl-strict-list')
  await expect(page.getByText('confirmed-no-edits')).toHaveCount(0)
})

for (const route of ['#/', '#/eval']) {
  test(`접근성 검사 (추가 화면 ${route})`, async ({ page }) => {
    await openApp(page, route)
    if (route === '#/') await loadSample(page, '메일 비서')
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.react-flow__attribution').analyze()
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
  })
}
