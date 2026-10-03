import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { loadSample, openApp } from './helpers.ts'

test('테마 전환: 밝은 화면이 기본이고, 어두운 화면 선택이 새로고침 뒤에도 남는다', async ({ page }) => {
  await openApp(page)
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: '어두운 화면' }).first().click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: '밝은 화면' }).first().click()
  await expect(html).toHaveAttribute('data-theme', 'light')
})

for (const w of [1366, 768, 390]) {
  test(`예시를 불러오면 모든 부품이 화면 안에 들어온다 (${w}px)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: w === 390 ? 844 : 800 })
    await openApp(page)
    await loadSample(page, '메일 비서')
    await page.waitForTimeout(400)
    const pane = await page.locator('.react-flow').boundingBox()
    if (!pane) throw new Error('캔버스를 찾지 못했습니다')
    const boxes = await page.locator('.react-flow__node').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect()
        return { l: r.left, t: r.top, r: r.right, b: r.bottom }
      }),
    )
    expect(boxes.length).toBeGreaterThan(3)
    for (const b of boxes) {
      expect(b.l).toBeGreaterThanOrEqual(pane.x - 1)
      expect(b.t).toBeGreaterThanOrEqual(pane.y - 1)
      expect(b.r).toBeLessThanOrEqual(pane.x + pane.width + 1)
      expect(b.b).toBeLessThanOrEqual(pane.y + pane.height + 1)
    }
  })
}

test('알림은 아래 상태 표시줄에 나오고 부품을 가리지 않는다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  const status = page.getByRole('status').filter({ hasText: '예시를 불러왔습니다' })
  await expect(status).toBeVisible()
  const bar = await page.locator('.tl-status').boundingBox()
  const pane = await page.locator('.react-flow').boundingBox()
  expect(bar && pane && bar.y >= pane.y + pane.height - 1).toBeTruthy()
})

for (const theme of ['light', 'dark'] as const) {
  test(`접근성 검사 (${theme})`, async ({ page }) => {
    await openApp(page)
    await page.addInitScript((t) => localStorage.setItem('threatlens.theme.v1', t), theme)
    await page.reload()
    await loadSample(page, '메일 비서')
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.react-flow__attribution').analyze()
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
  })
}
