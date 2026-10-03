import { ATTRIBUTE_IDS, type AttributeId } from '../domain/attributes'
import { getPart } from '../domain/parts'
import { autoLayout, type EditorGraph } from '../editor/model'
import rules from './wizard.json'

export interface WizardQuestion {
  id: string
  text: string
  hint: string
}

interface Effect {
  nodes?: { key: string; part: string }[]
  edges?: string[][]
  attrs?: { node: string; attr: string }[]
}
const TABLE = rules as unknown as { base: Effect; questions: (WizardQuestion & { yes: Effect })[] }

export const QUESTIONS: readonly WizardQuestion[] = TABLE.questions.map(({ id, text, hint }) => ({ id, text, hint }))

/** 답(예=true)에 따라 부품·화살표·속성을 규칙표대로 만든다. AI 호출 없음. */
export function buildFromAnswers(answers: readonly boolean[]): EditorGraph {
  const effects = [TABLE.base, ...TABLE.questions.filter((_, i) => answers[i]).map((q) => q.yes)]
  const keys: string[] = []
  const part = new Map<string, string>()
  const attrs = new Map<string, Set<AttributeId>>()
  const edgeKeys: string[][] = []
  for (const e of effects) {
    for (const n of e.nodes ?? []) {
      keys.push(n.key)
      part.set(n.key, n.part)
    }
    for (const a of e.attrs ?? []) attrs.set(a.node, (attrs.get(a.node) ?? new Set()).add(a.attr as AttributeId))
    edgeKeys.push(...(e.edges ?? []))
  }
  const ids = new Map(keys.map((k, i) => [k, `n${i + 1}`]))
  const graph: EditorGraph = {
    nodes: keys.map((k, i) => ({
      id: ids.get(k)!,
      partId: part.get(k)!,
      attributes: [...new Set([...(getPart(part.get(k)!)?.defaults ?? []), ...(attrs.get(k) ?? [])])],
      x: 0,
      y: i * 130,
    })),
    edges: edgeKeys.map(([a, b], i) => ({ id: `e${keys.length + i + 1}`, from: ids.get(a)!, to: ids.get(b)! })),
  }
  return autoLayout(graph)
}

export const VALID_ATTRIBUTES: readonly string[] = ATTRIBUTE_IDS
