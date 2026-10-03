import type { PartKind } from '../domain/parts'

const PREFIX: Record<PartKind, string> = { actor: 'US', input: 'IN', ai: 'AI', store: 'DB', tool: 'TL', equipment: 'EQ', external: 'EX' }

/** 도면 태그 번호: 종류 접두어 + 부품 번호 두 자리 (n3 → AI-03) */
export function partTag(kind: PartKind, nodeId: string): string {
  const n = Number(nodeId.replace(/\D/g, '')) || 0
  return `${PREFIX[kind]}-${String(n).padStart(2, '0')}`
}
