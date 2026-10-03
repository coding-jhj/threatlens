import { describe, expect, test } from 'vitest'
import { RULES } from '../data'
import { appliedKey } from './engine'
import type { Graph } from './graph'
import { analyze } from './analyze'
import type { Rule } from './rules'
import { RESIDUAL_FLOOR, SEVERITY_WEIGHT, compareScores, scoreGraph } from './score'

const rule = (id: string, severity: Rule['severity'], when: string[], fixes: Rule['fixes']): Rule => ({
  id,
  title: id,
  summary: id,
  category: 'tool-abuse',
  severity,
  when,
  fixes,
  basis: [{ source: 'unverified' }],
})
const fx = (id: string, score: number, sets?: Rule['fixes'][number]['sets']) => ({ id, label: id, score, effort: 'low' as const, ...(sets ? { sets } : {}) })

/** AI 노드 하나 + 이웃 노드에 속성 */
const g = (attrs: Graph['nodes'][number]['attributes']): Graph => ({
  nodes: [{ id: 'ai', partId: 'ai_agent', attributes: [] }, { id: 'x', partId: 'user', attributes: attrs }],
  edges: [{ id: 'e', from: 'x', to: 'ai' }],
})

describe('점수 손계산 일치 (직접 만든 규칙으로)', () => {
  const A = rule('R-91', 'high', ['tool.exec'], [fx('a', -30), fx('b', -20), fx('c', -50)])
  const B = rule('R-92', 'medium', ['tool.exec'], [fx('d', -40)])

  test('가중치 상수', () => {
    expect(SEVERITY_WEIGHT).toEqual({ high: 0.15, medium: 0.07, low: 0.02 })
    expect(RESIDUAL_FLOOR).toBe(0.1)
  })

  test('위협 없음 → 0점', () => {
    expect(scoreGraph(g([]), [A]).overall).toBe(0)
  })

  test('높음 1개, 대응 없음 → 15점', () => {
    expect(scoreGraph(g(['tool.exec']), [A]).overall).toBe(15)
  })

  test('높음 1개 + 대응 −30 → 0.15×0.7=0.105 → 11점', () => {
    expect(scoreGraph(g(['tool.exec']), [A], new Set([appliedKey('ai', 'R-91', 'a')])).overall).toBe(11)
  })

  test('대응 −30, −20 → 0.15×0.5=0.075 → 8점 (7.5 반올림)', () => {
    const s = scoreGraph(g(['tool.exec']), [A], new Set([appliedKey('ai', 'R-91', 'a'), appliedKey('ai', 'R-91', 'b')]))
    expect(s.overall).toBe(8)
    expect(s.findings[0].fixReduction).toBe(50)
    expect(s.findings[0].appliedFixIds).toEqual(['a', 'b'])
  })

  test('대응 합이 100을 넘어도 바닥값 10% 유지 → 0.015 → 2점', () => {
    const all = new Set(['a', 'b', 'c'].map((id) => appliedKey('ai', 'R-91', id)))
    expect(scoreGraph(g(['tool.exec']), [A], all).overall).toBe(2)
  })

  test('높음 + 중간 겹침 → 1−0.85×0.93=0.2095 → 21점', () => {
    expect(scoreGraph(g(['tool.exec']), [A, B]).overall).toBe(21)
  })

  test('높음 2개(같은 AI) → 1−0.85²=0.2775 → 28점', () => {
    const A2 = rule('R-93', 'high', ['tool.exec'], [fx('z', -10)])
    expect(scoreGraph(g(['tool.exec']), [A, A2]).overall).toBe(28)
  })

  test('낮음 1개 → 2점', () => {
    expect(scoreGraph(g(['tool.exec']), [rule('R-94', 'low', ['tool.exec'], [fx('a', -5)])]).overall).toBe(2)
  })

  test('발동하지 않는 규칙에 걸린 대응 표시는 점수에 영향 없음', () => {
    expect(scoreGraph(g(['tool.exec']), [A], new Set([appliedKey('ai', 'R-99', 'a')])).overall).toBe(15)
  })

  test('전체 점수는 AI 노드별 점수의 최댓값', () => {
    const two: Graph = {
      nodes: [
        { id: 'a1', partId: 'ai_agent', attributes: [] },
        { id: 'a2', partId: 'ai_agent', attributes: [] },
        { id: 'x', partId: 'user', attributes: ['tool.exec'] },
        { id: 'y', partId: 'user', attributes: ['tool.exec'] },
      ],
      edges: [
        { id: '1', from: 'x', to: 'a1' },
        { id: '2', from: 'y', to: 'a2' },
        { id: '3', from: 'y', to: 'a2' },
      ],
    }
    const s = scoreGraph(two, [A, B])
    expect(s.byNode).toEqual({ a1: 21, a2: 21 })
    expect(s.overall).toBe(21)
    const s2 = scoreGraph(two, [A, B], new Set([appliedKey('a1', 'R-91', 'a'), appliedKey('a1', 'R-91', 'b'), appliedKey('a1', 'R-91', 'c'), appliedKey('a1', 'R-92', 'd')]))
    expect(s2.byNode.a1).toBeLessThan(s2.byNode.a2)
    expect(s2.overall).toBe(s2.byNode.a2)
  })

  test('compareScores', () => {
    const r = compareScores(g(['tool.exec']), [A], new Set([appliedKey('ai', 'R-91', 'a')]))
    expect(r).toEqual({ before: 15, after: 11, delta: -4 })
  })
})

