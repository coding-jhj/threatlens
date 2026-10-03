import { useState } from 'react'
import { ATTRIBUTES, ATTRIBUTE_IDS, type AttributeId } from '../domain/attributes'
import { getPart } from '../domain/parts'
import { Icon } from '../ui/Icon'
import type { EditorNode } from './model'
import './editor.css'

interface Props {
  node: EditorNode
  others: EditorNode[]
  links: { id: string; text: string }[]
  onChange: (attributes: AttributeId[]) => void
  onConnect: (to: string) => void
  onRemoveLink: (edgeId: string) => void
  onDelete: () => void
}

export function Inspector({ node, others, links, onChange, onConnect, onRemoveLink, onDelete }: Props) {
  const [target, setTarget] = useState('')
  const part = getPart(node.partId)
  if (!part) return null
  const toggle = (id: AttributeId, on: boolean) => {
    const next = on ? [...node.attributes, id] : node.attributes.filter((a) => a !== id)
    onChange(ATTRIBUTE_IDS.filter((a) => next.includes(a)))
  }
  return (
    <section className="tl-inspector" aria-label={`선택한 부품 속성: ${part.label}`}>
      <div className="tl-inspector__head">
        <span style={{ color: 'var(--accent)', display: 'flex' }}>
          <Icon name={part.icon} />
        </span>
        선택한 부품 · {part.label}
        <span className="tl-inspector__hint">속성을 체크하면 규칙이 바로 다시 계산됩니다</span>
        <button type="button" className="tl-btn tl-btn--secondary tl-inspector__delete" onClick={onDelete}>
          이 부품 삭제
        </button>
      </div>
      <div className="tl-inspector__grid">
        {ATTRIBUTES.map((a) => (
          <label key={a.id} className="tl-inspector__item" title={a.hint}>
            <input type="checkbox" checked={node.attributes.includes(a.id)} onChange={(e) => toggle(a.id, e.target.checked)} />
            {a.label}
            {a.kind === 'mitigation' && <span className="tl-inspector__tag">대응</span>}
          </label>
        ))}
      </div>
      <details className="tl-inspector__more">
        <summary>속성 설명 (각 항목이 무슨 뜻인지)</summary>
        <dl className="tl-inspector__defs">
          {ATTRIBUTES.map((a) => (
            <div key={a.id}>
              <dt>{a.label}</dt>
              <dd>{a.hint}</dd>
            </div>
          ))}
        </dl>
      </details>
      <details className="tl-inspector__more">
        <summary>화살표 관리 (키보드로 잇기, 삭제)</summary>
      {others.length > 0 && (
        <div className="tl-inspector__connect">
          <label>
            키보드로 잇기: 이 부품에서 화살표를 보낼 곳
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">부품 선택</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {getPart(o.partId)?.label ?? o.partId} ({o.id})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="tl-btn tl-btn--secondary"
            disabled={!target}
            onClick={() => {
              onConnect(target)
              setTarget('')
            }}
          >
            화살표 추가
          </button>
        </div>
      )}
      {links.length > 0 && (
        <ul className="tl-inspector__links" aria-label="이 부품에 이어진 화살표">
          {links.map((l) => (
            <li key={l.id}>
              <span>{l.text}</span>
              <button type="button" className="tl-btn tl-btn--secondary" onClick={() => onRemoveLink(l.id)} aria-label={`화살표 삭제: ${l.text}`}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      </details>
    </section>
  )
}
