import { expect, test } from '@playwright/test'
import { loadSample, openApp } from './helpers.ts'

const nodes = (page: import('@playwright/test').Page) => page.locator('.react-flow__node')

test('처음 쓰는 사람: 예시를 불러온 뒤 메뉴를 눌렀어도 Ctrl+Z로 취소된다', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '웹 페이지 추가' }).click()
  await page.getByRole('button', { name: '예시 불러오기' }).click()
  await page.getByRole('menu', { name: '예시 구조' }).getByRole('button', { name: /메일 비서/ }).click()
  await expect(nodes(page)).toHaveCount(5)
  await expect(page.getByRole('status')).toContainText('되돌리려면 Ctrl+Z')
  await page.keyboard.press('Control+z')
  await expect(nodes(page)).toHaveCount(1)
})

test('부품 삭제: 클릭 후 속성 창의 "이 부품 삭제" 버튼', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await nodes(page).first().click()
  await page.getByRole('button', { name: '이 부품 삭제' }).click()
  await expect(nodes(page)).toHaveCount(4)
  await expect(page.locator('.tl-inspector')).toHaveCount(0)
})

test('선택 삭제: 부품을 클릭하면 도구줄의 "선택 삭제"가 켜지고, 누르면 지워진다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  const btn = page.getByRole('button', { name: '선택 삭제' })
  await expect(btn).toBeDisabled()
  await nodes(page).first().click()
  await expect(btn).toBeEnabled()
  await btn.click()
  await expect(nodes(page)).toHaveCount(4)
})

test('전체 선택(Ctrl+A) 후 삭제, 되돌리기로 복원', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await page.mouse.click(700, 650)
  await page.keyboard.press('Control+a')
  await page.getByRole('button', { name: '선택 삭제' }).click()
  await expect(nodes(page)).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(nodes(page)).toHaveCount(5)
})

test('모두 지우기: 초기 화면(빈 캔버스 안내)으로 돌아가고, 새로고침해도 비어 있으며, Ctrl+Z로 복원된다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await page.getByRole('button', { name: '모두 지우기' }).click()
  await expect(nodes(page)).toHaveCount(0)
  await expect(page.getByText('부품을 끌어다 놓아 보세요')).toBeVisible()
  await expect(page.getByRole('button', { name: '모두 지우기' })).toBeDisabled()
  await page.reload()
  await expect(page.getByText('부품을 끌어다 놓아 보세요')).toBeVisible()
  await page.getByRole('button', { name: '웹 페이지 추가' }).click()
  await page.getByRole('button', { name: '모두 지우기' }).click()
  await page.keyboard.press('Control+z')
  await expect(nodes(page)).toHaveCount(1)
})

test('속성 창의 체크 칸에서 Ctrl+Z는 부품 되돌리기를 건드리지 않는다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await page.locator('.react-flow__node:has-text("AI 에이전트")').click()
  await page.locator('.tl-inspector input[type=checkbox]').first().focus()
  await page.keyboard.press('Control+z')
  await expect(nodes(page)).toHaveCount(5)
})

async function twoParts(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '웹 페이지 추가' }).click()
  await page.getByRole('button', { name: 'AI 에이전트 추가' }).click()
  const web = page.locator('.react-flow__node:has-text("웹 페이지")')
  const ai = page.locator('.react-flow__node:has-text("AI 에이전트")')
  const drag = async (loc: typeof web, x: number, y: number) => {
    const b = (await loc.boundingBox())!
    await page.mouse.move(b.x + 60, b.y + 12)
    await page.mouse.down()
    await page.mouse.move(x, y, { steps: 6 })
    await page.mouse.up()
  }
  await drag(web, 330, 200)
  await drag(ai, 720, 320)
  await page.mouse.click(600, 120)
  return { web, ai }
}

const edgeCount = (page: import('@playwright/test').Page) => page.locator('.react-flow__edge').count()

for (const [label, dx] of [
  ['점에 정확히', 0],
  ['점에서 15px 벗어나게', -15],
  ['점에서 30px 벗어나게', -30],
] as const) {
  test(`연결: 화살표를 ${label} 놓아도 이어진다`, async ({ page }) => {
    await openApp(page)
    const { web, ai } = await twoParts(page)
    const s = (await web.locator('.react-flow__handle.source').boundingBox())!
    const t = (await ai.locator('.react-flow__handle.target').boundingBox())!
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
    await page.mouse.down()
    await page.mouse.move(t.x + t.width / 2 + dx, t.y + t.height / 2, { steps: 10 })
    await page.mouse.up()
    await expect.poll(() => edgeCount(page)).toBe(1)
  })
}

test('연결: 부품 몸통 가운데에 놓아도 이어진다', async ({ page }) => {
  await openApp(page)
  const { web, ai } = await twoParts(page)
  const s = (await web.locator('.react-flow__handle.source').boundingBox())!
  const b = (await ai.boundingBox())!
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect.poll(() => edgeCount(page)).toBe(1)
})

test('연결 실패: 빈 곳에 놓으면 이유를 알려 준다', async ({ page }) => {
  await openApp(page)
  const { web } = await twoParts(page)
  const s = (await web.locator('.react-flow__handle.source').boundingBox())!
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
  await page.mouse.down()
  await page.mouse.move(520, 560, { steps: 10 })
  await page.mouse.up()
  await expect(page.getByRole('status')).toContainText('다른 부품 위에 놓아 주세요')
  expect(await edgeCount(page)).toBe(0)
})

test('속성 창이 캔버스를 가리지 않는다: 선택해도 캔버스 높이의 절반 이하', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await page.locator('.react-flow__node').first().click()
  const r = await page.evaluate(() => ({
    i: document.querySelector('.tl-inspector')!.getBoundingClientRect().height,
    c: document.querySelector('.tl-canvas')!.getBoundingClientRect().height,
  }))
  expect(r.i).toBeLessThanOrEqual(r.c * 0.3)
})

test('부품을 연달아 추가해도 서로 겹치지 않는다', async ({ page }) => {
  await openApp(page)
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'AI 모델 추가' }).click()
  const boxes = await nodes(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom })))
  expect(boxes).toHaveLength(8)
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const c = boxes[j]
      const overlap = a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b
      expect(overlap, `부품 ${i}와 ${j}가 겹침`).toBe(false)
    }
})

test('죽은 버튼이 없다: "분석 다시 실행"은 없고, 조작 힌트와 속성 설명이 보인다', async ({ page }) => {
  await openApp(page)
  await expect(page.getByRole('button', { name: '분석 다시 실행' })).toHaveCount(0)
  await loadSample(page, '메일 비서')
  await expect(page.getByText('삭제: 부품 클릭 후 Delete')).toBeVisible()
  await page.locator('.react-flow__node:has-text("AI 에이전트")').click()
  await page.getByText('속성 설명').click()
  await expect(page.getByText('질문과 자료가 외부 업체의 AI 서버로 전달됩니다.')).toBeVisible()
})

test('사용법 창에 조작 요약(삭제·취소·선택·화살표)이 있다', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '사용법' }).click()
  const box = page.getByRole('dialog')
  for (const w of ['삭제', '취소', '여러 개 선택', '화살표']) await expect(box).toContainText(w)
})
