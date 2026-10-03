/// <reference types="node" />
import { writeFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { RULES } from '../data'
import { SAMPLES } from '../samples/samples'
import { candidateGroups, planActions, withGroups, type FixGroup } from './plan'
import { scoreGraph } from './score'

const NONE: ReadonlySet<string> = new Set()
const mail = SAMPLES.find((s) => s.id === 'mail-assistant')!

describe.each(SAMPLES.map((s) => [s.title, s] as const))('행동 계획: %s', (_t, s) => {
  const plan = planActions(s.graph, RULES)

  test('상위 3개 이하이고, 단계마다 점수가 올라가지 않는다 (단조성)', () => {
    expect(plan.steps.length).toBeGreaterThan(0)
    expect(plan.steps.length).toBeLessThanOrEqual(3)
    let prev = plan.before
    for (const st of plan.steps) {
      expect(st.before).toBe(prev)
      expect(st.after).toBeLessThanOrEqual(st.before)
      expect(st.gain).toBeGreaterThan(0)
      prev = st.after
    }
    expect(plan.after).toBe(prev)
    expect(plan.after).toBeLessThan(plan.before)
  })

  test('계획의 최종 점수 = 실제로 그 대응들을 적용했을 때의 점수', () => {
    const applied = withGroups(NONE, plan.steps)
    expect(scoreGraph(s.graph, RULES, applied).overall).toBe(plan.after)
    expect(scoreGraph(s.graph, RULES).overall).toBe(plan.before)
  })

  test('같은 입력이면 항상 같은 계획이다', () => {
    expect(planActions(s.graph, RULES)).toEqual(plan)
  })

  test('이미 적용한 대응은 다시 추천하지 않는다', () => {
    const done = withGroups(NONE, plan.steps)
    const next = planActions(s.graph, RULES, done)
    const used = new Set(plan.steps.flatMap((x) => x.keys))
    for (const st of next.steps) for (const k of st.keys) expect(used.has(k)).toBe(false)
    expect(next.before).toBe(plan.after)
  })
})

test('메일 비서: 1단계는 점수를 가장 크게 낮추는 쉬운 대응이고 표시 점수가 55에서 시작한다', () => {
  const plan = planActions(mail.graph, RULES)
  expect(plan.before).toBe(55)
  expect(plan.steps).toHaveLength(3)
  expect(plan.steps[0].gain).toBeGreaterThanOrEqual(plan.steps[2].gain - 1e-9) // 효과가 큰 순
})

test('같은 부품에 같은 대응은 한 묶음으로 센다', () => {
  const groups = candidateGroups(mail.graph, RULES, NONE)
  const ids = groups.map((g) => `${g.nodeId}|${g.fixId}|${g.label}`)
  expect(new Set(ids).size).toBe(ids.length)
  expect(groups.some((g) => g.ruleIds.length > 1)).toBe(true)
})

test('위협이 없는 구조는 빈 계획이다', () => {
  const plan = planActions({ nodes: [], edges: [] }, RULES)
  expect(plan).toEqual({ steps: [], before: 0, after: 0 })
})

/** 전수 탐색: 후보 묶음 중 k개를 모든 방법으로 골라 점수가 가장 낮은 조합 */
function bestOfK(graphIdx: number, k: number, pool: FixGroup[]): number {
  const g = SAMPLES[graphIdx].graph
  let best = scoreGraph(g, RULES).overall
  const rec = (start: number, chosen: FixGroup[]) => {
    if (chosen.length === k) {
      best = Math.min(best, scoreGraph(g, RULES, withGroups(NONE, chosen)).overall)
      return
    }
    for (let i = start; i < pool.length; i++) rec(i + 1, [...chosen, pool[i]])
  }
  rec(0, [])
  return best
}

describe('탐욕 결과와 전수 탐색 최적의 차이', () => {
  const rows = SAMPLES.map((s, i) => {
    const plan = planActions(s.graph, RULES)
    const pool = candidateGroups(s.graph, RULES, NONE)
    const k = plan.steps.length
    const optimal = bestOfK(i, k, pool)
    return { title: s.title, before: plan.before, greedy: plan.after, optimal, k, candidates: pool.length }
  })

  test('탐욕 점수는 최적보다 낮아질 수 없고, 차이는 10점 이내다', () => {
    for (const r of rows) {
      expect(r.greedy).toBeGreaterThanOrEqual(r.optimal)
      expect(r.greedy - r.optimal).toBeLessThanOrEqual(10)
    }
  })

  test('비교표를 문서용으로 내보낸다 (WRITE_PLAN_REPORT=경로 일 때만)', () => {
    const out = process.env.WRITE_PLAN_REPORT
    if (!out) return
    const lines = [
      '| 예시 | 시작 점수 | 탐욕(난이도 반영) | 전수 탐색 최적 | 차이 | 후보 수 |',
      '|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.title} | ${r.before} | ${r.greedy} | ${r.optimal} | ${r.greedy - r.optimal} | ${r.candidates} |`),
    ]
    writeFileSync(out, lines.join('\n') + '\n')
  })
})
