import { expect, test } from '@playwright/test'
import { nav, openApp } from './helpers.ts'

test('규칙 라이브러리: 28개 → 화공 5개 → "인터록" 검색 2개, 없는 검색어는 안내', async ({ page }) => {
  await openApp(page, '#/rules')
  await expect(page.locator('.tl-lib__count')).toHaveText('28개 중 28개 표시')
  await page.getByRole('tab', { name: /화공 특화/ }).click()
  await expect(page.locator('.tl-lib__card')).toHaveCount(5)
  await page.getByLabel('규칙 검색').fill('인터록')
  await expect(page.locator('.tl-lib__card')).toHaveCount(2) // R-09, R-10
  await page.getByLabel('규칙 검색').fill('zzzqqq')
  await expect(page.getByText('조건에 맞는 규칙이 없습니다')).toBeVisible()
})

test('보고서: 구조가 없으면 안내와 위협 지도 링크', async ({ page }) => {
  await openApp(page, '#/report')
  await expect(page.getByText('아직 분석할 구조가 없습니다')).toBeVisible()
})

test('평가표: 숫자와 한계가 숨김없이 보인다', async ({ page }) => {
  await openApp(page, '#/eval')
  await expect(page.locator('.tl-eval__stats')).toContainText('72%')
  await expect(page.locator('.tl-eval__stats')).toContainText('52%')
  await expect(page.locator('.tl-eval__stats')).toContainText('91%')
  await expect(page.getByRole('heading', { name: '놓친 위협 (8개)' })).toBeVisible()
  await expect(page.getByText('정답 작성: AI')).toBeVisible()
  await expect(page.getByRole('list', { name: '놓친 위협' }).getByRole('listitem')).toHaveCount(8)
})

test('화면 이동: 상단 메뉴로 네 화면을 오가도 편집기 구조가 남는다', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: /메일 비서/ }).click()
  for (const name of ['규칙 라이브러리', '보고서', '평가표']) await nav(page, name).click()
  await nav(page, '위협 지도').click()
  await expect(page.locator('.react-flow__node')).toHaveCount(5)
})
