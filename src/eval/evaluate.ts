import { analyze } from '../domain/analyze'
import type { Rule } from '../domain/rules'
import type { Sample } from '../samples/samples'

export interface GtThreat {
  id: string
  statement: string
  tags: string[]
  why: string
  severity_guess: 'high' | 'medium' | 'low'
}
export interface GroundTruth {
  status: string
  structures: Record<string, { threats: GtThreat[]; applicability: Record<string, { applies: boolean; reason: string }> }>
}

/**
 * 규칙의 근거(basis)에서 정답 목록과 같은 어휘의 태그를 뽑는다.
 *  - OWASP 근거의 LLM번호, ATT&CK for ICS 근거의 기법 번호
 *  - CISA AI-OT 지침 근거 → OT-HUMAN-OVERSIGHT, IEC 61511 근거 → SIS-INDEPENDENCE (출처 단위의 거친 대응)
 * MITRE ATLAS(AML 번호)는 정답 목록이 쓰지 않으므로 뽑지 않는다.
 * 규칙에 평가 전용 태그를 따로 붙이지 않는다: 정답에 맞추려고 규칙을 손보는 길을 막기 위해서다.
 */
export function ruleTags(rule: Rule): string[] {
  const tags = new Set<string>()
  for (const b of rule.basis) {
    const ref = b.ref ?? ''
    if (b.source === 'OWASP-LLM') {
      const m = /LLM(0[1-9]|10)/.exec(ref)
      if (m) tags.add(`LLM${m[1]}`)
    } else if (b.source === 'MITRE-ATTACK-ICS') {
      const m = /\bT\d{4}(\.\d{3})?\b/.exec(ref)
      if (m) tags.add(m[0])
    } else if (b.source === 'CISA-AI-OT') tags.add('OT-HUMAN-OVERSIGHT')
    else if (b.source === 'IEC-61511') tags.add('SIS-INDEPENDENCE')
  }
  return [...tags].sort()
}

export interface ThreatResult {
  threat: GtThreat
  /** 태그가 하나라도 겹치는 발동 규칙이 있다 (느슨한 기준) */
  found: boolean
  /** 정답 위협의 태그가 모두 발동 규칙으로 덮인다 (엄격한 기준) */
  strict: boolean
  matchedRuleIds: string[]
  uncoveredTags: string[]
}
export interface FiredResult {
  ruleId: string
  title: string
  tags: string[]
  /** true: 정답 위협과 태그가 겹침 / false: 겹치지 않음 / null: 규칙에 비교할 태그가 없음 */
  inGroundTruth: boolean | null
}
export interface StructureResult {
  id: string
  title: string
  threats: ThreatResult[]
  fired: FiredResult[]
  foundCount: number
  strictCount: number
  /** 발동 규칙 중 비교 가능한 것(태그 있음)의 수와 그중 정답과 겹친 수 */
  comparable: number
  matchedFired: number
}
export interface EvalSummary {
  structures: StructureResult[]
  threatTotal: number
  found: number
  strict: number
  comparable: number
  matchedFired: number
  untagged: number
}

export const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d)

export function evaluateAll(samples: readonly Sample[], rules: readonly Rule[], gt: GroundTruth): EvalSummary {
  const ruleById = new Map(rules.map((r) => [r.id, r]))
  const structures: StructureResult[] = samples.map((s) => {
    const truth = gt.structures[s.id]?.threats ?? []
    const firedIds = [...new Set(analyze(s.graph, rules).findings.map((f) => f.ruleId))].sort()
    const firedTags = new Map(firedIds.map((id) => [id, ruleTags(ruleById.get(id)!)]))
    const covered = new Set([...firedTags.values()].flat())
    const truthTags = new Set(truth.flatMap((t) => t.tags))

    const threats: ThreatResult[] = truth.map((t) => {
      const matchedRuleIds = firedIds.filter((id) => firedTags.get(id)!.some((x) => t.tags.includes(x)))
      const uncoveredTags = t.tags.filter((x) => !covered.has(x))
      return { threat: t, found: matchedRuleIds.length > 0, strict: uncoveredTags.length === 0, matchedRuleIds, uncoveredTags }
    })
    const fired: FiredResult[] = firedIds.map((id) => {
      const tags = firedTags.get(id)!
      return { ruleId: id, title: ruleById.get(id)!.title, tags, inGroundTruth: tags.length === 0 ? null : tags.some((x) => truthTags.has(x)) }
    })
    return {
      id: s.id,
      title: s.title,
      threats,
      fired,
      foundCount: threats.filter((t) => t.found).length,
      strictCount: threats.filter((t) => t.strict).length,
      comparable: fired.filter((f) => f.inGroundTruth !== null).length,
      matchedFired: fired.filter((f) => f.inGroundTruth === true).length,
    }
  })
  const sum = (f: (s: StructureResult) => number) => structures.reduce((n, s) => n + f(s), 0)
  return {
    structures,
    threatTotal: sum((s) => s.threats.length),
    found: sum((s) => s.foundCount),
    strict: sum((s) => s.strictCount),
    comparable: sum((s) => s.comparable),
    matchedFired: sum((s) => s.matchedFired),
    untagged: sum((s) => s.fired.length - s.comparable),
  }
}
