import { isAttributeId, type AttributeId } from './attributes'
import type { Severity } from '../ui/severity'

export const CATEGORIES = ['prompt-injection', 'data-leak', 'tool-abuse', 'store-log', 'chem'] as const
export type Category = (typeof CATEGORIES)[number]
export const CATEGORY_LABEL: Record<Category, string> = {
  'prompt-injection': '프롬프트 주입',
  'data-leak': '데이터 유출',
  'tool-abuse': '도구·권한 오용',
  'store-log': '저장소·로그',
  chem: '화공 특화',
}

/** 위험 마름모의 네 칸. 규칙마다 사람이 "주된 위험의 성격"으로 하나를 지정한다 */
export const HAZARDS = ['inject', 'leak', 'misuse', 'plant'] as const
export type Hazard = (typeof HAZARDS)[number]
export const HAZARD_LABEL: Record<Hazard, string> = { inject: '주입', leak: '유출', misuse: '오용', plant: '설비' }
export const HAZARD_HINT: Record<Hazard, string> = {
  inject: '믿을 수 없는 글이 AI를 조종하거나 오염시킴',
  leak: '정보가 밖이나 다른 사람에게 나감',
  misuse: 'AI의 권한이 확인·분리 없이 잘못 쓰임',
  plant: 'AI의 판단이 물리 설비에 영향을 줌',
}

export const BASIS_SOURCES = ['OWASP-LLM', 'MITRE-ATLAS', 'MITRE-ATTACK-ICS', 'CISA-AI-OT', 'IEC-61511', 'unverified'] as const
export type BasisSource = (typeof BASIS_SOURCES)[number]

export interface Basis {
  source: BasisSource
  ref?: string
  url?: string
}

export const EFFORTS = ['low', 'mid', 'high'] as const
export type Effort = (typeof EFFORTS)[number]
/** 사람이 정한 난이도. low=설정·문구 수준, mid=작은 개발이나 운영 절차 추가, high=구조를 바꾸거나 별도 구성이 필요 */
export const EFFORT_LABEL: Record<Effort, string> = { low: '쉬움', mid: '보통', high: '어려움' }
export const EFFORT_WEIGHT: Record<Effort, number> = { low: 1, mid: 2, high: 3 }

export interface Fix {
  id: string
  label: string
  score: number
  effort: Effort
  sets?: AttributeId
}

export interface Condition {
  attribute: AttributeId
  negated: boolean
}

export interface Rule {
  id: string
  title: string
  summary: string
  /** 공격 시나리오 3줄: 원인 → AI가 하는 일 → 결과 */
  story: [string, string, string]
  category: Category
  hazard: Hazard
  severity: Severity
  when: string[]
  fixes: Fix[]
  basis: Basis[]
}

export type ValidationResult = { ok: true; rules: Rule[] } | { ok: false; errors: string[] }

