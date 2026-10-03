import { describe, expect, test } from 'vitest'
import { RULES } from '../data'
import { isAiNode } from '../domain/graph'
import { getPart } from '../domain/parts'
import { planActions } from '../domain/plan'
import { scoreGraph } from '../domain/score'
import { QUESTIONS, VALID_ATTRIBUTES, buildFromAnswers } from './wizard'
import table from './wizard.json'

const combo = (n: number) => QUESTIONS.map((_, i) => ((n >> i) & 1) === 1)

describe('질문 마법사', () => {
  test('질문은 8개이고 규칙표의 부품·속성 이름이 모두 실제로 있다', () => {
    expect(QUESTIONS).toHaveLength(8)
    const effects = [table.base, ...table.questions.map((q) => q.yes)] as { nodes?: { part: string }[]; attrs?: { attr: string }[] }[]
    for (const e of effects) {
      for (const n of e.nodes ?? []) expect(getPart(n.part), n.part).toBeTruthy()
      for (const a of e.attrs ?? []) expect(VALID_ATTRIBUTES, a.attr).toContain(a.attr)
    }
  })

  test('256가지 답 조합 모두 유효한 구조다: AI 1개 이상, 끊긴 부품 없음, 중복·자기 연결 없음, 점수 계산 가능', () => {
    for (let n = 0; n < 256; n++) {
      const g = buildFromAnswers(combo(n))
      const ids = new Set(g.nodes.map((x) => x.id))
      expect(ids.size, `조합 ${n}`).toBe(g.nodes.length)
      expect(g.nodes.some(isAiNode), `조합 ${n} AI`).toBe(true)
      const linked = new Set(g.edges.flatMap((e) => [e.from, e.to]))
      for (const node of g.nodes) expect(linked.has(node.id), `조합 ${n} 끊긴 부품 ${node.id}`).toBe(true)
      const pairs = g.edges.map((e) => `${e.from}>${e.to}`)
      expect(new Set(pairs).size, `조합 ${n} 중복`).toBe(pairs.length)
      for (const e of g.edges) {
        expect(e.from).not.toBe(e.to)
        expect(ids.has(e.from) && ids.has(e.to), `조합 ${n} 연결 대상`).toBe(true)
      }
      const s = scoreGraph(g, RULES).overall
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
  })

  test('모두 아니오면 위협이 없고, 모두 예면 위협과 행동 계획이 나온다', () => {
    expect(scoreGraph(buildFromAnswers(combo(0)), RULES).findings).toHaveLength(0)
    const all = buildFromAnswers(combo(255))
    expect(scoreGraph(all, RULES).findings.length).toBeGreaterThan(3)
    expect(planActions(all, RULES).steps.length).toBeGreaterThan(0)
  })

  test('"예"를 더하면 점수가 내려가지 않는다고는 할 수 없지만, 위험 질문(외부인·메일·실행·설비)에 예하면 점수가 오른다', () => {
    const base = scoreGraph(buildFromAnswers(combo(0b00000000)), RULES).overall
    const risky = scoreGraph(buildFromAnswers(combo(0b00011111 & ~0b00100000)), RULES).overall
    expect(risky).toBeGreaterThan(base)
  })

  test('같은 답이면 항상 같은 구조다', () => {
    expect(buildFromAnswers(combo(173))).toEqual(buildFromAnswers(combo(173)))
  })
})
