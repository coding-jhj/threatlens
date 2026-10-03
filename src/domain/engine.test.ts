import { describe, expect, test } from 'vitest'
import { RULES } from '../data'
import type { AttributeId } from './attributes'
import { appliedKey, crossingEdgeIds, evaluate } from './engine'
import type { Graph } from './graph'
import { parseCondition, type Rule } from './rules'

/** AI 노드 1개 + 속성마다 이웃 노드 1개 (속성은 이웃에만 둔다) */
function star(attrs: AttributeId[], aiPart = 'ai_agent'): Graph {
  const nodes = [{ id: 'ai', partId: aiPart, attributes: [] as AttributeId[] }]
  const edges: Graph['edges'] = []
  attrs.forEach((a, i) => {
    nodes.push({ id: `n${i}`, partId: 'user', attributes: [a] })
    edges.push({ id: `e${i}`, from: `n${i}`, to: 'ai' })
  })
  return { nodes, edges }
}
const fired = (g: Graph, applied?: Set<string>) => evaluate(g, RULES, applied).map((f) => f.ruleId)

describe.each(RULES.map((r) => [r.id, r] as const))('%s', (_id, rule: Rule) => {
  const conds = rule.when.map((w) => parseCondition(w)!)
  const positives = conds.filter((c) => !c.negated).map((c) => c.attribute)
  const negatives = conds.filter((c) => c.negated).map((c) => c.attribute)

  test('조건을 모두 만족하면 발동', () => {
    expect(fired(star(positives))).toContain(rule.id)
  })

  test('발동 결과에 조건 속성의 출처 노드가 담김', () => {
    const f = evaluate(star(positives), RULES).find((x) => x.ruleId === rule.id)!
    expect(f.nodeId).toBe('ai')
    expect(f.severity).toBe(rule.severity)
    for (const p of positives) expect(f.sources[p]?.length).toBeGreaterThan(0)
  })

  test.each(positives.map((p) => [p]))('필요한 속성 %s가 빠지면 미발동', (missing) => {
    expect(fired(star(positives.filter((p) => p !== missing)))).not.toContain(rule.id)
  })

  test.each(negatives.map((n) => [n]))('없어야 할 속성 %s가 있으면 미발동', (extra) => {
    expect(fired(star([...positives, extra]))).not.toContain(rule.id)
  })

  test('속성이 AI 노드 자신에게 있어도 발동', () => {
    const g = star([])
    g.nodes[0].attributes = [...positives]
    expect(fired(g)).toContain(rule.id)
  })

  test('한 칸 건너(2단계) 떨어진 노드의 속성은 세지 않음', () => {
    const g: Graph = {
      nodes: [
        { id: 'ai', partId: 'ai_agent', attributes: [] },
        { id: 'mid', partId: 'user', attributes: [] },
        ...positives.map((a, i) => ({ id: `far${i}`, partId: 'user', attributes: [a] })),
      ],
      edges: [
        { id: 'e0', from: 'ai', to: 'mid' },
        ...positives.map((_, i) => ({ id: `ef${i}`, from: 'mid', to: `far${i}` })),
      ],
    }
    expect(fired(g)).not.toContain(rule.id)
  })
})

