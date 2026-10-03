import { isAiNode, type Graph, type GraphNode } from './graph'
import { getPart } from './parts'

export type LintCode = 'ai-no-input' | 'isolated' | 'tool-not-linked-to-ai' | 'edge-into-input'

export interface LintWarning {
  key: string
  code: LintCode
  nodeId: string
  edgeId?: string
  title: string
  detail: string
}

const label = (n: GraphNode | undefined) => (n && getPart(n.partId)?.label) ?? '?'
const INPUT_LIKE = new Set(['actor', 'input', 'store'])
const CHAIN = new Set(['tool', 'equipment', 'external'])

export function lintStructure(graph: Graph): LintWarning[] {
  const out: LintWarning[] = []
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const kindOf = (id: string) => getPart(byId.get(id)?.partId ?? '')?.kind
  const nbrs = (id: string) => {
    const s = new Set<string>()
    for (const e of graph.edges) {
      if (e.from === id) s.add(e.to)
      if (e.to === id) s.add(e.from)
    }
    s.delete(id)
    return [...s]
  }

  // AI에서 출발해 도구·설비·외부 수신자로만 이어진 부품(예: AI → 코드 실행 → 외부 API)
  const reached = new Set<string>()
  const queue = graph.nodes.filter(isAiNode).flatMap((a) => nbrs(a.id))
  while (queue.length) {
    const id = queue.pop()!
    if (reached.has(id) || !CHAIN.has(kindOf(id)!)) continue
    reached.add(id)
    queue.push(...nbrs(id))
  }

  for (const n of graph.nodes) {
    const ns = nbrs(n.id)
    if (ns.length === 0) {
      if (graph.nodes.length > 1)
        out.push({
          key: `isolated:${n.id}`,
          code: 'isolated',
          nodeId: n.id,
          title: `${label(n)}: 어디에도 이어져 있지 않습니다`,
          detail: '이어지지 않은 부품은 위협 분석에 반영되지 않습니다. 다른 부품과 화살표로 이어 주세요.',
        })
      continue
    }
    if (isAiNode(n) && !ns.some((id) => INPUT_LIKE.has(kindOf(id)!)))
      out.push({
        key: `ai-no-input:${n.id}`,
        code: 'ai-no-input',
        nodeId: n.id,
        title: `${label(n)}: 들어오는 입력이 없습니다`,
        detail: '사용자, 문서, 웹 페이지, 센서, 저장소 중 하나와 이어야 AI가 무엇을 읽는지 분석할 수 있습니다.',
      })
    if (getPart(n.partId)?.kind === 'tool' && !reached.has(n.id))
      out.push({
        key: `tool-not-linked-to-ai:${n.id}`,
        code: 'tool-not-linked-to-ai',
        nodeId: n.id,
        title: `${label(n)}: AI에서 이 도구로 이어지는 경로가 없습니다`,
        detail: 'AI가 이 도구를 부르는 경로(AI에 바로 이어지거나, 다른 도구를 거쳐 이어짐)가 없으면 이 도구의 위협은 분석되지 않습니다. AI와 도구 사이에 화살표를 그어 주세요.',
      })
  }

  for (const e of graph.edges) {
    if (kindOf(e.to) === 'input') {
      const to = byId.get(e.to)
      out.push({
        key: `edge-into-input:${e.id}`,
        code: 'edge-into-input',
        nodeId: e.to,
        edgeId: e.id,
        title: `${label(byId.get(e.from))} → ${label(to)}: 화살표 방향이 뒤집혔을 수 있습니다`,
        detail: `'${label(to)}'은(는) 값을 내보내는 입력 부품입니다. 보통은 입력에서 AI로 화살표를 그립니다. 분석 결과에는 영향이 없지만 도면을 읽는 사람이 헷갈릴 수 있습니다.`,
      })
    }
  }
  return out
}
