import { expect, test } from '@playwright/test'
import { loadSample, openApp, score } from './helpers.ts'

test('행동 계획: 메일 비서에서 상위 3개 대응과 점수 변화가 보이고, 적용하면 표시한 점수로 내려간다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await expect(page.getByRole('tab', { name: '행동 계획', selected: true })).toBeVisible()
  await expect(score(page)).toHaveText('51')

  const steps = page.locator('.tl-plan__step')
  await expect(steps).toHaveCount(3)
  const apply = page.getByRole('button', { name: /^대응 3개 적용/ })
  const text = await apply.innerText()
  const m = text.match(/\((\d+) → (\d+)\)/)
  expect(m).not.toBeNull()
  const [before, after] = [Number(m![1]), Number(m![2])]
  expect(before).toBe(51)
  expect(after).toBeLessThan(before)

  // 단계마다 점수가 올라가지 않는다
  const nums = (await page.locator('.tl-plan__delta [aria-hidden]').allInnerTexts()).map((t) => t.split('→').map((x) => Number(x.trim())))
  for (const [b, a] of nums) expect(a).toBeLessThanOrEqual(b)

  await apply.click()
  await expect(score(page)).toHaveText(String(after))
  await expect(page.locator('.tl-plan__applied')).toContainText('적용한 대응')

  // 모두 해제하면 처음 점수로 돌아온다
  await page.getByRole('button', { name: '모두 해제' }).click()
  await expect(score(page)).toHaveText('51')
})

test('행동 계획: 한 단계만 적용하면 그 단계의 점수가 되고 다음 계획이 다시 계산된다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '고객상담 챗봇')
  const first = page.locator('.tl-plan__step').first()
  const delta = (await first.locator('.tl-plan__delta [aria-hidden]').innerText()).split('→').map((x) => Number(x.trim()))
  await first.getByRole('button', { name: /적용$/ }).click()
  await expect(score(page)).toHaveText(String(delta[1]))
  await expect(page.locator('.tl-plan__step')).toHaveCount(3)
})

test('행동 계획: 가장 먼저 막을 위험을 누르면 캔버스에 경로가 붉게 표시된다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await expect(page.getByRole('region', { name: '가장 먼저 막을 위험' })).toBeVisible()
  await page.getByRole('button', { name: '캔버스에서 경로 보기' }).click()
  await expect(page.locator('.react-flow__edge.tl-risk').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '캔버스 표시 끄기' })).toHaveAttribute('aria-pressed', 'true')
})

test('탭: 위협 탭으로 옮기면 카드가 보이고 방향키로 탭을 옮길 수 있다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  const plan = page.getByRole('tab', { name: '행동 계획' })
  await plan.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: /^위협/, selected: true })).toBeFocused()
  await expect(page.locator('.tl-threat__head').first()).toBeVisible()
})
