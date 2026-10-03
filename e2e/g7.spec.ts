import { expect, test } from '@playwright/test'
import { goTo, loadSample, openApp } from './helpers.ts'

test('보고서 v2: 도면·요약·행동 계획이 보이고 첫 장은 A4 한 장에 들어간다', async ({ page }) => {
  const errors = await openApp(page)
  await loadSample(page, '메일 비서')
  await goTo(page, '보고서')
  await expect(page.locator('.tl-rdiag')).toBeVisible()
  await expect(page.locator('.tl-rdiag__node')).toHaveCount(5)
  expect(await page.locator('.tl-rdiag__edge--red').count()).toBeGreaterThan(0)
  await expect(page.locator('.tl-report__sum')).toContainText('위협 8개를 찾았습니다')
  await expect(page.locator('.tl-report__table tbody tr').first()).toBeVisible()
  await expect(page.locator('.tl-report__story').first()).toContainText('원인')

  await page.emulateMedia({ media: 'print' })
  await page.setViewportSize({ width: 688, height: 1017 })
  const h = await page.locator('.tl-report__sheet').first().evaluate((el) => el.getBoundingClientRect().height)
  expect(h).toBeLessThanOrEqual(1017) // A4(297mm) − 여백 28mm
  for (const el of await page.locator('.tl-header').all()) expect(await el.isVisible()).toBe(false)
  if (process.env.G7_SHOT) await page.locator('.tl-report__sheet').first().screenshot({ path: process.env.G7_SHOT })
  const pdf = await page.pdf({ format: 'A4', margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } })
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  expect(pages).toBeGreaterThanOrEqual(3) // 요약 / 행동 계획·구조 / 위협 상세
  expect(errors).toEqual([])
})

test('보고서 v2: 사외 부품이 있으면 도면에 사외 영역과 점선 연결이 그려진다', async ({ page }) => {
  await openApp(page)
  for (const n of ['AI 에이전트', '외부 모델 서버']) await page.getByRole('button', { name: new RegExp(`^${n}`) }).first().click()
  await page.getByRole('button', { name: '자동 정렬' }).click()
  await page.waitForTimeout(400)
  const { connect } = await import('./helpers.ts')
  await connect(page, 'AI 에이전트', '외부 모델 서버')
  await goTo(page, '보고서')
  await expect(page.locator('.tl-rdiag__zone')).toHaveCount(1)
  await expect(page.locator('.tl-rdiag__edge.is-cross')).toHaveCount(1)
  await expect(page.locator('.tl-report__sum')).toContainText('신뢰 경계를 넘습니다')
})