describe('엔진 일반 동작', () => {
  test('AI 노드가 없으면 아무것도 발동하지 않음', () => {
    const g: Graph = { nodes: [{ id: 'm', partId: 'mail_tool', attributes: ['tool.send', 'input.untrusted'] }], edges: [] }
    expect(evaluate(g, RULES)).toEqual([])
  })

  test('빈 그래프', () => {
    expect(evaluate({ nodes: [], edges: [] }, RULES)).toEqual([])
  })

  test('AI 노드가 둘이면 노드별로 따로 발동', () => {
    const g: Graph = {
      nodes: [
        { id: 'a1', partId: 'ai_agent', attributes: [] },
        { id: 'a2', partId: 'ai_model', attributes: [] },
        { id: 'doc', partId: 'upload_doc', attributes: ['input.untrusted'] },
        { id: 'mail', partId: 'mail_tool', attributes: ['tool.send'] },
      ],
      edges: [
        { id: '1', from: 'doc', to: 'a1' },
        { id: '2', from: 'a1', to: 'mail' },
        { id: '3', from: 'doc', to: 'a2' },
        { id: '4', from: 'a2', to: 'mail' },
      ],
    }
    const hits = evaluate(g, RULES).filter((f) => f.ruleId === 'R-01')
    expect(hits.map((h) => h.nodeId).sort()).toEqual(['a1', 'a2'])
  })

  test('간선 방향과 상관없이 이웃으로 본다', () => {
    const g = star(['input.untrusted', 'tool.send'])
    g.edges = g.edges.map((e) => ({ ...e, from: 'ai', to: e.from }))
    expect(fired(g)).toContain('R-01')
  })

  test('결과는 심각도(높음→낮음), 규칙 번호 순', () => {
    const out = evaluate(star(['input.untrusted', 'data.sensitive', 'tool.send', 'tool.write', 'log.store']), RULES)
    const order = { high: 0, medium: 1, low: 2 }
    for (let i = 1; i < out.length; i++) expect(order[out[i - 1].severity]).toBeLessThanOrEqual(order[out[i].severity])
  })

  test('대응책 sets: 사람 승인 대응책을 적용하면 !human.approval 규칙이 사라진다', () => {
    const g = star(['tool.write'])
    expect(fired(g)).toContain('R-04')
    const applied = new Set([appliedKey('ai', 'R-04', 'human_approval')])
    expect(fired(g, applied)).not.toContain('R-04')
  })

  test('대응책 sets는 해당 AI 노드에만 적용', () => {
    const g: Graph = {
      nodes: [
        { id: 'a1', partId: 'ai_agent', attributes: [] },
        { id: 'a2', partId: 'ai_agent', attributes: [] },
        { id: 'w', partId: 'user', attributes: ['tool.write'] },
      ],
      edges: [
        { id: '1', from: 'w', to: 'a1' },
        { id: '2', from: 'w', to: 'a2' },
      ],
    }
    const out = evaluate(g, RULES, new Set([appliedKey('a1', 'R-04', 'human_approval')]))
    expect(out.filter((f) => f.ruleId === 'R-04').map((f) => f.nodeId)).toEqual(['a2'])
  })

  test('한 대응책이 다른 규칙도 해소 (R-04의 승인이 R-24·R-28 같은 !승인 규칙에도 반영)', () => {
    const g = star(['tool.send', 'tool.write'])
    expect(fired(g)).toEqual(expect.arrayContaining(['R-04', 'R-24']))
    const out = fired(g, new Set([appliedKey('ai', 'R-04', 'human_approval')]))
    expect(out).not.toContain('R-04')
    expect(out).not.toContain('R-24')
  })

  test('화공 시안 구조: 센서→AI→제어 API에서 R-09 발동, 인터록 속성 추가 시 R-10 미발동', () => {
    const g: Graph = {
      nodes: [
        { id: 'ai', partId: 'ai_agent', attributes: [] },
        { id: 's', partId: 'sensor', attributes: ['input.sensor', 'input.untrusted'] },
        { id: 'c', partId: 'control_api', attributes: ['tool.write', 'link.control'] },
      ],
      edges: [
        { id: '1', from: 's', to: 'ai' },
        { id: '2', from: 'ai', to: 'c' },
      ],
    }
    expect(fired(g)).toEqual(expect.arrayContaining(['R-09', 'R-10', 'R-12', 'R-13']))
    g.nodes[0].attributes = ['interlock.external']
    expect(fired(g)).not.toContain('R-10')
    expect(fired(g)).toContain('R-09')
  })

  test('R-10: 믿을 수 없는 입력이 없어도, 센서만으로 AI가 제어에 닿으면 인터록 부재를 알린다', () => {
    const g: Graph = {
      nodes: [
        { id: 'ai', partId: 'ai_agent', attributes: [] },
        { id: 's', partId: 'sensor', attributes: ['input.sensor'] },
        { id: 'c', partId: 'control_api', attributes: ['tool.write', 'link.control'] },
      ],
      edges: [
        { id: '1', from: 's', to: 'ai' },
        { id: '2', from: 'ai', to: 'c' },
      ],
    }
    expect(fired(g)).toContain('R-10')
    expect(fired(g)).not.toContain('R-13') // 믿을 수 없는 입력이 없으므로 R-13은 그대로 미발동
    expect(fired(g, new Set([appliedKey('ai', 'R-10', 'interlock')]))).not.toContain('R-10')
  })
})

describe('신뢰 경계 (zone.outside → boundary.cross)', () => {
  const mk = (outsideIds: string[]): Graph => ({
    nodes: [
      { id: 'ai', partId: 'ai_agent', attributes: [] },
      { id: 'db', partId: 'doc_store', attributes: ['data.sensitive'] },
      { id: 'srv', partId: 'model_server', attributes: ['model.external', ...(outsideIds.includes('srv') ? (['zone.outside'] as AttributeId[]) : [])] },
    ],
    edges: [
      { id: 'e1', from: 'db', to: 'ai' },
      { id: 'e2', from: 'ai', to: 'srv' },
    ],
  })

  test('사외 부품이 없으면 경계를 넘는 연결도 없고 R-35는 발동하지 않는다', () => {
    expect(crossingEdgeIds(mk([]))).toEqual([])
    expect(fired(mk([]))).not.toContain('R-35')
  })

  test('사외 부품과 사내 부품을 잇는 연결만 경계를 넘는 연결이다', () => {
    expect(crossingEdgeIds(mk(['srv']))).toEqual(['e2'])
  })

  test('경계를 넘는 AI가 민감정보에 접근하면 R-35가 발동한다', () => {
    expect(fired(mk(['srv']))).toContain('R-35')
  })

  test('양 끝이 모두 사외이면 경계를 넘지 않는다', () => {
    const g = mk(['srv'])
    g.nodes[0].attributes = ['zone.outside']
    g.edges = [{ id: 'e2', from: 'ai', to: 'srv' }]
    expect(crossingEdgeIds(g)).toEqual([])
  })
})
