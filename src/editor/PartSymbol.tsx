import type { PartKind } from '../domain/parts'

/** 배관계장도 문법을 빌린 부품 기호. 선 색은 currentColor를 따른다. */
const PATHS: Record<PartKind, { d: string; filled?: boolean; dashed?: boolean; heavy?: boolean }> = {
  actor: { d: 'M12 1C18.1 1 23 4.1 23 8s-4.9 7-11 7S1 11.9 1 8s4.9-7 11-7Z' },
  input: { d: 'M5 1h18l-4 14H1Z' },
  ai: { d: 'M1 1h22v14H1ZM4 4v8h16V4Z' },
  store: { d: 'M1 4C1 0 23 0 23 4v8c0 4-22 4-22 0Z' },
  tool: { d: 'M1 1l11 7L1 15ZM23 1L12 8l11 7Z', filled: true },
  external: { d: 'M1 1h22v14H1Z', dashed: true },
  equipment: { d: 'M1 1h22v14H1Z', heavy: true },
}

export function PartSymbol({ kind, size = 24 }: { kind: PartKind; size?: number }) {
  const p = PATHS[kind]
  return (
    <svg width={size} height={(size * 16) / 24} viewBox="0 0 24 16" aria-hidden className="tl-symbol">
      <path
        d={p.d}
        fill={p.filled ? 'currentColor' : 'var(--panel)'}
        fillRule="evenodd"
        stroke="currentColor"
        strokeWidth={p.heavy ? 2.5 : 1.4}
        strokeDasharray={p.dashed ? '3 2' : undefined}
        strokeLinejoin="round"
      />
    </svg>
  )
}
