import { readFileSync } from 'node:fs'

/** 사용성 테스트 기록표(CSV)를 집계해 목표 대비 결과를 출력한다. 값이 빈 행은 아직 진행하지 않은 사람으로 보고 제외한다. */
export const GOALS = { completion: 0.8, t1Sec: 90, satisfaction: 4 }

export function parseCsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/)
  const keys = head.split(',').map((k) => k.trim())
  return rows.filter((r) => r.trim()).map((r) => Object.fromEntries(r.split(',').map((v, i) => [keys[i], v.trim()])))
}

const num = (v) => (v === '' || v === undefined ? null : Number(v))
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function summarize(rows) {
  const done = rows.filter((r) => r.t1_done !== '' && r.t2_done !== '' && r.t3_done !== '')
  const cells = done.flatMap((r) => [num(r.t1_done), num(r.t2_done), num(r.t3_done)])
  const completion = cells.length ? cells.filter((v) => v === 1).length / cells.length : null
  const t1 = mean(done.filter((r) => r.t1_done === '1' && num(r.t1_sec) !== null).map((r) => num(r.t1_sec)))
  const sat = mean(done.map((r) => num(r.satisfaction)).filter((v) => v !== null))
  const confused = done.map((r) => num(r.confused_count) ?? 0).reduce((a, b) => a + b, 0)
  const stuck = done.map((r) => r.stuck_where).filter(Boolean)
  const ok = (v, f) => (v === null ? null : f(v))
  return {
    participants: done.length,
    completion,
    t1Sec: t1,
    satisfaction: sat,
    confusedTotal: confused,
    stuck,
    pass: {
      completion: ok(completion, (v) => v >= GOALS.completion),
      t1Sec: ok(t1, (v) => v <= GOALS.t1Sec),
      satisfaction: ok(sat, (v) => v >= GOALS.satisfaction),
    },
  }
}

const mark = (p) => (p === null ? '데이터 없음' : p ? '달성' : '미달')
export function format(s) {
  const f = (v, d = 1) => (v === null ? '-' : v.toFixed(d))
  return [
    `참가자 ${s.participants}명`,
    `과제 완료율: ${s.completion === null ? '-' : Math.round(s.completion * 100) + '%'} (목표 80% 이상) → ${mark(s.pass.completion)}`,
    `과제 1 평균 소요: ${f(s.t1Sec, 0)}초 (목표 90초 이내) → ${mark(s.pass.t1Sec)}`,
    `평균 만족도: ${f(s.satisfaction)} (목표 4 이상) → ${mark(s.pass.satisfaction)}`,
    `"무슨 뜻인지 모르겠다" 합계: ${s.confusedTotal}회`,
    `막힌 곳: ${s.stuck.length ? s.stuck.join(' / ') : '없음'}`,
  ].join('\n')
}

if (process.argv[1] && process.argv[1].endsWith('summarize-usertest.mjs')) {
  const file = process.argv[2]
  if (!file) {
    console.error('사용법: node scripts/summarize-usertest.mjs 기록표.csv')
    process.exit(1)
  }
  console.log(format(summarize(parseCsv(readFileSync(file, 'utf8')))))
}
