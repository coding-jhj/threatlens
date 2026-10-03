/// <reference types="node" />
import { writeFileSync } from 'node:fs'
import { afterEach, describe, expect, test } from 'vitest'
import { RULES } from '../data'
import { SAMPLES } from '../samples/samples'
import { planActions } from './plan'
import { EFFORT_WEIGHT } from './rules'
import { SEVERITY_WEIGHT, scoreGraph } from './score'

/**
 * 점수 가중치(심각도 0.15/0.07/0.02)와 난이도 가중치(1/2/3)는 사람이 정한 값이다.
 * 값을 흔들어도 결론(예시 사이의 위험 순서, 첫 추천)이 거의 그대로인지 확인한다.
 */
const BASE_SEV = { ...SEVERITY_WEIGHT }
const BASE_EFF = { ...EFFORT_WEIGHT }
afterEach(() => {
  Object.assign(SEVERITY_WEIGHT, BASE_SEV)
  Object.assign(EFFORT_WEIGHT, BASE_EFF)
})

const scores = () => SAMPLES.map((s) => scoreGraph(s.graph, RULES).overall)
const order = (xs: number[]) => xs.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map((p) => p[1])
const baseScores = scores()
const baseOrder = order(baseScores)
const first = () => SAMPLES.map((s) => {
  const st = planActions(s.graph, RULES).steps[0]
  return `${st.nodeId}|${st.fixId}`
})
const baseFirst = first()

const FACTORS = [0.7, 0.85, 1.15, 1.3]
const rows: string[] = []

describe('심각도 가중치를 모두 같은 비율로 흔들어도', () => {
  test.each(FACTORS)('×%s: 예시 위험 순서가 같다', (k) => {
    for (const key of Object.keys(SEVERITY_WEIGHT) as (keyof typeof SEVERITY_WEIGHT)[]) SEVERITY_WEIGHT[key] = BASE_SEV[key] * k
    const s = scores()
    rows.push(`| 심각도 전체 ×${k} | ${s.join(' / ')} | ${order(s).join('>') === baseOrder.join('>') ? '같음' : '바뀜'} |`)
    expect(order(s)).toEqual(baseOrder)
  })
})

describe('심각도 한 단계만 흔들어도', () => {
  const cases = (['high', 'medium', 'low'] as const).flatMap((sev) => [0.7, 1.3].map((k) => [sev, k] as const))
  test.each(cases)('%s ×%s: 예시 위험 순서는 최대 한 쌍까지만 바뀐다', (sev, k) => {
    SEVERITY_WEIGHT[sev] = BASE_SEV[sev] * k
    const s = scores()
    const o = order(s)
    const swapped = o.filter((v, i) => v !== baseOrder[i]).length
    rows.push(`| ${sev} ×${k} | ${s.join(' / ')} | ${swapped === 0 ? '같음' : `${swapped}칸 바뀜`} |`)
    expect(swapped).toBeLessThanOrEqual(2)
  })
})

describe('난이도 가중치', () => {
  test('난이도를 무시(1/1/1)하면 2·3번째 추천이 바뀌는 예시가 3개 이상이고, 그 대가는 점수 3점 이내다', () => {
    const run = () => SAMPLES.map((s) => planActions(s.graph, RULES))
    const withEffort = run()
    Object.assign(EFFORT_WEIGHT, { low: 1, mid: 1, high: 1 })
    const noEffort = run()
    const key = (p: ReturnType<typeof planActions>) => p.steps.map((x) => `${x.nodeId}|${x.fixId}`).join(',')
    const differ = withEffort.filter((p, i) => key(p) !== key(noEffort[i])).length
    const cost = withEffort.map((p, i) => p.after - noEffort[i].after)
    rows.push(`| 난이도 1/1/1 (무시) | 계획이 달라진 예시 ${differ}/${withEffort.length}, 난이도 반영의 점수 손해 ${cost.join('/')}점 | - |`)
    expect(differ).toBeGreaterThanOrEqual(3)
    for (const c of cost) expect(c).toBeLessThanOrEqual(3)
  })

  test.each([
    [1, 1.5, 2],
    [1, 3, 5],
  ])('난이도 %s/%s/%s: 첫 추천이 대부분(5개 중 4개 이상) 그대로다', (l, m, h) => {
    Object.assign(EFFORT_WEIGHT, { low: l, mid: m, high: h })
    const f = first()
    const same = f.filter((x, i) => x === baseFirst[i]).length
    rows.push(`| 난이도 ${l}/${m}/${h} | 첫 추천 ${same}/${f.length} 동일 | - |`)
    expect(same).toBeGreaterThanOrEqual(4)
  })
})

test('결과표를 문서용으로 내보낸다 (WRITE_SENS_REPORT=경로 일 때만)', () => {
  const out = process.env.WRITE_SENS_REPORT
  if (!out) return
  writeFileSync(out, ['| 흔든 값 | 예시 5개 점수 | 결과 |', '|---|---|---|', `| 기준 | ${baseScores.join(' / ')} | - |`, ...rows].join('\n') + '\n')
})