describe('실제 규칙 28개와 시안 구조', () => {
  const sample: Graph = {
    nodes: [
      { id: 'doc', partId: 'upload_doc', attributes: ['input.untrusted'] },
      { id: 'sensor', partId: 'sensor', attributes: ['input.sensor'] },
      { id: 'ai', partId: 'ai_agent', attributes: ['data.sensitive'] },
      { id: 'mail', partId: 'mail_tool', attributes: ['tool.send'] },
      { id: 'ext', partId: 'external_party', attributes: [] },
      { id: 'ctl', partId: 'control_api', attributes: ['tool.write', 'link.control'] },
      { id: 'plc', partId: 'plc', attributes: [] },
    ],
    edges: [
      { id: '1', from: 'doc', to: 'ai' },
      { id: '2', from: 'sensor', to: 'ai' },
      { id: '3', from: 'ai', to: 'mail' },
      { id: '4', from: 'mail', to: 'ext' },
      { id: '5', from: 'ai', to: 'ctl' },
      { id: '6', from: 'ctl', to: 'plc' },
    ],
  }
  const allKeys = () => {
    const s = scoreGraph(sample, RULES)
    return s.findings.flatMap((f) => RULES.find((r) => r.id === f.ruleId)!.fixes.map((x) => appliedKey(f.nodeId, f.ruleId, x.id)))
  }

  test('대응 전 점수는 높고(≥70), 0~100 정수', () => {
    const s = scoreGraph(sample, RULES)
    expect(s.overall).toBeGreaterThanOrEqual(70)
    expect(s.overall).toBeLessThanOrEqual(100)
    expect(Number.isInteger(s.overall)).toBe(true)
  })

  test('사람 승인 대응 1개만 적용해도 점수가 내려간다', () => {
    const r = compareScores(sample, RULES, new Set([appliedKey('ai', 'R-01', 'human_approval')]))
    expect(r.delta).toBeLessThan(0)
  })

  test('대응을 모두 적용해도 0이 되지 않는다 (잔여 위험)', () => {
    const r = scoreGraph(sample, RULES, new Set(allKeys()))
    expect(r.overall).toBeGreaterThan(0)
    expect(r.overall).toBeLessThan(scoreGraph(sample, RULES).overall)
  })

  test('단조성: 대응책을 더 적용하면 점수가 올라가지 않는다 (무작위 부분집합 200회)', () => {
    const keys = allKeys()
    let seed = 7
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let i = 0; i < 200; i++) {
      const sub = new Set(keys.filter(() => rnd() < 0.4))
      const bigger = new Set([...sub, ...keys.filter(() => rnd() < 0.3)])
      expect(scoreGraph(sample, RULES, bigger).overall).toBeLessThanOrEqual(scoreGraph(sample, RULES, sub).overall)
    }
  })

  test('분석(경로)과 점수가 같은 발동 목록을 쓴다', () => {
    expect(scoreGraph(sample, RULES).findings.map((f) => f.ruleId)).toEqual(analyze(sample, RULES).findings.map((f) => f.ruleId))
  })
})
