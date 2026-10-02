import { PARTS, PART_GROUPS } from '../domain/parts'
import { Icon } from '../ui/Icon'

export const DRAG_MIME = 'application/x-threatlens-part'

export function Palette({ onAdd }: { onAdd: (partId: string) => void }) {
  return (
    <aside className="tl-palette" aria-label="부품 목록">
      {PART_GROUPS.map((group) => (
        <div key={group}>
          <div className="tl-palette__group">{group}</div>
          {PARTS.filter((p) => p.group === group).map((p) => (
            <button
              key={p.id}
              type="button"
              className="tl-palette__item"
              draggable
              title={`${p.description} — 끌어서 놓거나 클릭해서 추가`}
              aria-label={`${p.label} 추가`}
              onClick={() => onAdd(p.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, p.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
            >
              <span className="tl-palette__icon" style={{ color: 'var(--accent)' }}>
                <Icon name={p.icon} />
              </span>
              {p.label}
              <span className="tl-palette__grip" aria-hidden>
                ⋮⋮
              </span>
            </button>
          ))}
        </div>
      ))}
      <div className="tl-palette__foot">
        화살표는 정보·명령이 흘러가는 방향으로 연결합니다.
        <br />
        모든 계산은 이 브라우저 안에서만 실행됩니다.
      </div>
    </aside>
  )
}
