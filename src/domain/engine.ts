import type { AttributeId } from './attributes'
import { isAiNode, neighborIds, type Graph } from './graph'
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
 * 규칙 평가. 각 AI 노드마다 "자기 속성 + 바로 이어진 노드들의 속성"을 모아 조건을 확인한다.
 * applied에 든 대응책이 sets 속성을 가지면 그 AI 노드가 해당 속성을 갖는 것으로 본다.
 */
export function evaluate(graph: Graph, rules: readonly Rule[], applied: ReadonlySet<string> = new Set()): Finding[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const findings: Finding[] = []
  const crossing = new Set(crossingEdgeIds(graph))

  for (const ai of graph.nodes.filter(isAiNode)) {
    const holders = new Map<AttributeId, string[]>()
    const add = (attr: AttributeId, nodeId: string) => holders.set(attr, [...(holders.get(attr) ?? []), nodeId])
    for (const a of ai.attributes) add(a, ai.id)
    for (const nid of neighborIds(graph, ai.id)) {
      const n = byId.get(nid)
      if (n) for (const a of n.attributes) add(a, n.id)
    }
    if (graph.edges.some((e) => crossing.has(e.id) && (e.from === ai.id || e.to === ai.id))) add('boundary.cross', ai.id)
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
