import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openApp, score } from './helpers.ts'

test('질문 마법사: 8개에 답하면 60초 안에 구조·점수·행동 계획이 나온다', async ({ page }) => {
  const t0 = Date.now()
  const errors = await openApp(page)
  await page.getByRole('button', { name: '질문 8개로 시작' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: '질문 1 / 8' })).toBeFocused()
  for (let i = 0; i < 8; i++) await dialog.getByRole('button', { name: '예', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: '구조가 만들어졌습니다' })).toBeVisible()
  await expect(dialog).toContainText('행동 계획')
  await dialog.getByRole('button', { name: '도면 열기' }).click()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await expect(score(page)).not.toHaveText('–')
  await expect(page.locator('.tl-plan__step').first()).toBeVisible()
  expect(Date.now() - t0).toBeLessThan(60_000)
  // 열린 뒤 되돌리기로 빈 화면 복원
  await page.keyboard.press('Control+z')
  await expect(page.locator('.react-flow__node')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('질문 마법사: 이전 질문·취소·Esc, 키보드만으로 끝낼 수 있다', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '질문으로 시작' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '아니오' }).click()
  await expect(dialog.getByRole('heading', { name: '질문 2 / 8' })).toBeVisible()
  await dialog.getByRole('button', { name: '이전 질문' }).click()
  await expect(dialog.getByRole('heading', { name: '질문 1 / 8' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.react-flow__node')).toHaveCount(0)
})

test('질문 마법사 접근성 검사', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '질문 8개로 시작' }).click()
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.react-flow__attribution').analyze()
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
})
