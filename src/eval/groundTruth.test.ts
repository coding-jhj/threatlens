import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { SAMPLES } from '../samples/samples'

interface Threat {
  id: string
  statement: string
  tags: string[]
  why: string
  severity_guess: string
}
interface GT {
  status: string
  structures: Record<string, { threats: Threat[]; applicability: Record<string, { applies: boolean; reason: string }> }>
}
const gt = JSON.parse(readFileSync('docs/eval/ground-truth.json', 'utf8')) as GT
const TAG = /^(LLM(0[1-9]|10)|T\d{4}(\.\d{3})?|SIS-INDEPENDENCE|OT-HUMAN-OVERSIGHT)$/

test('정답 목록: 구조가 예시 5개와 일치한다', () => {
  expect(Object.keys(gt.structures).sort()).toEqual(SAMPLES.map((s) => s.id).sort())
})

test.each(Object.entries(gt.structures))('정답 목록 %s: 형식이 올바르다', (id, s) => {
  expect(s.threats.length).toBeGreaterThanOrEqual(4)
  const ids = s.threats.map((t) => t.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const t of s.threats) {
    expect(t.id.startsWith(`GT-${id}-`)).toBe(true)
    expect(t.statement.length).toBeGreaterThan(10)
    expect(t.tags.length).toBeGreaterThan(0)
    expect(t.tags.every((x) => TAG.test(x))).toBe(true)
    expect(['high', 'medium', 'low']).toContain(t.severity_guess)
  }
  expect(Object.keys(s.applicability).sort()).toEqual(Array.from({ length: 10 }, (_, i) => `LLM${String(i + 1).padStart(2, '0')}`).sort())
})

test.each(Object.entries(gt.structures))('정답 목록 %s: 위협에 붙은 OWASP 태그는 "해당함"으로 표시된 항목뿐이다 (자기모순 방지)', (_id, s) => {
  for (const t of s.threats) for (const tag of t.tags.filter((x) => x.startsWith('LLM'))) expect(s.applicability[tag].applies, `${t.id} ${tag}`).toBe(true)
})
