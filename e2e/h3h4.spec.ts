import { expect, test } from '@playwright/test'
import { openApp, score } from './helpers.ts'

/**
 * 사람 시험(H3 스크린리더, H4 처음 사용자)의 자동화 대체 시험.
 * 실제 사람·실제 스크린리더 시험을 대신하지 않는다. "사람이 시험하기 전에 막힐 일"을 미리 걸러 낸다.
 */

test('H4 대체: 처음 방문자가 클릭 1번으로 행동 계획 3개를 보고, 60초 안에 점수까지 확인한다', async ({ page }) => {
  const t0 = Date.now()
  await openApp(page, '#/', { fresh: true })
  await page.getByRole('dialog').getByRole('button', { name: /예시로 시작/ }).click()
  await expect(page.locator('.tl-plan__step')).toHaveCount(3)
  await expect(score(page)).toHaveText(/^\d+$/)
  expect(Date.now() - t0).toBeLessThan(60_000)
})

test('H3 대체: 마우스 없이 키보드만으로 예시 시작 → 대응 적용까지 끝낼 수 있다', async ({ page }) => {
  await openApp(page, '#/', { fresh: true })
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const start = dialog.getByRole('button', { name: /예시로 시작/ })
  for (let i = 0; i < 12; i++) {
    if (await start.evaluate((e) => e === document.activeElement)) break
    await page.keyboard.press('Tab')
  }
  await expect(start).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.tl-plan__step')).toHaveCount(3)

  const before = await score(page).innerText()
  const apply = page.getByRole('button', { name: /^대응 3개 적용/ })
  for (let i = 0; i < 80; i++) {
    if (await apply.evaluate((e) => e === document.activeElement)) break
    await page.keyboard.press('Tab')
  }
  await expect(apply).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(async () => Number(await score(page).innerText())).toBeLessThan(Number(before))
})

test('H3 대체: 화면 읽기 순서에 필요한 이름·역할이 있다 (주요 영역, 탭, 목록, 상태 알림, 점수)', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: /메일 비서/ }).first().click()
  await expect(page.locator('.tl-plan__step')).toHaveCount(3)
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('navigation', { name: '화면 이동' })).toBeVisible()
  await expect(page.getByRole('tablist')).toBeVisible()
  await expect(page.getByRole('tab', { name: '행동 계획', selected: true })).toBeVisible()
  await expect(page.getByRole('list').filter({ has: page.locator('.tl-plan__step') })).toHaveCount(1)
  await expect(page.getByRole('status').first()).toBeAttached()
  const unnamed = await page.locator('button, a[href], [role=tab], input, select').evaluateAll((els) =>
    els
      .filter((e) => (e as HTMLElement).offsetParent !== null)
      .filter((e) => !((e.getAttribute('aria-label') ?? '') || (e.textContent ?? '').trim() || e.getAttribute('title') || e.getAttribute('aria-labelledby') || (e as HTMLInputElement).labels?.length))
      .map((e) => e.outerHTML.slice(0, 80)),
  )
  expect(unnamed).toEqual([])
})
