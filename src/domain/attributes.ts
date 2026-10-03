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
  /** 처음 보는 사람을 위한 한 줄 설명 */
  hint: string
}

export const ATTRIBUTES: readonly AttributeDef[] = [
  { id: 'input.untrusted', label: '믿을 수 없는 입력을 읽음', kind: 'risk', hint: 'AI가 외부 사람·웹·파일 등 내가 통제하지 못하는 글을 읽습니다. 그 글에 숨은 명령이 AI를 조종할 수 있습니다.' },
  { id: 'data.sensitive', label: '민감정보에 접근', kind: 'risk', hint: '고객 정보, 사내 기밀처럼 새어 나가면 곤란한 자료에 AI가 접근할 수 있습니다.' },
  { id: 'tool.send', label: '외부로 보낼 수 있음', kind: 'risk', hint: 'AI가 메일·메시지·API 호출 등으로 정보를 회사 밖으로 보낼 수 있습니다.' },
  { id: 'tool.write', label: '쓰기·변경 권한 있음', kind: 'risk', hint: 'AI가 파일·데이터·설정을 직접 바꾸거나 지울 수 있습니다.' },
  { id: 'tool.exec', label: '코드·명령을 실행', kind: 'risk', hint: 'AI가 코드나 명령어를 실제로 실행할 수 있습니다.' },
  { id: 'model.external', label: '외부 업체 모델을 사용', kind: 'risk', hint: '질문과 자료가 외부 업체의 AI 서버로 전달됩니다.' },
  { id: 'human.approval', label: '사람 승인 단계 있음', kind: 'mitigation', hint: '중요한 동작 전에 사람이 확인·승인해야 실행됩니다. 위험을 줄이는 대응입니다.' },
  { id: 'log.store', label: '대화·입력을 저장', kind: 'risk', hint: '대화나 입력 내용이 로그로 남습니다. 민감정보가 섞이면 로그가 유출 지점이 됩니다.' },
  { id: 'store.writable', label: '저장소에 AI가 쓸 수 있음', kind: 'risk', hint: 'AI가 사내 문서 저장소에 글을 쓸 수 있어, 잘못된 내용이 퍼질 수 있습니다.' },
  { id: 'input.sensor', label: '설비 센서 값이 입력됨', kind: 'risk', hint: '반응기 온도·압력 같은 설비 센서 값이 AI의 입력으로 들어옵니다. 값이 조작되면 판단이 틀어집니다.' },
  { id: 'link.control', label: '설비 제어에 연결됨', kind: 'risk', hint: 'AI의 출력이 밸브·펌프 같은 설비 제어 명령으로 이어집니다.' },
  { id: 'interlock.external', label: '안전 인터록이 AI 밖에 독립 존재', kind: 'mitigation', hint: 'AI와 별개로 동작하는 안전 장치(IEC 61511 개념)가 있어 AI가 틀려도 설비가 안전 상태로 갑니다. 위험을 줄이는 대응입니다.' },
]

export function isAttributeId(v: string): v is AttributeId {
  return (ATTRIBUTE_IDS as readonly string[]).includes(v)
}
