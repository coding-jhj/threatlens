import { expect, type Page } from '@playwright/test'

/** 안내 창이 가리지 않도록 "이미 본 사용자"로 연다. 페이지 오류(잡히지 않은 예외)는 모아 둔다. */
export async function openApp(page: Page, hash = '#/', opts: { fresh?: boolean } = {}) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  if (!opts.fresh) await page.addInitScript(() => localStorage.setItem('threatlens.onboarded.v1', '1'))
  await page.goto(`/${hash}`)
  return errors
}

export const score = (page: Page) => page.locator('.tl-summary__score')
export const threatTitle = (page: Page) => page.locator('.tl-threats__title')

export async function loadSample(page: Page, title: string) {
  await page.getByRole('button', { name: new RegExp(title) }).first().click()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
}

export function nav(page: Page, name: string) {
  return page.getByRole('navigation', { name: '화면 이동' }).getByRole('link', { name })
}

/** 부품 오른쪽 점에서 다음 부품 왼쪽 점으로 끌어 화살표를 잇는다 */
export async function connect(page: Page, from: string, to: string) {
  const s = await page.locator(`.react-flow__node:has-text("${from}") .react-flow__handle.source`).boundingBox()
  const t = await page.locator(`.react-flow__node:has-text("${to}") .react-flow__handle.target`).boundingBox()
  if (!s || !t) throw new Error(`연결할 점을 찾지 못했습니다: ${from} → ${to}`)
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
  await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 })
  await page.mouse.up()
}
