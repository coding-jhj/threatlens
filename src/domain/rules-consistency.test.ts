import { describe, expect, test } from 'vitest'
import { RULES } from '../data'
import type { Rule } from './rules'

/**
 * 규칙 데이터(story·hazard·effort·score)가 서로 어긋나지 않는지 기계가 확인한다.
 * 사람이 쓴 값이 "맞는지"는 증명하지 못하지만, 규칙이 늘어날 때 생기는 흔한 실수는 막는다.
 */

/** 주된 위험의 성격을 조건만으로 정하는 순서 규칙 (JSON의 hazard와 별개로 적은 것) */
function deriveHazard(when: string[]): Rule['hazard'] {
  const has = (a: string) => when.includes(a)
  if (has('link.control')) return 'plant'
  if (has('data.sensitive') || (has('model.external') && (has('log.store') || has('input.sensor')))) return 'leak'
  if (has('input.untrusted')) return 'inject'
  return 'misuse'
}

/** 조건 속성마다, 시나리오 3줄 어딘가에 그 속성을 가리키는 낱말이 있어야 한다 */
const WORDS: Record<string, RegExp> = {
  'input.untrusted': /믿을 수 없|외부 (문서|글)|공격자|숨은/,
  'data.sensitive': /민감|고객 정보|개인정보|내부 정보|기밀/,
  'tool.send': /전송|보내|메일|밖으로|API/,
  'tool.write': /변경|수정|쓰기|고치|바꾸|바꿔/,
  'tool.exec': /실행|코드/,
  'model.external': /외부 업체|업체/,
  'human.approval': /승인/,
  'log.store': /로그|저장|기록|기억/,
  'store.writable': /저장소/,
  'input.sensor': /센서|공정 조건|수치/,
  'link.control': /설비|제어|밸브/,
}
const ABSENT_WORDS: Record<string, RegExp> = {
  'human.approval': /없이|않|아무도|검수/,
  'interlock.external': /인터록|보호 장치|보호 계층|SIS/,
}

describe.each(RULES.map((r) => [r.id, r] as const))('%s 일관성', (_id, rule) => {
  test('위험의 성격(hazard)이 조건에서 유도한 값과 같다', () => {
    expect(rule.hazard).toBe(deriveHazard(rule.when))
  })

  test('시나리오가 조건 속성을 모두 언급한다', () => {
    const text = rule.story.join(' ')
    for (const cond of rule.when) {
      const neg = cond.startsWith('!')
      const attr = neg ? cond.slice(1) : cond
      const re = neg ? ABSENT_WORDS[attr] : WORDS[attr]
      expect(re, `${cond}에 대한 낱말 규칙이 없습니다`).toBeDefined()
      expect(re!.test(text), `${rule.id}: "${cond}" 관련 표현이 시나리오에 없습니다`).toBe(true)
    }
  })

  test('시나리오 3줄은 문장이 끝나고, 너무 길지 않고, 자리표시 문구가 없다', () => {
    expect(rule.story).toHaveLength(3)
    for (const line of rule.story) {
      expect(line.length).toBeGreaterThanOrEqual(15)
      expect(line.length).toBeLessThanOrEqual(110)
      expect(/[.!?]$/.test(line)).toBe(true)
      expect(/TBD|TODO|XXX|lorem/i.test(line)).toBe(false)
    }
  })

  test('대응은 2개 이상이고, 어렵지 않은 대응이 하나는 있다', () => {
    expect(rule.fixes.length).toBeGreaterThanOrEqual(2)
    expect(rule.fixes.some((f) => f.effort !== 'high')).toBe(true)
  })

  test('대응 점수는 -10~-35 범위이고, 높음 위협에는 -30 이하 대응이 있다', () => {
    for (const f of rule.fixes) {
      expect(f.score).toBeLessThanOrEqual(-10)
      expect(f.score).toBeGreaterThanOrEqual(-35)
    }
    if (rule.severity === 'high') expect(Math.min(...rule.fixes.map((f) => f.score))).toBeLessThanOrEqual(-30)
  })
})

describe('규칙 전체', () => {
  test('같은 대응 id는 난이도가 모두 같다 (규칙마다 다르게 매기지 않았다)', () => {
    const seen = new Map<string, Set<string>>()
    for (const r of RULES) for (const f of r.fixes) seen.set(f.id, (seen.get(f.id) ?? new Set()).add(f.effort))
    const bad = [...seen].filter(([, v]) => v.size > 1).map(([k]) => k)
    expect(bad).toEqual([])
  })

  test('시나리오 줄은 규칙 사이에 겹치지 않는다', () => {
    const lines = RULES.flatMap((r) => r.story)
    expect(new Set(lines).size).toBe(lines.length)
  })

  test('위험 성격 네 가지가 모두 쓰인다', () => {
    expect(new Set(RULES.map((r) => r.hazard))).toEqual(new Set(['inject', 'leak', 'misuse', 'plant']))
  })
})
