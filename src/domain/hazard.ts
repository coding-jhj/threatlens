import { isAiNode, type Graph } from './graph'
import { HAZARDS, type Hazard, type Rule } from './rules'
import { scoreGraph } from './score'

/** 마름모 한 칸이 1 올라가는 데 필요한 남은 위험의 크기 (높음 규칙 하나의 절반) */
export const LEVEL_STEP = 0.075
export const MAX_LEVEL = 4

export type HazardLevels = Record<Hazard, number>

/**
 * 위험 마름모 값 = 그 칸에 속한 규칙들의 "남은 위험"(점수식의 위협별 위험) 합을 LEVEL_STEP으로 나눠 올림, 최대 4.
 * AI 부품이 여럿이면 칸마다 가장 큰 값을 쓴다. 위협이 하나라도 있으면 대응을 다 해도 1 이상이다(점수식의 잔여 바닥과 같은 뜻).
 */
export function hazardLevels(graph: Graph, rules: readonly Rule[], applied: ReadonlySet<string> = new Set()): HazardLevels {
  const hazardOf = new Map(rules.map((r) => [r.id, r.hazard]))
  const { findings } = scoreGraph(graph, rules, applied)
  const levels: HazardLevels = { inject: 0, leak: 0, misuse: 0, plant: 0 }
  for (const ai of graph.nodes.filter(isAiNode)) {
    for (const h of HAZARDS) {
      const sum = findings.filter((f) => f.nodeId === ai.id && hazardOf.get(f.ruleId) === h).reduce((s, f) => s + f.risk, 0)
      const level = sum <= 1e-12 ? 0 : Math.min(MAX_LEVEL, Math.ceil(sum / LEVEL_STEP - 1e-9))
      levels[h] = Math.max(levels[h], level)
    }
  }
  return levels
}
