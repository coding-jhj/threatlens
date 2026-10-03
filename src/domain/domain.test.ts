import { expect, test } from 'vitest'
import { ATTRIBUTES, ATTRIBUTE_IDS } from './attributes'
import { PARTS, PART_GROUPS, getPart } from './parts'
import { loadRules, parseCondition, validateRules } from './rules'

const valid = () => ({
  id: 'R-50',
  title: '테스트',
  summary: '요약',
  story: ['원인', 'AI', '결과'],
  category: 'tool-abuse',
  hazard: 'misuse',
  severity: 'medium',
  when: ['tool.exec', '!human.approval'],
  fixes: [{ id: 'a', label: '대응', score: -10, effort: 'low' }],
  basis: [{ source: 'unverified' }],
})
const errorsOf = (r: unknown) => {
  const res = validateRules([r])
  return res.ok ? [] : res.errors
}

test('속성 12개, 라벨·종류 정의 일치', () => {
  expect(ATTRIBUTE_IDS).toHaveLength(12)
  expect(ATTRIBUTES.map((a) => a.id)).toEqual([...ATTRIBUTE_IDS])
  expect(ATTRIBUTES.filter((a) => a.kind === 'mitigation').map((a) => a.id)).toEqual(['human.approval', 'interlock.external'])
})

test('부품: id 유일, 그룹 소속, 기본 속성은 유효', () => {
  expect(new Set(PARTS.map((p) => p.id)).size).toBe(PARTS.length)
  expect(PARTS.every((p) => PART_GROUPS.includes(p.group))).toBe(true)
  expect(PARTS.flatMap((p) => p.defaults).every((a) => (ATTRIBUTE_IDS as readonly string[]).includes(a))).toBe(true)
  expect(getPart('control_api')?.defaults).toContain('link.control')
  expect(getPart('없음')).toBeUndefined()
})

test('parseCondition: 부정 접두사와 알 수 없는 속성', () => {
  expect(parseCondition('!human.approval')).toEqual({ attribute: 'human.approval', negated: true })
  expect(parseCondition('tool.send')).toEqual({ attribute: 'tool.send', negated: false })
  expect(parseCondition('x.y')).toBeNull()
})

test('정상 규칙은 통과', () => {
  expect(validateRules([valid()]).ok).toBe(true)
})

test.each([
  ['id 형식', { ...valid(), id: 'X1' }, 'R-01'],
  ['빈 title', { ...valid(), title: ' ' }, 'title'],
  ['잘못된 category', { ...valid(), category: 'foo' }, 'category'],
  ['잘못된 severity', { ...valid(), severity: 'critical' }, 'severity'],
  ['빈 when', { ...valid(), when: [] }, 'when'],
  ['알 수 없는 속성', { ...valid(), when: ['nope'] }, '알 수 없는 속성'],
  ['모순 조건', { ...valid(), when: ['tool.exec', '!tool.exec'] }, '모순'],
  ['중복 조건', { ...valid(), when: ['tool.exec', 'tool.exec'] }, '중복'],
  ['부정만 있는 when', { ...valid(), when: ['!human.approval'] }, '부정'],
  ['빈 fixes', { ...valid(), fixes: [] }, 'fixes'],
  ['양수 score', { ...valid(), fixes: [{ id: 'a', label: 'x', score: 5, effort: 'low' }] }, 'score'],
  ['story 2줄', { ...valid(), story: ['a', 'b'] }, 'story'],
  ['story 빈 줄', { ...valid(), story: ['a', '', 'c'] }, 'story'],
  ['hazard 값 오류', { ...valid(), hazard: 'fire' }, 'hazard'],
  ['effort 누락', { ...valid(), fixes: [{ id: 'a', label: 'x', score: -1 }] }, 'effort'],
  ['effort 값 오류', { ...valid(), fixes: [{ id: 'a', label: 'x', score: -1, effort: 'easy' }] }, 'effort'],
  ['소수 score', { ...valid(), fixes: [{ id: 'a', label: 'x', score: -1.5, effort: 'low' }] }, 'score'],
  ['fix id 중복', { ...valid(), fixes: [{ id: 'a', label: 'x', score: -1, effort: 'low' }, { id: 'a', label: 'y', score: -2, effort: 'low' }] }, '중복'],
  ['sets 오류', { ...valid(), fixes: [{ id: 'a', label: 'x', score: -1, effort: 'low', sets: 'zzz' }] }, 'sets'],
  ['빈 basis', { ...valid(), basis: [] }, 'basis'],
  ['근거에 url 없음', { ...valid(), basis: [{ source: 'OWASP-LLM', ref: 'LLM01' }] }, 'url'],
  ['http url', { ...valid(), basis: [{ source: 'OWASP-LLM', ref: 'LLM01', url: 'http://x' }] }, 'url'],
])('검증 오류: %s', (_n, rule, expected) => {
  expect(errorsOf(rule).join('\n')).toContain(expected)
})

test('검증된 근거는 통과', () => {
  const r = { ...valid(), basis: [{ source: 'OWASP-LLM', ref: 'LLM01', url: 'https://genai.owasp.org/' }] }
  expect(validateRules([r]).ok).toBe(true)
})

test('id 중복과 배열 아님', () => {
  const dup = validateRules([valid(), valid()])
  expect(dup.ok ? '' : dup.errors.join()).toContain('중복')
  expect(validateRules({}).ok).toBe(false)
})

test('loadRules: 오류 시 한글 메시지로 throw', () => {
  expect(() => loadRules([{ ...valid(), severity: 'x' }])).toThrow('규칙 파일 오류')
})
