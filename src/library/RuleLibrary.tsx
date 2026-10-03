import { useState } from 'react'
import { RULES } from '../data'
import { ATTRIBUTES } from '../domain/attributes'
import { CATEGORIES, CATEGORY_LABEL, EFFORT_LABEL, parseCondition, type BasisSource, type Rule } from '../domain/rules'
import { Chip, SeverityChip } from '../ui/components'
import { formatDelta } from '../ui/severity'
import { countByCategory, filterRules, type CategoryFilter } from './filter'
import './library.css'

const SOURCE_LABEL: Record<BasisSource, string> = {
  'OWASP-LLM': 'OWASP LLM Top 10',
  'MITRE-ATLAS': 'MITRE ATLAS',
  'MITRE-ATTACK-ICS': 'ATT&CK for ICS',
  'CISA-AI-OT': 'CISA 등 AI·OT 지침',
  'IEC-61511': 'IEC 61511',
  unverified: '근거 확인 중',
}

const attrLabel = (id: string) => ATTRIBUTES.find((a) => a.id === id)?.label ?? id

function Conditions({ when }: { when: string[] }) {
  return (
    <ul className="tl-lib__conds">
      {when.map((raw) => {
        const c = parseCondition(raw)
        if (!c) return null
        return (
          <li key={raw} className={c.negated ? 'is-neg' : ''}>
            {attrLabel(c.attribute)}
            {c.negated && <em> — 없을 때</em>}
          </li>
        )
      })}
    </ul>
  )
}

function RuleCard({ rule }: { rule: Rule }) {
  return (
    <article className="tl-lib__card" aria-label={`${rule.id} ${rule.title}`}>
      <header className="tl-lib__top">
        <SeverityChip severity={rule.severity} />
        <Chip tone={rule.category === 'chem' ? 'chem' : 'neutral'}>{CATEGORY_LABEL[rule.category]}</Chip>
        <span className="tl-lib__id">{rule.id}</span>
      </header>
      <h3 className="tl-lib__title">{rule.title}</h3>
      <p className="tl-lib__summary">{rule.summary}</p>

      <div className="tl-lib__label">이런 구조에서 발동합니다 (AI와 바로 이어진 부품 포함)</div>
      <Conditions when={rule.when} />

      <div className="tl-lib__label">막는 방법</div>
      <ul className="tl-lib__fixes">
        {rule.fixes.map((f) => (
          <li key={f.id}>
            <span>{f.label}</span>
            <span className="tl-lib__effort">난이도 {EFFORT_LABEL[f.effort]}</span>
            <span className="tl-lib__delta">{formatDelta(f.score)}</span>
          </li>
        ))}
      </ul>

      <div className="tl-lib__label">근거</div>
      <ul className="tl-lib__basis">
        {rule.basis.map((b, i) => (
          <li key={i}>
            <span className={`tl-lib__src${b.source === 'unverified' ? ' is-warn' : ''}`}>{SOURCE_LABEL[b.source]}</span>
            {b.url ? (
              <a href={b.url} target="_blank" rel="noreferrer">
                {b.ref ?? b.url}
              </a>
            ) : (
              b.ref && <span>{b.ref}</span>
            )}
          </li>
        ))}
      </ul>
    </article>
  )
}

export default function RuleLibrary() {
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [query, setQuery] = useState('')
  const counts = countByCategory(RULES)
  const shown = filterRules(RULES, category, query)
  const tabs: CategoryFilter[] = ['all', ...CATEGORIES]

  return (
    <main className="tl-lib">
      <div className="tl-lib__intro">
        <h1>규칙 라이브러리</h1>
        <p>ThreatLens가 구조를 검사할 때 쓰는 규칙 {RULES.length}개입니다. 모든 규칙은 공개된 근거와 함께 사람이 작성했고, 판정에 AI를 쓰지 않습니다.</p>
      </div>

      <div className="tl-lib__bar">
        <div className="tl-lib__tabs" role="tablist" aria-label="카테고리">
          {tabs.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={category === c} className="tl-lib__tab" onClick={() => setCategory(c)}>
              {c === 'all' ? '전체' : CATEGORY_LABEL[c]} <span>{counts[c]}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          className="tl-lib__search"
          placeholder="검색 (예: 메일, R-09, OWASP)"
          aria-label="규칙 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="tl-lib__count" aria-live="polite">
        {RULES.length}개 중 {shown.length}개 표시
      </div>

      {shown.length === 0 ? (
        <p className="tl-lib__none">조건에 맞는 규칙이 없습니다. 검색어를 줄이거나 카테고리를 "전체"로 바꿔 보세요.</p>
      ) : (
        <div className="tl-lib__grid">
          {shown.map((r) => (
            <RuleCard key={r.id} rule={r} />
          ))}
        </div>
      )}
    </main>
  )
}
