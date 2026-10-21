import { expect, test } from 'vitest'
import raw from '../../docs/eval/ground-truth-trust-boundary.json?raw'
import { RULES } from '../data'
import { evaluateAll, ratio, type GroundTruth } from './evaluate'
import { TRUST_BOUNDARY_SAMPLE } from './trust-boundary'

interface Threat {
  id: string
  statement: string
  tags: string[]
  why: string
  severity_guess: string
}
interface GT {
  status: string
  structures: Record<string, { threats: Threat[] }>
}
const gt = JSON.parse(raw) as GT
const TAG = /^(LLM(0[1-9]|10)|T\d{4}(\.\d{3})?|SIS-INDEPENDENCE|OT-HUMAN-OVERSIGHT)$/

test('신뢰 경계 평가용 정답 목록: 형식이 올바르다', () => {
  const s = gt.structures['vendor-remote-control']
  expect(s.threats.length).toBeGreaterThanOrEqual(4)
  const ids = s.threats.map((t) => t.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const t of s.threats) {
    expect(t.id.startsWith('GT-vendor-remote-control-')).toBe(true)
    expect(t.statement.length).toBeGreaterThan(10)
    expect(t.tags.length).toBeGreaterThan(0)
    expect(t.tags.every((x) => TAG.test(x))).toBe(true)
    expect(['high', 'medium', 'low']).toContain(t.severity_guess)
  }
})

test('신뢰 경계 평가용 정답 목록: R-35·R-36·R-37·R-39를 겨냥한 태그(LLM02·LLM06·LLM01·T0886)가 모두 있다', () => {
  const tags = new Set(gt.structures['vendor-remote-control'].threats.flatMap((t) => t.tags))
  expect(tags.has('LLM02')).toBe(true)
  expect(tags.has('LLM06')).toBe(true)
  expect(tags.has('LLM01')).toBe(true)
  expect(tags.has('T0886')).toBe(true)
})

test('신뢰 경계 평가용 구조: R-35·R-36·R-37·R-39가 실제로 발동한다', () => {
  const r = evaluateAll([TRUST_BOUNDARY_SAMPLE], RULES, gt as unknown as GroundTruth)
  const fired = new Set(r.structures[0].fired.map((f) => f.ruleId))
  expect(fired.has('R-35')).toBe(true)
  expect(fired.has('R-36')).toBe(true)
  expect(fired.has('R-37')).toBe(true)
  expect(fired.has('R-39')).toBe(true)
})

test('실제 규칙·정답으로 잰 결과가 고정되어 있다 (규칙이나 정답을 바꾸면 이 값이 바뀐다)', () => {
  const r = evaluateAll([TRUST_BOUNDARY_SAMPLE], RULES, gt as unknown as GroundTruth)
  expect([r.threatTotal, r.found, r.strict, r.comparable, r.matchedFired, r.untagged]).toEqual([6, 6, 6, 21, 19, 0])
  expect(ratio(r.found, r.threatTotal)).toBe(1)
  expect(ratio(r.strict, r.threatTotal)).toBe(1)
})
