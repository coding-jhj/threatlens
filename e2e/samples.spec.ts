import { expect, test } from '@playwright/test'
import { loadSample, goTo, openApp, score, threatTitle } from './helpers.ts'

// 규칙·점수를 바꾸면 이 표도 함께 바뀐다 (src/samples/samples.test.tsx와 같은 값)
const SAMPLES = [
  { title: '사내 문서 질의응답 봇', score: 25, findings: 4, id: 'doc-qa' },
  { title: '고객상담 챗봇', score: 63, findings: 10, id: 'support-bot' },
  { title: '코드 에이전트', score: 61, findings: 8, id: 'code-agent' },
  { title: '메일 비서', score: 51, findings: 6, id: 'mail-assistant' },
  { title: '공정 운전 보조', score: 43, findings: 4, id: 'process-assistant' },
] as const

for (const s of SAMPLES) {
  test(`예시 시나리오: ${s.title}`, async ({ page }) => {
    const errors = await openApp(page)

    // 1) 불러오면 점수와 위협 개수가 나온다
    await loadSample(page, s.title)
    await expect(score(page)).toHaveText(String(s.score))
    await expect(threatTitle(page)).toHaveText(`발견된 위협 ${s.findings}개`)

    // 2) 첫 위협 카드를 펼치면 대응 체크가 보이고, 체크하면 점수가 내려간다
    await page.getByRole('tab', { name: /^위협/ }).click()
    await page.locator('.tl-threat__head').first().click()
    const fix = page.locator('.tl-threat__body input[type=checkbox]').first()
    await fix.check()
    await expect(score(page)).not.toHaveText(String(s.score))
    expect(Number(await score(page).innerText())).toBeLessThan(s.score)
    await expect(page.locator('.tl-threats__compare')).toContainText(`대응 전 ${s.score}`)

    // 3) 보고서에 같은 대응 전 점수가 나오고, 대응 후는 더 낮다
    await goTo(page, '보고서')
    await expect(page.locator('.tl-report')).toBeVisible()
    await expect(page.locator('.tl-report__scores')).toContainText(String(s.score))
    await expect(page.locator('.tl-report')).toContainText(`발견된 위협 ${s.findings}개 · 적용한 대응 1개`)

    // 4) 편집기로 돌아와도 구조와 대응이 그대로다
    await goTo(page, '위협 지도')
    await expect(threatTitle(page)).toHaveText(new RegExp(`발견된 위협 \\d+개`))
    expect(Number(await score(page).innerText())).toBeLessThan(s.score)

    expect(errors).toEqual([])
  })
}

test('예시를 바꿔 불러와도 되돌리기로 이전 예시가 돌아온다', async ({ page }) => {
  await openApp(page)
  await loadSample(page, '메일 비서')
  await expect(score(page)).toHaveText('51')
  await page.getByRole('button', { name: '예시 불러오기' }).click()
  await page.getByRole('menu', { name: '예시 구조' }).getByRole('button', { name: /공정 운전 보조/ }).click()
  await expect(score(page)).toHaveText('43')
  await page.getByRole('button', { name: '되돌리기' }).click()
  await expect(score(page)).toHaveText('51')
})
