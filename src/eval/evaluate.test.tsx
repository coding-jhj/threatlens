import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import raw from '../../docs/eval/ground-truth.json?raw'
import { RULES } from '../data'
import type { Rule } from '../domain/rules'
import { SAMPLES } from '../samples/samples'
import { evaluateAll, ratio, ruleTags, type GroundTruth } from './evaluate'
import EvalPage from './EvalPage'

const rule = (id: string, basis: Rule['basis'], when: string[]): Rule => ({
  id,
  title: `규칙 ${id}`,
  summary: 's',
  story: ['가', '나', '다'],
  category: 'data-leak',
  hazard: 'leak',
  severity: 'high',
  when,
  fixes: [{ id: 'f', label: 'f', score: -10, effort: 'low' }],
  basis,
})

test('ruleTags: OWASP·ATT&CK ICS·CISA·IEC만 뽑고 ATLAS는 뽑지 않는다', () => {
  const r = rule(
    'X',
    [
      { source: 'OWASP-LLM', ref: 'LLM06:2025 Excessive Agency' },
      { source: 'OWASP-LLM', ref: 'LLM10:2025 Unbounded Consumption' },
      { source: 'MITRE-ATLAS', ref: 'AML.T0051 LLM Prompt Injection' },
      { source: 'MITRE-ATTACK-ICS', ref: 'ATT&CK for ICS T1692.002 Unauthorized Message' },
      { source: 'CISA-AI-OT', ref: 'x' },
      { source: 'IEC-61511', ref: 'y' },
    ],
    ['input.untrusted'],
  )
  expect(ruleTags(r)).toEqual(['LLM06', 'LLM10', 'OT-HUMAN-OVERSIGHT', 'SIS-INDEPENDENCE', 'T1692.002'])
  expect(ruleTags(rule('Y', [{ source: 'MITRE-ATLAS', ref: 'AML.T0053' }], ['input.untrusted']))).toEqual([])
})

test('ratio: 분모 0이면 null', () => {
  expect(ratio(1, 4)).toBe(0.25)
  expect(ratio(0, 0)).toBeNull()
})

// 손계산용: 메일 비서 구조(웹/메일→AI→메일 전송). 규칙 둘만 쓴다.
const mail = SAMPLES.find((s) => s.id === 'mail-assistant')!
const rules = [
  rule('A', [{ source: 'OWASP-LLM', ref: 'LLM01:2025' }], ['input.untrusted', 'tool.send']), // 발동, 태그 LLM01
  rule('B', [{ source: 'OWASP-LLM', ref: 'LLM04:2025' }], ['input.untrusted', 'tool.send']), // 발동, 태그 LLM04 (정답에 없음)
  rule('C', [{ source: 'OWASP-LLM', ref: 'LLM02:2025' }], ['tool.exec']), // 발동 안 함
]
const gt: GroundTruth = {
  status: 'test',
  structures: {
    'mail-assistant': {
      applicability: {},
      threats: [
        { id: 't1', statement: 'a', tags: ['LLM01'], why: '', severity_guess: 'high' }, // A로 찾음 (느슨·엄격)
        { id: 't2', statement: 'b', tags: ['LLM01', 'LLM02'], why: '', severity_guess: 'high' }, // 느슨만 (LLM02 못 덮음)
        { id: 't3', statement: 'c', tags: ['LLM09'], why: '', severity_guess: 'low' }, // 놓침
      ],
    },
  },
}

test('evaluateAll: 손계산과 같다 (재현율 느슨 2/3, 엄격 1/3, 경보 적중 1/2)', () => {
  const r = evaluateAll([mail], rules, gt)
  const s = r.structures[0]
  expect(s.threats.map((t) => [t.found, t.strict])).toEqual([
    [true, true],
    [true, false],
    [false, false],
  ])
  expect(s.threats[1].uncoveredTags).toEqual(['LLM02'])
  expect(s.threats[0].matchedRuleIds).toEqual(['A'])
  expect(s.fired.map((f) => [f.ruleId, f.inGroundTruth])).toEqual([
    ['A', true],
    ['B', false],
  ])
  expect([r.threatTotal, r.found, r.strict, r.comparable, r.matchedFired, r.untagged]).toEqual([3, 2, 1, 2, 1, 0])
})

test('evaluateAll: 태그 없는 규칙은 적중률 계산에서 빠지고 따로 센다', () => {
  const tagless = rule('T', [{ source: 'MITRE-ATLAS', ref: 'AML.T0053' }], ['input.untrusted', 'tool.send'])
  const r = evaluateAll([mail], [tagless], gt)
  expect(r.structures[0].fired[0].inGroundTruth).toBeNull()
  expect([r.comparable, r.untagged]).toEqual([0, 1])
})

test('실제 규칙·정답으로 잰 결과가 고정되어 있다 (규칙이나 정답을 바꾸면 이 값이 바뀐다)', () => {
  const r = evaluateAll(SAMPLES, RULES, JSON.parse(raw) as GroundTruth)
  expect([r.threatTotal, r.found, r.strict, r.comparable, r.matchedFired, r.untagged]).toEqual([29, 22, 16, 44, 37, 0])
  expect(r.structures.map((s) => [s.id, s.foundCount, s.strictCount])).toEqual([
    ['doc-qa', 3, 3],
    ['support-bot', 5, 5],
    ['code-agent', 5, 2],
    ['mail-assistant', 4, 4],
    ['process-assistant', 5, 2],
  ])
})

test('EvalPage: 요약 숫자, 놓친 위협 7개, 정답에 없는 경보 7개를 그대로 보여준다', () => {
  render(<EvalPage />)
  expect(screen.getByText('76%')).toBeTruthy()
  expect(screen.getByText('55%')).toBeTruthy()
  expect(screen.getByText('84%')).toBeTruthy()
  expect(screen.getByRole('heading', { name: '놓친 위협 (7개)' })).toBeTruthy()
  expect(within(screen.getByRole('list', { name: '놓친 위협' })).getAllByRole('listitem')).toHaveLength(7)
  expect(screen.getByRole('heading', { name: '정답에 없는 경보 (7개)' })).toBeTruthy()
  expect(screen.getByText(/정답 작성: AI/)).toBeTruthy()
  expect(screen.getByText(/사람 전문가의 검수는 거치지 않았습니다/)).toBeTruthy()
})
