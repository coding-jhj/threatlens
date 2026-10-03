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

/** 부품 n개짜리 구조를 자동 저장 칸에 미리 넣고 연다 (수백 번 클릭하지 않아도 되도록) */
export async function openWithNodes(page: Page, n: number) {
  const parts = ['web_page', 'ai_agent', 'mail_tool', 'external_party', 'doc_store']
  const saved = {
    version: 1,
    nodes: Array.from({ length: n }, (_, i) => ({ id: `n${i + 1}`, part: parts[i % 5], attributes: [], x: (i % 10) * 240, y: Math.floor(i / 10) * 130 })),
    edges: Array.from({ length: n - 1 }, (_, i) => ({ id: `e${i + 1}`, from: `n${i + 1}`, to: `n${i + 2}` })),
    applied: [],
  }
  await page.addInitScript((text) => {
    localStorage.setItem('threatlens.onboarded.v1', '1')
    localStorage.setItem('threatlens.workspace.v1', text)
  }, JSON.stringify(saved))
  await page.goto('/#/')
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
}
