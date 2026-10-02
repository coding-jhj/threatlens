import { CATEGORY_LABEL, type Category, type Rule } from '../domain/rules'

export type CategoryFilter = Category | 'all'

const haystack = (r: Rule): string =>
  [r.id, r.title, r.summary, CATEGORY_LABEL[r.category], ...r.fixes.map((f) => f.label), ...r.basis.map((b) => `${b.source} ${b.ref ?? ''}`)]
    .join(' ')
    .toLowerCase()

/** 카테고리와 검색어(공백으로 나눈 단어가 모두 들어 있어야 함)로 규칙을 거른다. 원래 순서를 유지한다. */
export function filterRules(rules: readonly Rule[], category: CategoryFilter, query: string): Rule[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return rules.filter((r) => (category === 'all' || r.category === category) && words.every((w) => haystack(r).includes(w)))
}

export function countByCategory(rules: readonly Rule[]): Record<CategoryFilter, number> {
  const counts = { all: rules.length, 'prompt-injection': 0, 'data-leak': 0, 'tool-abuse': 0, 'store-log': 0, chem: 0 } as Record<CategoryFilter, number>
  for (const r of rules) counts[r.category]++
  return counts
}