export function parseCondition(raw: string): Condition | null {
  const negated = raw.startsWith('!')
  const id = negated ? raw.slice(1) : raw
  return isAttributeId(id) ? { attribute: id, negated } : null
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

function validateOne(raw: unknown, index: number, errors: string[]): void {
  const where = isObj(raw) && isStr(raw.id) ? raw.id : `#${index + 1}번째 규칙`
  const err = (msg: string): void => {
    errors.push(`${where}: ${msg}`)
  }
  if (!isObj(raw)) return err('객체가 아닙니다')

  if (!isStr(raw.id) || !/^R-\d{2}$/.test(raw.id)) err('id는 "R-01" 형식이어야 합니다')
  if (!isStr(raw.title)) err('title이 비어 있습니다')
  if (!isStr(raw.summary)) err('summary가 비어 있습니다')
  if (!Array.isArray(raw.story) || raw.story.length !== 3 || !raw.story.every(isStr)) err('story는 비어 있지 않은 문장 3개여야 합니다')
  if (!(HAZARDS as readonly unknown[]).includes(raw.hazard)) err(`hazard는 ${HAZARDS.join(', ')} 중 하나여야 합니다`)
  if (!(CATEGORIES as readonly unknown[]).includes(raw.category)) err(`category는 ${CATEGORIES.join(', ')} 중 하나여야 합니다`)
  if (!['high', 'medium', 'low'].includes(raw.severity as string)) err('severity는 high, medium, low 중 하나여야 합니다')

  if (!Array.isArray(raw.when) || raw.when.length === 0) {
    err('when은 비어 있지 않은 배열이어야 합니다')
  } else {
    const seen = new Map<AttributeId, boolean>()
    for (const w of raw.when) {
      const c = typeof w === 'string' ? parseCondition(w) : null
      if (!c) {
        err(`when에 알 수 없는 속성이 있습니다: ${String(w)}`)
        continue
      }
      const prev = seen.get(c.attribute)
      if (prev !== undefined) err(prev === c.negated ? `when에 중복된 조건이 있습니다: ${String(w)}` : `when에 모순된 조건이 있습니다: ${c.attribute}`)
      seen.set(c.attribute, c.negated)
    }
    if (seen.size > 0 && [...seen.values()].every((neg) => neg)) err('when에는 부정(!) 아닌 조건이 최소 1개 있어야 합니다')
  }

  if (!Array.isArray(raw.fixes) || raw.fixes.length === 0) {
    err('fixes는 비어 있지 않은 배열이어야 합니다')
  } else {
    const ids = new Set<string>()
    for (const f of raw.fixes) {
      if (!isObj(f) || !isStr(f.id) || !isStr(f.label)) {
        err('fixes 항목에는 id와 label이 필요합니다')
        continue
      }
      if (ids.has(f.id)) err(`fixes에 중복된 id가 있습니다: ${f.id}`)
      ids.add(f.id)
      if (!Number.isInteger(f.score) || (f.score as number) >= 0) err(`fix ${f.id}의 score는 음의 정수여야 합니다`)
      if (!(EFFORTS as readonly unknown[]).includes(f.effort)) err(`fix ${f.id}의 effort는 ${EFFORTS.join(', ')} 중 하나여야 합니다`)
      if (f.sets !== undefined && !(typeof f.sets === 'string' && isAttributeId(f.sets))) err(`fix ${f.id}의 sets가 알 수 없는 속성입니다`)
    }
  }

  if (!Array.isArray(raw.basis) || raw.basis.length === 0) {
    err('basis는 비어 있지 않은 배열이어야 합니다')
  } else {
    for (const b of raw.basis) {
      if (!isObj(b) || !(BASIS_SOURCES as readonly unknown[]).includes(b.source)) {
        err(`basis.source는 ${BASIS_SOURCES.join(', ')} 중 하나여야 합니다`)
        continue
      }
      if (b.source !== 'unverified' && (!isStr(b.ref) || !isStr(b.url) || !(b.url as string).startsWith('https://'))) {
        err(`${String(b.source)} 근거에는 ref와 https url이 필요합니다`)
      }
    }
  }
}

export function validateRules(input: unknown): ValidationResult {
  if (!Array.isArray(input)) return { ok: false, errors: ['규칙 파일은 배열이어야 합니다'] }
  const errors: string[] = []
  input.forEach((r, i) => validateOne(r, i, errors))
  const ids = input.filter(isObj).map((r) => r.id)
  const dup = ids.filter((id, i) => typeof id === 'string' && ids.indexOf(id) !== i)
  for (const d of new Set(dup)) errors.push(`${String(d)}: id가 중복되었습니다`)
  return errors.length > 0 ? { ok: false, errors } : { ok: true, rules: input as Rule[] }
}

export function loadRules(input: unknown): Rule[] {
  const res = validateRules(input)
  if (!res.ok) throw new Error(`규칙 파일 오류:\n- ${res.errors.join('\n- ')}`)
  return res.rules
}
