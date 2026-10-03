import { PARTS, PART_GROUPS } from '../domain/parts'
import { PartSymbol } from './PartSymbol'

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
              <span className="tl-palette__icon">
                <PartSymbol kind={p.kind} size={28} />
              </span>
              {p.label}
            </button>
          ))}
        </div>
      ))}
    </aside>
  )
}
