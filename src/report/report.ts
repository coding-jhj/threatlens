import { analyze } from '../domain/analyze'
import { ATTRIBUTES } from '../domain/attributes'
import { appliedKey } from '../domain/engine'
import { isAiNode, type Graph } from '../domain/graph'
import { getPart } from '../domain/parts'
import { CATEGORY_LABEL, type Rule } from '../domain/rules'
import { scoreGraph } from '../domain/score'
import { SEVERITY_LABEL, type Severity } from '../ui/severity'

export interface ReportFix {
  label: string
  score: number
  applied: boolean
}
export interface ReportFinding {
  ruleId: string
  title: string
  summary: string
  severity: Severity
  category: string
  target: string
  /** 대응 적용 뒤 이 위협이 더는 발동하지 않으면 true */
  resolved: boolean
  fixes: ReportFix[]
  basis: { label: string; url?: string }[]
}
export interface Report {
  generatedAt: string
  hasAi: boolean
  before: number
  after: number
  parts: { name: string; attributes: string[] }[]
  connections: string[]
  paths: { text: string; severity: Severity }[]
  findings: ReportFinding[]
  appliedCount: number
}

/** 같은 부품이 여럿이면 "AI 에이전트 #2"처럼 구분되는 이름을 붙인다 */
export function nodeNames(graph: Graph): Map<string, string> {
  const total = new Map<string, number>()
  for (const n of graph.nodes) total.set(n.partId, (total.get(n.partId) ?? 0) + 1)
  const seen = new Map<string, number>()
  const names = new Map<string, string>()
  for (const n of graph.nodes) {
    const base = getPart(n.partId)?.label ?? n.partId
    const i = (seen.get(n.partId) ?? 0) + 1
    seen.set(n.partId, i)
    names.set(n.id, (total.get(n.partId) ?? 1) > 1 ? `${base} #${i}` : base)
  }
  return names
}

const attrLabel = (id: string) => ATTRIBUTES.find((a) => a.id === id)?.label ?? id

export function buildReport(graph: Graph, rules: readonly Rule[], applied: ReadonlySet<string>, now: Date): Report {
  const names = nodeNames(graph)
  const name = (id: string) => names.get(id) ?? id
  const base = analyze(graph, rules)
  const current = analyze(graph, rules, applied)
  const stillOn = new Set(current.findings.map((f) => `${f.nodeId}|${f.ruleId}`))
  const ruleById = new Map(rules.map((r) => [r.id, r]))

  const findings: ReportFinding[] = []
  for (const f of base.findings) {
    const rule = ruleById.get(f.ruleId)
    if (!rule) continue
    findings.push({
      ruleId: rule.id,
      title: rule.title,
      summary: rule.summary,
      severity: f.severity,
      category: CATEGORY_LABEL[rule.category],
      target: name(f.nodeId),
      resolved: !stillOn.has(`${f.nodeId}|${f.ruleId}`),
      fixes: rule.fixes.map((fx) => ({ label: fx.label, score: fx.score, applied: applied.has(appliedKey(f.nodeId, f.ruleId, fx.id)) })),
      basis: rule.basis.map((b) => ({ label: b.ref ?? b.source, url: b.url })),
    })
  }

  const appliedCount = findings.reduce((n, f) => n + f.fixes.filter((x) => x.applied).length, 0)
  return {
    generatedAt: now.toISOString(),
    hasAi: graph.nodes.some(isAiNode),
    before: scoreGraph(graph, rules).overall,
    after: scoreGraph(graph, rules, applied).overall,
    parts: graph.nodes.map((n) => ({ name: name(n.id), attributes: n.attributes.map(attrLabel) })),
    connections: graph.edges.map((e) => `${name(e.from)} → ${name(e.to)}`),
    paths: base.paths.map((p) => ({ text: p.nodeIds.map(name).join(' → '), severity: p.severity })),
    findings,
    appliedCount,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const reportDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function reportToMarkdown(r: Report): string {
  const L: string[] = []
  L.push('# ThreatLens 위협 분석 보고서', '', `작성일: ${reportDate(r.generatedAt)}`, '')
  L.push('## 요약', '')
  L.push(`- 위험 점수: **${r.before}** (대응 전) → **${r.after}** (대응 후)`)
  L.push(`- 발견된 위협: ${r.findings.length}개, 적용한 대응: ${r.appliedCount}개`, '')

  L.push('## 분석한 구조', '', '**부품**', '')
  for (const p of r.parts) L.push(`- ${p.name}${p.attributes.length ? ` (${p.attributes.join(', ')})` : ''}`)
  L.push('', '**연결** (화살표는 정보·명령이 흐르는 방향)', '')
  if (r.connections.length === 0) L.push('- 없음')
  for (const c of r.connections) L.push(`- ${c}`)
  L.push('')

  L.push('## 위험 경로', '')
  if (r.paths.length === 0) L.push('- 위험한 입력에서 AI를 거쳐 밖으로 이어지는 경로가 없습니다.')
  for (const p of r.paths) L.push(`- [${SEVERITY_LABEL[p.severity]}] ${p.text}`)
  L.push('')

  L.push('## 위협 상세', '')
  if (r.findings.length === 0) L.push('발견된 위협이 없습니다.', '')
  for (const f of r.findings) {
    L.push(`### ${f.ruleId} ${f.title}`, '')
    L.push(`- 심각도: ${SEVERITY_LABEL[f.severity]} · 분류: ${f.category} · 대상: ${f.target}`)
    L.push(`- 상태: ${f.resolved ? '해결됨 (대응 적용으로 더는 발동하지 않음)' : f.fixes.some((x) => x.applied) ? '일부 대응 적용 (위험 감소)' : '대응 필요'}`)
    L.push(`- 설명: ${f.summary}`, '', '대응책:', '')
    for (const x of f.fixes) L.push(`- [${x.applied ? 'x' : ' '}] ${x.label} (${x.score})`)
    L.push('', '근거:', '')
    for (const b of f.basis) L.push(b.url ? `- [${b.label}](${b.url})` : `- ${b.label}`)
    L.push('')
  }

  L.push('## 읽는 법과 한계', '')
  L.push('- 점수는 사람이 작성한 규칙으로 계산한 상대적 위험 지표이며, 실제 사고 확률이 아닙니다.')
  L.push('- 그려 넣은 구조와 체크한 속성만 분석합니다. 빠진 부품이나 잘못 체크한 속성은 결과에 반영되지 않습니다.')
  L.push('- 대응책을 모두 적용해도 위험이 0이 되지는 않습니다.', '')
  return L.join('\n')
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
