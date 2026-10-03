import { analyze } from '../domain/analyze'
import { ATTRIBUTES } from '../domain/attributes'
import { appliedKey, crossingEdgeIds } from '../domain/engine'
import { isAiNode, type Graph } from '../domain/graph'
import { hazardLevels, type HazardLevels } from '../domain/hazard'
import { getPart, type PartKind } from '../domain/parts'
import { planActions } from '../domain/plan'
import { pathEdgeIds } from '../domain/paths'
import { CATEGORY_LABEL, EFFORT_LABEL, HAZARDS, HAZARD_LABEL, type Rule } from '../domain/rules'
import { scoreGraph } from '../domain/score'
import { autoLayout, type EditorGraph } from '../editor/model'
import { partTag } from '../editor/partTag'
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
  story: [string, string, string]
  severity: Severity
  category: string
  target: string
  /** 대응 적용 뒤 이 위협이 더는 발동하지 않으면 true */
  resolved: boolean
  fixes: ReportFix[]
  basis: { label: string; url?: string }[]
}
export interface DiagramNode {
  id: string
  tag: string
  name: string
  kind: PartKind
  x: number
  y: number
  ai: boolean
  outside: boolean
}
export interface DiagramEdge {
  id: string
  from: string
  to: string
  /** 위험 경로에 속함 */
  risk: boolean
  /** 사내와 사외를 잇는 연결 (신뢰 경계를 넘음) */
  cross: boolean
}
export interface Diagram {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  width: number
  height: number
}
export interface ReportStep {
  order: number
  label: string
  effort: string
  target: string
  ruleIds: string[]
  before: number
  after: number
}
export interface Report {
  generatedAt: string
  hasAi: boolean
  before: number
  after: number
  /** 한 문단 요약 */
  summary: string
  levels: HazardLevels
  diagram: Diagram
  steps: ReportStep[]
  crossCount: number
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

export const NODE_W = 150
export const NODE_H = 56

/** 도면 그림용 좌표. 좌표가 없는 그래프(시험·불러오기)는 자동 정렬로 채운다. */
export function buildDiagram(graph: Graph | EditorGraph, names: Map<string, string>, riskEdges: ReadonlySet<string>): Diagram {
  const laid = (graph.nodes.every((n) => 'x' in n && 'y' in n) ? graph : autoLayout({ nodes: graph.nodes.map((n) => ({ ...n, x: 0, y: 0 })), edges: graph.edges })) as EditorGraph
  const cross = new Set(crossingEdgeIds(graph))
  const pad = 24
  const minX = Math.min(0, ...laid.nodes.map((n) => n.x))
  const minY = Math.min(0, ...laid.nodes.map((n) => n.y))
  const nodes: DiagramNode[] = laid.nodes.map((n) => ({
    id: n.id,
    tag: partTag(getPart(n.partId)?.kind ?? 'tool', n.id),
    name: names.get(n.id) ?? n.id,
    kind: getPart(n.partId)?.kind ?? 'tool',
    x: n.x - minX + pad,
    y: n.y - minY + pad,
    ai: isAiNode(n),
    outside: n.attributes.includes('zone.outside'),
  }))
  return {
    nodes,
    edges: graph.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, risk: riskEdges.has(e.id), cross: cross.has(e.id) })),
    width: Math.max(0, ...nodes.map((n) => n.x + NODE_W)) + pad,
    height: Math.max(0, ...nodes.map((n) => n.y + NODE_H)) + pad,
  }
}

const attrLabel = (id: string) => ATTRIBUTES.find((a) => a.id === id)?.label ?? id

