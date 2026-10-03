import { expect, test } from '@playwright/test'
import { connect, openApp, score, threatTitle } from './helpers.ts'

test('직접 그리기: 부품 4개를 놓고 이은 뒤 속성을 켜고 끄면 점수가 28 → 55 → 40으로 바뀐다', async ({ page }) => {
  const errors = await openApp(page)
  for (const n of ['웹 페이지', 'AI 에이전트', '메일 전송', '외부 수신자']) await page.getByRole('button', { name: new RegExp(`^${n}`) }).first().click()
  await expect(page.locator('.react-flow__node')).toHaveCount(4)
  await expect(score(page)).toHaveText('0')

  await page.getByRole('button', { name: '자동 정렬' }).click()
  await page.waitForTimeout(400) // 이동 애니메이션
  await connect(page, '웹 페이지', 'AI 에이전트')
  await connect(page, 'AI 에이전트', '메일 전송')
  await connect(page, '메일 전송', '외부 수신자')
  await expect(page.locator('.react-flow__edge')).toHaveCount(3)
  await expect(score(page)).toHaveText('28')
  await expect(threatTitle(page)).toHaveText('발견된 위협 4개')
  await expect(page.locator('.react-flow__edge.tl-risk')).toHaveCount(3) // 위험 경로가 빨갛게 칠해진다

  await page.locator('.react-flow__node:has-text("AI 에이전트")').click()
  await page.getByLabel('민감정보에 접근').check()
  await expect(score(page)).toHaveText('55')
  await page.getByLabel('사람 승인 단계 있음').check()
  await expect(score(page)).toHaveText('40')
  await page.getByLabel('사람 승인 단계 있음').uncheck()
  await expect(score(page)).toHaveText('55')

  expect(errors).toEqual([])
})

test('자기 자신에게 잇거나 지운 뒤 되돌리기를 해도 구조가 깨지지 않는다', async ({ page }) => {
  await openApp(page)
  await page.getByRole("button", { name: /^AI 에이전트/ }).first().click()
  const node = page.locator('.react-flow__node').first()
  await connect(page, 'AI 에이전트', 'AI 에이전트')
  await expect(page.locator('.tl-status__msg')).toContainText('같은 부품끼리는 이을 수 없습니다')
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)

  await node.click()
  await page.keyboard.press('Delete')
  await expect(page.locator('.react-flow__node')).toHaveCount(0)
  await page.getByRole('button', { name: '되돌리기' }).click()
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
})

test('첫 방문 안내: 화살표 방향을 설명하고, 닫으면 다시 뜨지 않는다', async ({ page }) => {
  await openApp(page, '#/', { fresh: true })
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('화살표는 정보·명령이 흐르는 방향')
  await dialog.getByRole('button', { name: '직접 그리기' }).click()
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: '사용법' }).click()
  await expect(dialog).toBeVisible()
})

test('신뢰 경계: 사외 부품과 이은 연결이 점선으로 표시되고 사외 영역이 그려진다', async ({ page }) => {
  const errors = await openApp(page)
  for (const n of ['AI 에이전트', '외부 모델 서버']) await page.getByRole('button', { name: new RegExp(`^${n}`) }).first().click()
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await page.getByRole('button', { name: '자동 정렬' }).click()
  await page.waitForTimeout(400)
  await connect(page, 'AI 에이전트', '외부 모델 서버')
  await expect(page.locator('.react-flow__edge.tl-cross')).toHaveCount(1)
  await expect(page.locator('.tl-zone')).toHaveCount(1)
  await expect(page.locator('.tl-zone__label')).toHaveText('사외 (회사 밖)')
  await expect(page.getByLabel('신뢰 경계를 넘는 연결 있음')).toHaveCount(0) // 계산 속성은 직접 고르는 칸이 아니다
  expect(errors).toEqual([])
})
