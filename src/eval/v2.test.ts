import { expect, test } from 'vitest'
import addRaw from '../../docs/eval/ground-truth-additions.json?raw'
import raw from '../../docs/eval/ground-truth.json?raw'
import { RULES } from '../data'
import { SAMPLES } from '../samples/samples'
import { evaluateAll, type GroundTruth, type GtThreat } from './evaluate'

const v1 = JSON.parse(raw) as GroundTruth
const add = JSON.parse(addRaw) as { structures: Record<string, { threats: GtThreat[] }> }
const v2: GroundTruth = {
  ...v1,
  structures: Object.fromEntries(Object.entries(v1.structures).map(([id, s]) => [id, { ...s, threats: [...s.threats, ...(add.structures[id]?.threats ?? [])] }])),
}
const TAG = /^LLM(0[1-9]|10)$/

test('보충 정답: 구조 이름과 id, 태그 형식이 맞는다', () => {
  const ids = new Set(Object.keys(v1.structures))
  const all = Object.entries(add.structures).flatMap(([sid, s]) => {
    expect(ids.has(sid)).toBe(true)
    return s.threats.map((t) => ({ sid, t }))
  })
  expect(all.length).toBe(7)
  for (const { sid, t } of all) {
    expect(t.id.startsWith(`GT-${sid}-`)).toBe(true)
    expect(t.tags.every((x) => TAG.test(x))).toBe(true)
  }
})

test('v1 수치는 그대로이고, 보충 7개를 넣으면 재현율이 어떻게 달라지는지 고정한다', () => {
  const a = evaluateAll(SAMPLES, RULES, v1)
  const b = evaluateAll(SAMPLES, RULES, v2)
  expect([a.threatTotal, a.found, a.strict]).toEqual([29, 21, 15])
  expect(b.threatTotal).toBe(36)
  expect([b.found, b.strict]).toEqual([25, 19]) // 느슨 69%, 엄격 53%
  expect(b.matchedFired).toBe(29)
})
