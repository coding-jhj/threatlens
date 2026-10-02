import type { AttributeId } from './attributes'
import type { IconName } from '../ui/Icon'

export type PartKind = 'actor' | 'input' | 'ai' | 'store' | 'tool' | 'equipment' | 'external'
export type PartGroup = '입력·사람' | 'AI·데이터' | '외부 도구' | '화공 설비'

export interface PartDef {
  id: string
  label: string
  description: string
  group: PartGroup
  kind: PartKind
  icon: IconName
  defaults: readonly AttributeId[]
}

export const PARTS: readonly PartDef[] = [
  { id: 'user', label: '사용자', description: '질문하는 사람', group: '입력·사람', kind: 'actor', icon: 'user', defaults: [] },
  { id: 'upload_doc', label: '업로드 문서', description: '외부에서 받은 파일', group: '입력·사람', kind: 'input', icon: 'doc', defaults: ['input.untrusted'] },
  { id: 'web_page', label: '웹 페이지', description: '인터넷에서 읽어 오는 내용', group: '입력·사람', kind: 'input', icon: 'globe', defaults: ['input.untrusted'] },
  { id: 'ai_agent', label: 'AI 에이전트', description: '도구를 직접 호출하는 AI', group: 'AI·데이터', kind: 'ai', icon: 'ai', defaults: [] },
  { id: 'ai_model', label: 'AI 모델', description: '질문에 답만 하는 단순 호출', group: 'AI·데이터', kind: 'ai', icon: 'ai', defaults: [] },
  { id: 'doc_store', label: '문서 저장소', description: '사내 문서·규정·일지', group: 'AI·데이터', kind: 'store', icon: 'db', defaults: [] },
  { id: 'chat_log', label: '대화 로그', description: '질문과 답변 기록', group: 'AI·데이터', kind: 'store', icon: 'log', defaults: ['log.store'] },
  { id: 'mail_tool', label: '메일 전송', description: '이메일 자동 발송', group: '외부 도구', kind: 'tool', icon: 'mail', defaults: ['tool.send'] },
  { id: 'code_exec', label: '코드 실행', description: '코드·명령 실행 환경', group: '외부 도구', kind: 'tool', icon: 'code', defaults: ['tool.exec'] },
  { id: 'ext_api', label: '외부 API', description: '회사 밖 서비스 호출', group: '외부 도구', kind: 'tool', icon: 'bolt', defaults: ['tool.send'] },
  { id: 'external_party', label: '외부 수신자', description: '회사 밖 사람·주소', group: '외부 도구', kind: 'external', icon: 'globe', defaults: [] },
  { id: 'sensor', label: '센서 값', description: '반응기 온도·압력 등', group: '화공 설비', kind: 'input', icon: 'sensor', defaults: ['input.sensor'] },
  { id: 'control_api', label: '제어 API', description: '밸브·펌프 명령', group: '화공 설비', kind: 'tool', icon: 'bolt', defaults: ['tool.write', 'link.control'] },
  { id: 'plc', label: 'PLC·DCS', description: '실제 설비 제어기', group: '화공 설비', kind: 'equipment', icon: 'plc', defaults: [] },
]

export const PART_GROUPS: readonly PartGroup[] = ['입력·사람', 'AI·데이터', '외부 도구', '화공 설비']

export function getPart(id: string): PartDef | undefined {
  return PARTS.find((p) => p.id === id)
}
