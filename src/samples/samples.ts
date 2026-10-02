import type { AttributeId } from '../domain/attributes'
import { getPart } from '../domain/parts'
import { autoLayout, type EditorGraph } from '../editor/model'

export interface Sample {
  id: string
  title: string
  description: string
  graph: EditorGraph
}

type NodeSpec = readonly [key: string, partId: string, extra?: readonly AttributeId[]]

function build(nodes: readonly NodeSpec[], edges: readonly (readonly [string, string])[]): EditorGraph {
  const ids = new Map(nodes.map(([key], i) => [key, `n${i + 1}`]))
  const graph: EditorGraph = {
    nodes: nodes.map(([key, partId, extra = []], i) => ({
      id: ids.get(key)!,
      partId,
      attributes: [...new Set([...(getPart(partId)?.defaults ?? []), ...extra])],
      x: 0,
      y: i * 130,
    })),
    edges: edges.map(([a, b], i) => ({ id: `e${nodes.length + i + 1}`, from: ids.get(a)!, to: ids.get(b)! })),
  }
  return autoLayout(graph)
}

export const SAMPLES: readonly Sample[] = [
  {
    id: 'doc-qa',
    title: '사내 문서 질의응답 봇',
    description: '직원 질문과 업로드 문서를 바탕으로 사내 문서 저장소에서 답을 찾는 AI',
    graph: build(
      [
        ['up', 'upload_doc'],
        ['user', 'user'],
        ['ai', 'ai_agent', ['data.sensitive']],
        ['docs', 'doc_store'],
        ['log', 'chat_log'],
      ],
      [
        ['up', 'ai'],
        ['user', 'ai'],
        ['docs', 'ai'],
        ['ai', 'log'],
      ],
    ),
  },
  {
    id: 'support-bot',
    title: '고객상담 챗봇',
    description: '외부 고객의 말을 받아 주문 조회 API를 호출하고, 대화를 저장하는 AI',
    graph: build(
      [
        ['cust', 'user', ['input.untrusted']],
        ['ai', 'ai_agent', ['data.sensitive', 'model.external']],
        ['api', 'ext_api'],
        ['log', 'chat_log'],
        ['faq', 'doc_store'],
      ],
      [
        ['cust', 'ai'],
        ['faq', 'ai'],
        ['ai', 'api'],
        ['ai', 'log'],
      ],
    ),
  },
  {
    id: 'code-agent',
    title: '코드 에이전트',
    description: '웹 문서를 읽고 코드를 직접 실행하며 저장소에 쓰는 AI',
    graph: build(
      [
        ['web', 'web_page'],
        ['dev', 'user'],
        ['ai', 'ai_agent', ['tool.write', 'store.writable']],
        ['exec', 'code_exec'],
        ['repo', 'doc_store'],
        ['api', 'ext_api'],
      ],
      [
        ['web', 'ai'],
        ['dev', 'ai'],
        ['ai', 'exec'],
        ['ai', 'repo'],
        ['exec', 'api'],
      ],
    ),
  },
  {
    id: 'mail-assistant',
    title: '메일 비서',
    description: '받은 메일을 읽고 연락처를 참고해 답장을 직접 보내는 AI',
    graph: build(
      [
        ['inbox', 'upload_doc'],
        ['ai', 'ai_agent', ['data.sensitive']],
        ['contacts', 'doc_store'],
        ['mail', 'mail_tool'],
        ['to', 'external_party'],
      ],
      [
        ['inbox', 'ai'],
        ['contacts', 'ai'],
        ['ai', 'mail'],
        ['mail', 'to'],
      ],
    ),
  },
  {
    id: 'process-assistant',
    title: '공정 운전 보조',
    description: '반응기 센서 값을 읽고 운전원에게 조언하며 제어 API까지 호출하는 AI (화공)',
    graph: build(
      [
        ['sensor', 'sensor'],
        ['op', 'user'],
        ['ai', 'ai_agent'],
        ['ctl', 'control_api'],
        ['plc', 'plc'],
        ['log', 'chat_log'],
      ],
      [
        ['sensor', 'ai'],
        ['op', 'ai'],
        ['ai', 'ctl'],
        ['ctl', 'plc'],
        ['ai', 'log'],
      ],
    ),
  },
]
