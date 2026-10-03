import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { loadSample, openApp, openWithNodes } from './helpers.ts'

const ROUTES = ['#/', '#/rules', '#/report', '#/eval']

for (const hash of ROUTES) {
  test(`접근성 자동 검사(axe, WCAG A·AA): ${hash} 위반 0건`, async ({ page }) => {
    await openApp(page, hash)
    if (hash === '#/') await loadSample(page, '메일 비서')
    if (hash === '#/report') await page.waitForTimeout(200)
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.react-flow__attribution').analyze()
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([])
  })
}

test('접근성 자동 검사(axe): 속성 창과 안내 창을 연 상태도 위반 0건', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await page.locator('.react-flow__node:has-text("AI 에이전트")').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.tl-inspector')).toBeVisible()
  let r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.react-flow__attribution').analyze()
  expect(r.violations.map((v) => v.id)).toEqual([])
  await page.getByRole('button', { name: '사용법' }).click()
  r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.react-flow__attribution').analyze()
  expect(r.violations.map((v) => v.id)).toEqual([])
})

test('키보드로 화살표 삭제: 속성 창의 삭제 버튼, 부품은 Delete 키', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  const edges = await page.locator('.react-flow__edge').count()
  await page.locator('.react-flow__node:has-text("AI 에이전트")').focus()
  await page.keyboard.press('Enter')
  await page.getByText('화살표 관리').click()
  await page.getByRole('button', { name: /^화살표 삭제/ }).first().press('Enter')
  await expect(page.locator('.react-flow__edge')).toHaveCount(edges - 1)
  const nodes = await page.locator('.react-flow__node').count()
  await page.locator('.react-flow__node:has-text("업로드 문서")').focus()
  await page.keyboard.press('Delete')
  await expect(page.locator('.react-flow__node')).toHaveCount(nodes - 1)
  await page.locator('.tl-canvas').focus()
  await page.keyboard.press('Control+z')
  await expect(page.locator('.react-flow__node')).toHaveCount(nodes)
})

for (const hash of ROUTES) {
  test(`모바일 390×800: ${hash} 가로로 넘치지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await openApp(page, hash)
    if (hash === '#/') await loadSample(page, '메일 비서')
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(over).toBeLessThanOrEqual(0)
  })
}

test('모바일 390×800: 편집기에서 캔버스를 쓸 수 있고 위협 카드까지 스크롤된다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await openApp(page)
  await loadSample(page, '메일 비서')
  const box = await page.evaluate(() => {
    const b = document.querySelector('.tl-canvas')!.getBoundingClientRect()
    return { w: b.width, h: b.height }
  })
  expect(box.h).toBeGreaterThanOrEqual(300)
  expect(box.w).toBeGreaterThanOrEqual(340)
  await page.locator('.tl-threats__title').first().scrollIntoViewIfNeeded()
  await expect(page.locator('.tl-threats__title').first()).toBeInViewport()
})

test('저장·불러오기 한도: 부품 100개 구조가 새로고침 뒤에도 그대로 복원된다', async ({ page }) => {
  await openWithNodes(page, 100)
  await page.reload()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('threatlens.workspace.v1')!).nodes.length)).toBe(100)
})
