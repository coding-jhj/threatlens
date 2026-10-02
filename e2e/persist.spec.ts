import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { loadSample, openApp, score } from './helpers.ts'

test('자동 저장: 새로고침해도 구조가 남는다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '코드 에이전트')
  await expect(score(page)).toHaveText('61')
  await page.reload()
  await expect(score(page)).toHaveText('61')
  await expect(page.locator('.react-flow__node')).toHaveCount(6)
})

test('공유 링크: 복사한 링크를 새 브라우저 세션에서 열면 같은 구조가 열린다', async ({ page, browser, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page)
  await loadSample(page, '메일 비서')
  await page.getByRole('button', { name: '공유·저장' }).click()
  await page.getByRole('menuitem', { name: /공유 링크 복사/ }).click()
  await expect(page.locator('.tl-toast')).toContainText('공유 링크를 복사했습니다')
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain('#/s/')

  const other = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  const p2 = await other.newPage()
  await p2.addInitScript(() => localStorage.setItem('threatlens.onboarded.v1', '1'))
  await p2.goto(link)
  await expect(score(p2)).toHaveText('51')
  await expect(p2.locator('.react-flow__node')).toHaveCount(5)
  expect(p2.url()).not.toContain('#/s/') // 주소창에서 링크가 지워진다
  await other.close()
})

test('JSON 저장 → 불러오기: 파일로 내려받아 빈 화면에서 복원하고, 깨진 파일은 이유를 알려 준다', async ({ page, browser }, testInfo) => {
  await openApp(page)
  await loadSample(page, '고객상담 챗봇')
  await page.getByRole('button', { name: '공유·저장' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /JSON 파일로 저장/ }).click()])
  expect(download.suggestedFilename()).toMatch(/^threatlens-structure-\d{4}-\d{2}-\d{2}\.json$/)
  const file = testInfo.outputPath('saved.json')
  await download.saveAs(file)
  const saved = await readFile(file)
  expect(JSON.parse(saved.toString('utf8')).version).toBe(1)

  const other = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  const p2 = await other.newPage()
  await p2.addInitScript(() => localStorage.setItem('threatlens.onboarded.v1', '1'))
  await p2.goto('/')
  await expect(p2.getByRole('button', { name: '공유·저장' })).toBeVisible() // 화면이 다 그려진 뒤에 파일을 고른다
  await p2.locator('input[type=file]').setInputFiles({ name: 'saved.json', mimeType: 'application/json', buffer: saved })
  await expect(score(p2)).toHaveText('63')

  await p2.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"nodes":[{"id":"a","part":"zzz","attributes":[],"x":0,"y":0}],"edges":[]}') })
  await expect(p2.locator('.tl-toast')).toContainText('알 수 없는 부품 "zzz"')
  await expect(score(p2)).toHaveText('63') // 실패해도 지금 구조는 그대로
  await other.close()
})
