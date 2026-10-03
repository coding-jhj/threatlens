import { execFileSync } from 'node:child_process'
import { expect, test } from 'vitest'
// @ts-expect-error mjs 스크립트
import { format, parseCsv, summarize } from '../scripts/summarize-usertest.mjs'

const CSV = `participant,t1_done,t1_sec,t2_done,t3_done,confused_count,satisfaction,stuck_where
P1,1,60,1,1,0,5,
P2,1,80,1,0,2,4,연결 방향
P3,1,100,0,1,1,4,
P4,0,,1,1,3,3,질문 마법사 위치
P5,,,,,,,
`

test('집계: 빈 행(미진행)은 제외하고 완료율·평균·만족도를 계산한다', () => {
  const s = summarize(parseCsv(CSV))
  expect(s.participants).toBe(4)
  expect(s.completion).toBeCloseTo(9 / 12)
  expect(s.t1Sec).toBeCloseTo(80)
  expect(s.satisfaction).toBeCloseTo(4)
  expect(s.confusedTotal).toBe(6)
  expect(s.stuck).toEqual(['연결 방향', '질문 마법사 위치'])
  expect(s.pass).toEqual({ completion: false, t1Sec: true, satisfaction: true })
})

test('집계: 데이터가 없으면 달성 여부를 판정하지 않는다', () => {
  const s = summarize(parseCsv('participant,t1_done,t1_sec,t2_done,t3_done,confused_count,satisfaction,stuck_where\nP1,,,,,,,\n'))
  expect(s.participants).toBe(0)
  expect(s.pass).toEqual({ completion: null, t1Sec: null, satisfaction: null })
  expect(format(s)).toContain('데이터 없음')
})

test('빈 기록표 템플릿이 그대로 집계된다 (명령줄)', () => {
  const out = execFileSync('node', ['scripts/summarize-usertest.mjs', 'docs/user-test/record-sheet.csv']).toString()
  expect(out).toContain('참가자 0명')
})
