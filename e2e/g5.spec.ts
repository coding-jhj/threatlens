import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { connect, loadSample, openApp } from './helpers.ts'

test('구조 점검: 정상 예시는 0건, 이어지지 않은 부품을 놓으면 1건과 노란 느낌표가 생기고 이으면 사라진다', async ({ page }) => {
  const errors = await openApp(page)
  await loadSample(page, '메일 비서')
  const tab = page.getByRole('tab', { name: /^점검/ })
  await expect(tab).toHaveText('점검 0')
  await expect(page.locator('.tl-node__warn')).toHaveCount(0)

  await page.getByRole('button', { name: '외부 API 추가' }).click()
  await expect(tab).toHaveText('점검 1')
  await expect(page.locator('.tl-node__warn')).toHaveCount(1)
  await expect(page.locator('.react-flow__node:has(.tl-node__warn)')).toContainText('외부 API')
  await tab.click()
  await expect(page.getByRole('heading', { name: '구조 점검 1건' })).toBeVisible()
  await expect(page.locator('.tl-lint__item')).toContainText('어디에도 이어져 있지 않습니다')
  const axe = await new AxeBuilder({ page }).include('.tl-lint').analyze()
  expect(axe.violations).toEqual([])

  // AI 에이전트와 잇으면 경고가 모두 사라진다
  await connect(page, 'AI 에이전트', '외부 API')
  await expect(tab).toHaveText('점검 0')
  await expect(page.locator('.tl-node__warn')).toHaveCount(0)
  await expect(page.getByText(/이상한 점을 찾지 못했습니다/)).toBeVisible()

  // 화살표 키로 세 탭을 돈다
  await tab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: '행동 계획', selected: true })).toBeFocused()
  expect(errors).toEqual([])
})
