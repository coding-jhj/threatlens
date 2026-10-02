export const ATTRIBUTE_IDS = [
  'input.untrusted',
  'data.sensitive',
  'tool.send',
  'tool.write',
  'tool.exec',
  'model.external',
  'human.approval',
  'log.store',
  'store.writable',
  'input.sensor',
  'link.control',
  'interlock.external',
] as const

export type AttributeId = (typeof ATTRIBUTE_IDS)[number]

export interface AttributeDef {
  id: AttributeId
  label: string
  kind: 'risk' | 'mitigation'
}

export const ATTRIBUTES: readonly AttributeDef[] = [
  { id: 'input.untrusted', label: '믿을 수 없는 입력을 읽음', kind: 'risk' },
  { id: 'data.sensitive', label: '민감정보에 접근', kind: 'risk' },
  { id: 'tool.send', label: '외부로 보낼 수 있음', kind: 'risk' },
  { id: 'tool.write', label: '쓰기·변경 권한 있음', kind: 'risk' },
  { id: 'tool.exec', label: '코드·명령을 실행', kind: 'risk' },
  { id: 'model.external', label: '외부 업체 모델을 사용', kind: 'risk' },
  { id: 'human.approval', label: '사람 승인 단계 있음', kind: 'mitigation' },
  { id: 'log.store', label: '대화·입력을 저장', kind: 'risk' },
  { id: 'store.writable', label: '저장소에 AI가 쓸 수 있음', kind: 'risk' },
  { id: 'input.sensor', label: '설비 센서 값이 입력됨', kind: 'risk' },
  { id: 'link.control', label: '설비 제어에 연결됨', kind: 'risk' },
  { id: 'interlock.external', label: '안전 인터록이 AI 밖에 독립 존재', kind: 'mitigation' },
]

export function isAttributeId(v: string): v is AttributeId {
  return (ATTRIBUTE_IDS as readonly string[]).includes(v)
}
