import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ATTRIBUTES, type AttributeId } from '../domain/attributes'
import { getPart } from '../domain/parts'
import { Chip } from '../ui/components'
import { Icon } from '../ui/Icon'
import './editor.css'

export type PartFlowNode = Node<{ partId: string; attributes: AttributeId[] }, 'part'>

const SHORT: Record<AttributeId, string> = {
  'input.untrusted': '믿을 수 없는 입력',
  'data.sensitive': '민감정보',
  'tool.send': '외부로 보냄',
  'tool.write': '쓰기 권한',
  'tool.exec': '코드 실행',
  'model.external': '외부 모델',
  'human.approval': '사람 승인',
  'log.store': '로그 저장',
  'store.writable': '저장소 쓰기',
  'input.sensor': '센서 입력',
  'link.control': '설비 제어',
  'interlock.external': '독립 인터록',
}
const kindOf = (id: AttributeId) => ATTRIBUTES.find((a) => a.id === id)?.kind

export function PartNode({ data, selected }: NodeProps<PartFlowNode>) {
  const part = getPart(data.partId)
  if (!part) return null
  return (
    <div className={`tl-node${selected ? ' tl-node--selected' : ''}`}>
      <Handle type="target" position={Position.Left} aria-label="들어오는 연결" />
      <div className="tl-node__head">
        <span className="tl-node__icon">
          <Icon name={part.icon} size={20} />
        </span>
        <span className="tl-node__title">{part.label}</span>
      </div>
      <div className="tl-node__sub">{part.description}</div>
      {data.attributes.length > 0 && (
        <div className="tl-node__chips">
          {data.attributes.map((a) => (
            <Chip key={a} tone={kindOf(a) === 'mitigation' ? 'low' : 'medium'}>
              {SHORT[a]}
            </Chip>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} aria-label="나가는 연결" />
    </div>
  )
}
