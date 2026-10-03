import { describe, expect, test } from 'vitest'
import { RULES } from '../data'
import { SAMPLES } from '../samples/samples'
import { hazardLevels, LEVEL_STEP, MAX_LEVEL } from './hazard'
import { HAZARDS } from './rules'
import { scoreGraph } from './score'
import { planActions, withGroups } from './plan'

const NONE: ReadonlySet<string> = new Set()

describe('규칙의 시나리오와 위험 종류', () => {
  test('40개 규칙 모두 시나리오 3줄이 있고 줄마다 20자 이상, 같은 문장을 반복하지 않는다', () => {
    expect(RULES).toHaveLength(40)
    for (const r of RULES) {
      expect(r.story, r.id).toHaveLength(3)
      for (const line of r.story) expect(line.length, `${r.id}: ${line}`).toBeGreaterThanOrEqual(20)
      expect(new Set(r.story).size, r.id).toBe(3)
    }
  })
  test('위험 종류는 4가지이고 네 칸 모두 규칙이 하나 이상 있다', () => {
    const count = Object.fromEntries(HAZARDS.map((h) => [h, RULES.filter((r) => r.hazard === h).length]))
    for (const h of HAZARDS) expect(count[h], h).toBeGreaterThan(0)
    expect(Object.values(count).reduce((a, b) => a + b, 0)).toBe(40)
  })
  test('화공 규칙 중 설비에 닿는 것(R-09, 10, 12, 13)이 설비 칸이다', () => {
    for (const id of ['R-09', 'R-10', 'R-12', 'R-13']) expect(RULES.find((r) => r.id === id)!.hazard).toBe('plant')
  })
})

describe('위험 마름모 값', () => {
  test('빈 구조는 모두 0', () => {
    expect(hazardLevels({ nodes: [], edges: [] }, RULES)).toEqual({ inject: 0, leak: 0, misuse: 0, plant: 0 })
  })

  test.each(SAMPLES.map((s) => [s.title, s] as const))('%s: 모든 칸이 0~4 정수이고 위협이 있는 칸은 1 이상', (_t, s) => {
    const lv = hazardLevels(s.graph, RULES)
    const hazardOf = new Map(RULES.map((r) => [r.id, r.hazard]))
    const have = new Set(scoreGraph(s.graph, RULES).findings.map((f) => hazardOf.get(f.ruleId)))
    for (const h of HAZARDS) {
      expect(Number.isInteger(lv[h])).toBe(true)
      expect(lv[h]).toBeGreaterThanOrEqual(0)
      expect(lv[h]).toBeLessThanOrEqual(MAX_LEVEL)
      expect(lv[h] > 0, h).toBe(have.has(h))
    }
  })

  test.each(SAMPLES.map((s) => [s.title, s] as const))('%s: 대응을 적용하면 어느 칸도 올라가지 않는다', (_t, s) => {
    const before = hazardLevels(s.graph, RULES)
    const after = hazardLevels(s.graph, RULES, withGroups(NONE, planActions(s.graph, RULES).steps))
    for (const h of HAZARDS) expect(after[h]).toBeLessThanOrEqual(before[h])
  })

  test('손계산: 메일 비서의 칸 값 = ceil(그 칸 위험 합 / 0.075)', () => {
    const s = SAMPLES.find((x) => x.id === 'mail-assistant')!
    const { findings } = scoreGraph(s.graph, RULES)
    const hazardOf = new Map(RULES.map((r) => [r.id, r.hazard]))
    const lv = hazardLevels(s.graph, RULES)
    for (const h of HAZARDS) {
      const sum = findings.filter((f) => hazardOf.get(f.ruleId) === h).reduce((a, f) => a + f.risk, 0)
      expect(lv[h]).toBe(sum === 0 ? 0 : Math.min(MAX_LEVEL, Math.ceil(sum / LEVEL_STEP - 1e-9)))
    }
  })
})