export function buildReport(graph: Graph | EditorGraph, rules: readonly Rule[], applied: ReadonlySet<string>, now: Date): Report {
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
      story: rule.story,
      severity: f.severity,
      category: CATEGORY_LABEL[rule.category],
      target: name(f.nodeId),
      resolved: !stillOn.has(`${f.nodeId}|${f.ruleId}`),
      fixes: rule.fixes.map((fx) => ({ label: fx.label, score: fx.score, applied: applied.has(appliedKey(f.nodeId, f.ruleId, fx.id)) })),
      basis: rule.basis.map((b) => ({ label: b.ref ?? b.source, url: b.url })),
    })
  }

  const appliedCount = findings.reduce((n, f) => n + f.fixes.filter((x) => x.applied).length, 0)
  const before = scoreGraph(graph, rules).overall
  const after = scoreGraph(graph, rules, applied).overall
  const levels = hazardLevels(graph, rules)
  const plan = planActions(graph, rules, applied, 5)
  const steps: ReportStep[] = plan.steps.map((s, i) => ({
    order: i + 1,
    label: s.label,
    effort: EFFORT_LABEL[s.effort],
    target: name(s.nodeId),
    ruleIds: [...s.ruleIds].sort(),
    before: s.before,
    after: s.after,
  }))
  const riskEdges = new Set(base.paths.flatMap((p) => pathEdgeIds(graph, p.nodeIds)))
  const crossing = new Set(crossingEdgeIds(graph))
  const crossCount = crossing.size
  const aiCount = graph.nodes.filter(isAiNode).length
  const sev = (s: Severity) => findings.filter((f) => f.severity === s).length
  const top = HAZARDS.filter((h) => levels[h] > 0).sort((a, b) => levels[b] - levels[a])[0]
  const summary = [
    `AI 부품 ${aiCount}개를 포함한 구조(부품 ${graph.nodes.length}개, 연결 ${graph.edges.length}개)에서 위협 ${findings.length}개를 찾았습니다(높음 ${sev('high')}, 중간 ${sev('medium')}, 낮음 ${sev('low')}).`,
    `위험 점수는 ${before}점(0~100, 참고 지표)이고${top ? `, 가장 큰 위험의 성격은 "${HAZARD_LABEL[top]}"입니다` : ''}.`,
    crossCount > 0 ? `사내와 사외를 잇는 연결이 ${crossCount}개 있어 신뢰 경계를 넘습니다.` : '',
    steps.length > 0 ? `먼저 할 대응 ${steps.length}개를 적용하면 ${plan.before}점에서 ${plan.after}점으로 내려갑니다.` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return {
    generatedAt: now.toISOString(),
    hasAi: aiCount > 0,
    before,
    after,
    summary,
    levels,
    diagram: buildDiagram(graph, names, riskEdges),
    steps,
    crossCount,
    parts: graph.nodes.map((n) => ({ name: name(n.id), attributes: n.attributes.map(attrLabel) })),
    connections: graph.edges.map((e) => `${name(e.from)} → ${name(e.to)}${crossing.has(e.id) ? ' (신뢰 경계를 넘음)' : ''}`),
    paths: base.paths.map((p) => ({ text: p.nodeIds.map(name).join(' → '), severity: p.severity })),
    findings,
    appliedCount,
  }
}

export const STORY_LABELS = ['원인', 'AI가 하는 일', '결과'] as const

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
  L.push(r.summary, '')
  L.push('**위험 마름모** (각 0~4)', '', '| ' + HAZARDS.map((h) => HAZARD_LABEL[h]).join(' | ') + ' |', '|' + HAZARDS.map(() => '---').join('|') + '|', '| ' + HAZARDS.map((h) => r.levels[h]).join(' | ') + ' |', '')

  L.push('## 행동 계획', '')
  if (r.steps.length === 0) L.push('- 더 적용할 대응이 없습니다.')
  else {
    L.push('| 순서 | 대응 | 대상 | 난이도 | 해결하는 위협 | 예상 점수 |', '|---|---|---|---|---|---|')
    for (const s of r.steps) L.push(`| ${s.order} | ${s.label} | ${s.target} | ${s.effort} | ${s.ruleIds.join(', ')} | ${s.before} → ${s.after} |`)
  }
  L.push('')

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
    L.push(`- 설명: ${f.summary}`, '', '이런 일이 벌어질 수 있습니다:', '')
    f.story.forEach((s, i) => L.push(`${i + 1}. ${STORY_LABELS[i]}: ${s}`))
    L.push('', '대응책:', '')
    for (const x of f.fixes) L.push(`- [${x.applied ? 'x' : ' '}] ${x.label} (${x.score})`)
    L.push('', '근거:', '')
    for (const b of f.basis) L.push(b.url ? `- [${b.label}](${b.url})` : `- ${b.label}`)
    L.push('')
  }

  L.push('## 읽는 법과 한계', '')
  L.push('- 점수는 사람이 작성한 규칙으로 계산한 상대적 위험 지표이며, 실제 사고 확률이 아닙니다.')
  L.push('- 규칙과 정답 목록은 AI가 작성했고 사람 전문가 검수 전입니다. 화공 공정은 HAZOP·LOPA, SIL 검증, IEC 61511 평가, 변경관리(MOC)를 대체하지 못하므로 공정안전 담당자와 확인하세요.')
  L.push('- 그려 넣은 구조와 체크한 속성만 분석합니다. 빠진 부품이나 잘못 체크한 속성은 결과에 반영되지 않습니다.')
  L.push('- 대응책을 모두 적용해도 위험이 0이 되지는 않습니다.', '')
  return L.join('\n')
}

export function downloadText(filename: string, text: string, mime = 'text/markdown'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
