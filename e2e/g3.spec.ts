import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { loadSample, openApp } from './helpers.ts'

test('위험 마름모: 헤더와 행동 계획 탭에 네 칸 값이 보이고 표로도 읽을 수 있다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  const diamonds = page.getByRole('img', { name: /^위험 마름모/ })
  await expect(diamonds).toHaveCount(2)
  await expect(diamonds.first()).toHaveAttribute('aria-label', /주입 \d, 유출 \d, 오용 \d, 설비 \d/)
  const rows = page.locator('.tl-hz tbody tr')
  await expect(rows).toHaveCount(4)
  await expect(page.locator('.tl-hz__lv').first()).toHaveText(/^[0-4]$/)
})

test('시나리오: 위협 카드를 펼치면 원인·AI가 하는 일·결과 3줄이 보인다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await page.getByRole('tab', { name: /^위협/ }).click()
  await page.locator('.tl-threat__head').first().click()
  const lines = page.locator('.tl-threat__body .tl-story li')
  await expect(lines).toHaveCount(3)
  await expect(lines.nth(0)).toContainText('원인')
  await expect(lines.nth(2)).toContainText('결과')
})

test('캔버스: 위협을 고르면 그 경로의 부품에만 번호가 붙고 마름모의 해당 칸이 강조된다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await expect(page.locator('.tl-node__badge')).toHaveCount(0)
  await page.getByRole('button', { name: '캔버스에서 경로 보기' }).click()
  const badges = page.locator('.tl-node__badge')
  await expect(badges).toHaveCount(4)
  expect(await badges.allInnerTexts()).toEqual(expect.arrayContaining(['1', '2', '3', '4']))
  // 번호가 없는 부품(문서 저장소)은 흐려진다
  await expect(page.locator('.react-flow__node:has-text("문서 저장소") .tl-node--dim')).toHaveCount(1)
  await expect(page.locator('.tl-hz tr.is-active')).toHaveCount(1)
  // 끄면 모두 원래대로
  await page.getByRole('button', { name: '캔버스 표시 끄기' }).click()
  await expect(page.locator('.tl-node__badge')).toHaveCount(0)
  await expect(page.locator('.tl-node--dim')).toHaveCount(0)
})

test('모션: 움직임 줄이기 설정이면 위험 경로의 점 흐름 애니메이션이 멈춘다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openApp(page)
  await loadSample(page, '메일 비서')
  const path = page.locator('.react-flow__edge.tl-risk .react-flow__edge-path').first()
  await expect(path).toBeAttached()
  expect(await path.evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
})

test('모션: 기본 설정에서는 위험 경로가 흐르는 점선으로 움직인다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openApp(page)
  await loadSample(page, '메일 비서')
  const path = page.locator('.react-flow__edge.tl-risk .react-flow__edge-path').first()
  expect(await path.evaluate((e) => getComputedStyle(e).animationName)).toBe('tl-flow')
})

for (const theme of ['light', 'dark'] as const) {
  test(`접근성 검사: 경로 번호와 마름모를 켠 상태 (${theme})`, async ({ page }) => {
    await openApp(page)
    await page.addInitScript((t) => localStorage.setItem('threatlens.theme.v1', t), theme)
    await page.reload()
    await loadSample(page, '메일 비서')
    await page.getByRole('button', { name: '캔버스에서 경로 보기' }).click()
    await expect(page.locator('.tl-node__badge').first()).toBeVisible()
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.react-flow__attribution').analyze()
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([])
  })
}
