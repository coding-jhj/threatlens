import { evaluate, type Finding } from './engine'
import type { Graph } from './graph'
import { findPaths, type RiskPath } from './paths'
import type { Rule } from './rules'
import type { Severity } from '../ui/severity'

export interface AnalyzedPath extends RiskPath {
  /** 이 경로가 지나는 AI 노드에서 발동한 규칙 번호 */
  ruleIds: string[]
  severity: Severity
}

export interface Analysis {
  findings: Finding[]
  /** 발동한 규칙이 하나라도 걸린 경로만 (심각도 높은 순) */
  paths: AnalyzedPath[]
}

const ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

export function analyze(graph: Graph, rules: readonly Rule[], applied: ReadonlySet<string> = new Set()): Analysis {
  const findings = evaluate(graph, rules, applied)
  const paths: AnalyzedPath[] = []
  for (const p of findPaths(graph)) {
    const hits = findings.filter((f) => p.nodeIds.includes(f.nodeId))
    if (hits.length === 0) continue
    const severity = hits.reduce<Severity>((m, f) => (ORDER[f.severity] < ORDER[m] ? f.severity : m), 'low')
    paths.push({ ...p, ruleIds: [...new Set(hits.map((h) => h.ruleId))].sort(), severity })
  }
  paths.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.nodeIds.join().localeCompare(b.nodeIds.join()))
  return { findings, paths }
}
