import { expect, test } from '@playwright/test'
import { openApp, openWithNodes } from './helpers.ts'

test('키보드만으로: 부품 추가 → 속성 선택 → 화살표 잇기 → 되돌리기', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '웹 페이지 추가' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'AI 에이전트 추가' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await page.locator('.react-flow__node:has-text("웹 페이지")').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.tl-inspector')).toBeVisible()
  await page.getByLabel(/키보드로 잇기/).selectOption({ index: 1 })
  await page.getByRole('button', { name: '화살표 추가' }).press('Enter')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await page.locator('.tl-canvas').focus()
  await page.keyboard.press('Control+z')
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
})

test('Esc로 예시·저장 메뉴가 닫힌다', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '예시 불러오기' }).click()
  await expect(page.getByRole('menu', { name: '예시 구조' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.getByRole('button', { name: '공유·저장' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('안내 창: 열면 창 안으로 포커스가 가고, Tab이 밖으로 새지 않으며, Esc로 닫으면 포커스가 돌아온다', async ({ page }) => {
  await openApp(page)
  const opener = page.getByRole('button', { name: '사용법' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})

for (const [w, h] of [
  [1366, 768],
  [1024, 768],
  [768, 1024],
] as const) {
  test(`반응형 ${w}×${h}: 가로로 넘치지 않고 캔버스가 300px 이상, 위협 카드가 보인다`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await openApp(page)
    await page.getByRole('button', { name: /메일 비서/ }).first().click()
    await expect(page.locator('.react-flow__node').first()).toBeVisible()
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      canvasW: document.querySelector('.tl-canvas')!.getBoundingClientRect().width,
      canvasH: document.querySelector('.tl-canvas')!.getBoundingClientRect().height,
      navH: document.querySelector('.tl-nav a')!.getBoundingClientRect().height,
    }))
    expect(m.overflow).toBeLessThanOrEqual(0)
    expect(m.canvasW).toBeGreaterThanOrEqual(300)
    expect(m.canvasH).toBeGreaterThanOrEqual(300)
    expect(m.navH).toBeLessThan(48)
    await expect(page.locator('.tl-threats__title').first()).toBeVisible()
  })
}

test('성능: 부품 100개 구조에서도 끊김 없이 동작한다 (프레임 2개 300ms 이내, 분석 결과 표시)', async ({ page }) => {
  await openWithNodes(page, 100)
  await expect(page.locator('.tl-summary__score')).toBeVisible()
  const ms = await page.evaluate(async () => {
    const t = performance.now()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return performance.now() - t
  })
  expect(ms).toBeLessThan(300)
})
