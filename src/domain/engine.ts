import type { AttributeId } from './attributes'
import { isAiNode, reachableIds, type Graph } from './graph'
import { parseCondition, type Rule } from './rules'
import type { Severity } from '../ui/severity'

export interface Finding {
  ruleId: string
  nodeId: string
  severity: Severity
  /** 조건에 쓰인 속성 → 그 속성을 가진 노드들 (AI 노드 자신 포함) */
  sources: Partial<Record<AttributeId, string[]>>
}

/** 양 끝 부품의 사외(zone.outside) 여부가 다른 연결 = 신뢰 경계를 넘는 연결 */
export function crossingEdgeIds(graph: Graph): string[] {
  const outside = new Set(graph.nodes.filter((n) => n.attributes.includes('zone.outside')).map((n) => n.id))
  const ids = new Set(graph.nodes.map((n) => n.id))
  return graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to) && outside.has(e.from) !== outside.has(e.to)).map((e) => e.id)
}

export const appliedKey = (nodeId: string, ruleId: string, fixId: string) => `${nodeId}|${ruleId}|${fixId}`

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

/**
 * 규칙 평가. 각 AI 노드마다 "자기 속성 + 간선을 타고 도달 가능한 모든 노드의 속성"을 모아 조건을 확인한다.
 * (예전에는 바로 이어진 노드까지만 봤으나, 중간에 속성 없는 통로 부품이 끼면 신뢰 경계·제어 접근 같은
 * 위험을 놓치는 결함이 있어 전이적 도달성으로 바꿨다 — docs/process-safety-review.md "2차 교차검증" 참고)
 * applied에 든 대응책이 sets 속성을 가지면 그 AI 노드가 해당 속성을 갖는 것으로 본다.
 */
export function evaluate(graph: Graph, rules: readonly Rule[], applied: ReadonlySet<string> = new Set()): Finding[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const findings: Finding[] = []

  for (const ai of graph.nodes.filter(isAiNode)) {
    const holders = new Map<AttributeId, string[]>()
    const add = (attr: AttributeId, nodeId: string) => holders.set(attr, [...(holders.get(attr) ?? []), nodeId])
    for (const a of ai.attributes) add(a, ai.id)
    for (const nid of reachableIds(graph, ai.id, (id) => {
      const n = byId.get(id)
      return !!n && isAiNode(n)
    })) {
      const n = byId.get(nid)
      if (n) for (const a of n.attributes) add(a, n.id)
    }
    if (holders.has('zone.outside')) add('boundary.cross', ai.id)
    for (const rule of rules) {
      for (const fix of rule.fixes) {
        if (fix.sets && applied.has(appliedKey(ai.id, rule.id, fix.id)) && !holders.get(fix.sets)?.includes(ai.id)) add(fix.sets, ai.id)
      }
    }

    for (const rule of rules) {
      const conds = rule.when.map(parseCondition)
      if (conds.some((c) => c === null)) continue
      const ok = conds.every((c) => (c!.negated ? !holders.has(c!.attribute) : holders.has(c!.attribute)))
      if (!ok) continue
      const sources: Finding['sources'] = {}
      for (const c of conds) if (c && !c.negated) sources[c.attribute] = holders.get(c.attribute)
      findings.push({ ruleId: rule.id, nodeId: ai.id, severity: rule.severity, sources })
    }
  }

  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.ruleId.localeCompare(b.ruleId) || a.nodeId.localeCompare(b.nodeId),
  )
}
