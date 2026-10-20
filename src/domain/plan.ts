import { evaluate, appliedKey } from './engine'
import { isAiNode, type Graph } from './graph'
import { EFFORT_WEIGHT, type Effort, type Rule } from './rules'
import { scoreGraph, type Score } from './score'

/** 같은 부품에 같은 대응을 한 번에 적용하는 묶음 (예: "전송 전 사람 승인"은 여러 위협에 한꺼번에 효과) */
export interface FixGroup {
  nodeId: string
  fixId: string
  label: string
  effort: Effort
  /** 공학적 대응이면 'engineering'. 행동 계획에서 관리적 대응보다 우선한다 */
  controlType?: 'engineering'
  /** 이 묶음을 적용할 때 켜지는 대응 키들 */
  keys: string[]
  ruleIds: string[]
}

export interface PlanStep extends FixGroup {
  /** 이 단계를 적용하기 전/후의 표시 점수 (정수) */
  before: number
  after: number
  /** 점수 감소량(소수 포함). 정수 반올림 때문에 0으로 보이는 단계를 구분하는 데 쓴다 */
  gain: number
}

export interface Plan {
  steps: PlanStep[]
  before: number
  after: number
}

const unrounded = (s: Score, graph: Graph) => {
  const per = graph.nodes.filter(isAiNode).map((ai) => 100 * (1 - s.findings.filter((f) => f.nodeId === ai.id).reduce((p, f) => p * (1 - f.risk), 1)))
  return { overall: Math.max(0, ...per), sum: per.reduce((a, b) => a + b, 0) }
}

/** 지금 발견된 위협에 걸린, 아직 적용하지 않은 대응 후보 묶음 */
export function candidateGroups(graph: Graph, rules: readonly Rule[], applied: ReadonlySet<string>): FixGroup[] {
  const ruleById = new Map(rules.map((r) => [r.id, r]))
  const groups = new Map<string, FixGroup>()
  for (const f of evaluate(graph, rules, applied)) {
    const rule = ruleById.get(f.ruleId)
    if (!rule) continue
    for (const fx of rule.fixes) {
      const key = appliedKey(f.nodeId, f.ruleId, fx.id)
      if (applied.has(key)) continue
      const gid = `${f.nodeId}|${fx.id}|${fx.label}`
      const g = groups.get(gid) ?? { nodeId: f.nodeId, fixId: fx.id, label: fx.label, effort: fx.effort, controlType: fx.controlType, keys: [], ruleIds: [] }
      if (EFFORT_WEIGHT[fx.effort] > EFFORT_WEIGHT[g.effort]) g.effort = fx.effort
      g.keys.push(key)
      if (!g.ruleIds.includes(f.ruleId)) g.ruleIds.push(f.ruleId)
      groups.set(gid, g)
    }
  }
  return [...groups.values()]
}

export const withGroups = (applied: ReadonlySet<string>, groups: readonly FixGroup[]): Set<string> => new Set([...applied, ...groups.flatMap((g) => g.keys)])

/**
 * 행동 계획: 지금 상태에서 "다음 한 개"를 탐욕으로 limit번 고른다.
 * 가치 = 점수 감소량 ÷ 난이도 가중치(쉬움 1, 보통 2, 어려움 3). 점수는 화면 점수식을 그대로 쓴다.
 * 단, 1번째 할 일만큼은 공학적 대응(controlType: 'engineering')이 있으면 그것부터 고른다 — 보호계층
 * 원칙상 사람이 매번 확인하는 절차보다 AI 밖에서 강제되는 분리·허용목록이 더 믿을 수 있는 "맨 먼저
 * 세울 층"이기 때문이다. 2번째부터는 다시 순수 효율로 고른다 — 행동 계획 전체를 공학적 대응으로만
 * 채우면 정작 점수를 더 못 낮추게 돼(관리적 대응이 사소하지 않은 효과를 낼 때도 많다), 실효성이 떨어진다.
 * 동점이면 감소량이 큰 것, 그래도 같으면 키 순서로 정해 결과가 항상 같게 한다.
 */
export function planActions(graph: Graph, rules: readonly Rule[], applied: ReadonlySet<string> = new Set(), limit = 3): Plan {
  let cur = new Set(applied)
  const start = scoreGraph(graph, rules, cur)
  let shown = start.overall
  const steps: PlanStep[] = []

  while (steps.length < limit) {
    const preferEngineering = steps.length === 0
    const base = unrounded(scoreGraph(graph, rules, cur), graph)
    let best: { g: FixGroup; gain: number; value: number; next: Set<string> } | null = null
    for (const g of candidateGroups(graph, rules, cur)) {
      const next = withGroups(cur, [g])
      const now = unrounded(scoreGraph(graph, rules, next), graph)
      const gain = base.overall - now.overall
      const total = base.sum - now.sum
      if (gain <= 1e-9 && total <= 1e-9) continue
      const value = (gain + 0.001 * total) / EFFORT_WEIGHT[g.effort]
      const rank = preferEngineering && g.controlType === 'engineering' ? 0 : 1
      const bestRank = best ? (preferEngineering && best.g.controlType === 'engineering' ? 0 : 1) : 1
      const better =
        !best ||
        rank < bestRank ||
        (rank === bestRank &&
          (value > best.value + 1e-12 ||
            (Math.abs(value - best.value) <= 1e-12 && (gain > best.gain + 1e-12 || (Math.abs(gain - best.gain) <= 1e-12 && g.keys[0] < best.g.keys[0])))))
      if (better) best = { g, gain, value, next }
    }
    if (!best) break
    const after = scoreGraph(graph, rules, best.next).overall
    steps.push({ ...best.g, before: shown, after, gain: best.gain })
    shown = after
    cur = best.next
  }
  return { steps, before: start.overall, after: shown }
}
