import type { Analysis } from '../domain/analyze'
import { appliedKey, type Finding } from '../domain/engine'
import type { Graph } from '../domain/graph'
import { getPart } from '../domain/parts'
import { CATEGORY_LABEL, type Rule } from '../domain/rules'
import { Card, Chip, FixRow, SeverityChip } from '../ui/components'
import { scoreTone } from './scoreTone'
import { findingKey } from './threat'
import './editor.css'

interface Props {
  graph: Graph
  analysis: Analysis
  rules: readonly Rule[]
  applied: ReadonlySet<string>
  before: number
  after: number
  hasAi: boolean
  activeKey: string | null
  onToggleActive: (key: string) => void
  onToggleFix: (key: string, on: boolean) => void
}

const partLabel = (graph: Graph, nodeId: string) => {
  const n = graph.nodes.find((x) => x.id === nodeId)
  return (n && getPart(n.partId)?.label) ?? '?'
}

export function ThreatPanel({ graph, analysis, rules, applied, before, after, hasAi, activeKey, onToggleActive, onToggleFix }: Props) {
  const ruleById = new Map(rules.map((r) => [r.id, r]))
  const delta = after - before

  return (
    <aside className="tl-threats" aria-label="위협 목록">
      <div className="tl-threats__head">
        <div className="tl-threats__title">발견된 위협 {hasAi ? analysis.findings.length : 0}개</div>
        {hasAi && (
          <div className="tl-threats__compare" aria-label={`대응 전 ${before}, 대응 후 ${after}`}>
            <span>대응 전 <b>{before}</b></span>
            <span aria-hidden>→</span>
            <span>
              대응 후 <b style={{ color: scoreTone(after) }}>{after}</b>
            </span>
            {delta !== 0 && <Chip tone="low">{delta < 0 ? `−${-delta}` : `+${delta}`}</Chip>}
          </div>
        )}
      </div>

      <div className="tl-threats__list">
        {!hasAi && <p className="tl-threats__empty">AI 부품을 놓고 입력·도구와 이으면 위협이 여기에 나타납니다.</p>}
        {hasAi && analysis.findings.length === 0 && (
          <p className="tl-threats__empty">지금 구조에서 발견된 위협이 없습니다. 입력이나 도구를 이어 보세요.</p>
        )}
        {analysis.findings.map((f: Finding) => {
          const rule = ruleById.get(f.ruleId)
          if (!rule) return null
          const key = findingKey(f)
          const open = key === activeKey
          return (
            <Card key={key} danger={open && f.severity === 'high'}>
              <button type="button" className="tl-threat__head" aria-expanded={open} onClick={() => onToggleActive(key)}>
                <span className="tl-threat__top">
                  <SeverityChip severity={f.severity} />
                  <Chip tone={rule.category === 'chem' ? 'chem' : 'neutral'}>{CATEGORY_LABEL[rule.category]}</Chip>
                  <span className="tl-threat__id">{rule.id}</span>
                </span>
                <span className="tl-threat__title">{rule.title}</span>
                <span className="tl-threat__where">대상: {partLabel(graph, f.nodeId)}</span>
              </button>
              {open && (
                <div className="tl-threat__body">
                  <p className="tl-threat__summary">{rule.summary}</p>
                  <div className="tl-threat__sub">이렇게 막을 수 있습니다</div>
                  <div className="tl-threat__fixes">
                    {rule.fixes.map((fx) => {
                      const k = appliedKey(f.nodeId, f.ruleId, fx.id)
                      return <FixRow key={fx.id} label={fx.label} score={fx.score} checked={applied.has(k)} onChange={(on) => onToggleFix(k, on)} />
                    })}
                  </div>
                  <div className="tl-threat__sub">근거</div>
                  <ul className="tl-threat__basis">
                    {rule.basis.map((b, i) => (
                      <li key={i}>
                        {b.url ? (
                          <a href={b.url} target="_blank" rel="noreferrer">
                            {b.ref ?? b.source}
                          </a>
                        ) : (
                          (b.ref ?? b.source)
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </aside>
  )
}
