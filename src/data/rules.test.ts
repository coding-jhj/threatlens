import { expect, test } from 'vitest'
import { RULES } from '.'
import { CATEGORIES, parseCondition } from '../domain/rules'
import rawRules from './rules.json'

const OWASP_REFS = [
  'LLM01:2025 Prompt Injection',
  'LLM02:2025 Sensitive Information Disclosure',
  'LLM03:2025 Supply Chain',
  'LLM04:2025 Data and Model Poisoning',
  'LLM05:2025 Improper Output Handling',
  'LLM06:2025 Excessive Agency',
  'LLM07:2025 System Prompt Leakage',
  'LLM08:2025 Vector and Embedding Weaknesses',
  'LLM09:2025 Misinformation',
  'LLM10:2025 Unbounded Consumption',
]
const ATLAS_IDS = ['AML.T0051', 'AML.T0053', 'AML.T0057', 'AML.T0070', 'AML.T0080.000', 'AML.T0085.000', 'AML.T0086', 'AML.T0101']

test('규칙 28개, id가 R-01부터 R-28까지 연속', () => {
  expect(RULES).toHaveLength(28)
  expect(RULES.map((r) => r.id)).toEqual(Array.from({ length: 28 }, (_, i) => `R-${String(i + 1).padStart(2, '0')}`))
})

test('분류별 개수: 프롬프트 주입 5, 데이터 유출 7, 도구·권한 7, 저장소·로그 4, 화공 5', () => {
  const count = Object.fromEntries(CATEGORIES.map((c) => [c, RULES.filter((r) => r.category === c).length]))
  expect(count).toEqual({ 'prompt-injection': 5, 'data-leak': 7, 'tool-abuse': 7, 'store-log': 4, chem: 5 })
})

test('화공 규칙은 R-09~R-13', () => {
  expect(RULES.filter((r) => r.category === 'chem').map((r) => r.id)).toEqual(['R-09', 'R-10', 'R-11', 'R-12', 'R-13'])
})

test('모든 규칙에 대응책 2개 이상, 설명 문장 존재', () => {
  for (const r of RULES) {
    expect(r.fixes.length, r.id).toBeGreaterThanOrEqual(2)
    expect(r.summary.length, r.id).toBeGreaterThan(15)
  }
})

test('같은 조건 조합을 가진 규칙이 없다', () => {
  const keys = RULES.map((r) => [...r.when].sort().join('|'))
  expect(new Set(keys).size).toBe(RULES.length)
})

test('대응책 총합이 심각도에 비해 과하지 않다 (높음 ≤ 90, 그 외 ≤ 75)', () => {
  for (const r of RULES) {
    const total = -r.fixes.reduce((a, f) => a + f.score, 0)
    expect(total, r.id).toBeLessThanOrEqual(r.severity === 'high' ? 90 : 75)
  }
})

test('sets는 대응(mitigation) 속성만 가리킨다', () => {
  for (const r of RULES) for (const f of r.fixes) if (f.sets) expect(['human.approval', 'interlock.external']).toContain(f.sets)
})

test('부정 조건은 대응 속성에만 사용', () => {
  for (const r of RULES)
    for (const w of r.when) {
      const c = parseCondition(w)
      if (c?.negated) expect(['human.approval', 'interlock.external']).toContain(c.attribute)
    }
})

test('OWASP·MITRE 근거 번호는 검증된 목록에 있고 url이 https', () => {
  for (const r of RULES)
    for (const b of r.basis) {
      if (b.source === 'OWASP-LLM') expect(OWASP_REFS.some((o) => b.ref?.startsWith(o)), `${r.id} ${b.ref}`).toBe(true)
      if (b.source === 'MITRE-ATLAS') expect(ATLAS_IDS.some((a) => b.ref?.startsWith(a + ' ')), `${r.id} ${b.ref}`).toBe(true)
      if (b.source !== 'unverified') expect(b.url).toMatch(/^https:\/\//)
    }
})

test('화공 규칙은 공정·OT 분야 근거(ATT&CK for ICS, CISA, IEC 61511)를 최소 1개 가진다', () => {
  for (const r of RULES.filter((x) => x.category === 'chem'))
    expect(r.basis.some((b) => ['MITRE-ATTACK-ICS', 'CISA-AI-OT', 'IEC-61511'].includes(b.source)), r.id).toBe(true)
})

test('ATT&CK for ICS 근거는 확인한 기술 ID만 사용', () => {
  const ok = ['T1692.002', 'T1692.001', 'T0836', 'T0880']
  for (const r of RULES)
    for (const b of r.basis.filter((x) => x.source === 'MITRE-ATTACK-ICS')) expect(ok.some((id) => b.ref?.includes(id)), `${r.id} ${b.ref}`).toBe(true)
})

test('원본 JSON과 검증 결과가 같은 개수', () => {
  expect((rawRules as unknown[]).length).toBe(RULES.length)
})
