import { evaluate, appliedKey, type Finding } from './engine'
import { isAiNode, type Graph } from './graph'
import type { Rule } from './rules'
import type { Severity } from '../ui/severity'

/** 심각도별 "위협 하나가 발동했을 때의 위험" (확률처럼 다룬 값, 0~1) */
export const SEVERITY_WEIGHT: Record<Severity, number> = { high: 0.15, medium: 0.07, low: 0.02 }
/** 대응책을 모두 적용해도 위험은 이 비율만큼 남는다 (위험이 0이 되는 일은 없다) */
export const RESIDUAL_FLOOR = 0.1

export interface ScoredFinding extends Finding {
  base: number
  fixReduction: number
  residualFraction: number
  risk: number
  appliedFixIds: string[]
}

export interface Score {
  /** AI 노드별 점수 중 가장 높은 값 (0~100 정수) */
  overall: number
  byNode: Record<string, number>
  findings: ScoredFinding[]
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/**
 * 위협 하나의 남은 위험 = 기본 위험 × max(바닥값, 1 − 적용한 대응책 점수 합/100)
 * AI 노드의 점수 = 100 × (1 − Π(1 − 위협별 남은 위험))  ← 위협이 겹칠수록 100에 가까워진다
 * 전체 점수 = AI 노드 점수의 최댓값
 */
export function scoreGraph(graph: Graph, rules: readonly Rule[], applied: ReadonlySet<string> = new Set()): Score {
  const ruleById = new Map(rules.map((r) => [r.id, r]))
  const findings: ScoredFinding[] = evaluate(graph, rules, applied).map((f) => {
    const rule = ruleById.get(f.ruleId)!
    const used = rule.fixes.filter((fx) => applied.has(appliedKey(f.nodeId, f.ruleId, fx.id)))
    const fixReduction = -used.reduce((sum, fx) => sum + fx.score, 0)
    const residualFraction = Math.max(RESIDUAL_FLOOR, clamp01(1 - fixReduction / 100))
    const base = SEVERITY_WEIGHT[f.severity]
    return { ...f, base, fixReduction, residualFraction, risk: base * residualFraction, appliedFixIds: used.map((x) => x.id) }
  })

  const byNode: Record<string, number> = {}
  for (const ai of graph.nodes.filter(isAiNode)) {
    const safe = findings.filter((f) => f.nodeId === ai.id).reduce((p, f) => p * (1 - f.risk), 1)
    byNode[ai.id] = Math.round(100 * (1 - safe) + 1e-9) // 부동소수 오차로 .5가 내림되는 것을 막음
  }
  const overall = Math.max(0, ...Object.values(byNode))
  return { overall, byNode, findings }
}

/** 대응책을 하나도 적용하지 않았을 때와 지금의 점수 */
export function compareScores(graph: Graph, rules: readonly Rule[], applied: ReadonlySet<string>) {
  const before = scoreGraph(graph, rules).overall
  const after = scoreGraph(graph, rules, applied).overall
  return { before, after, delta: after - before }
}
