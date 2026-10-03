import { useState } from 'react'
import type { Analysis } from '../domain/analyze'
import { appliedKey, type Finding } from '../domain/engine'
import type { HazardLevels } from '../domain/hazard'
import type { Graph } from '../domain/graph'
import { getPart } from '../domain/parts'
import { CATEGORY_LABEL, type Hazard, type Rule } from '../domain/rules'
import { Card, Chip, FixRow, SeverityChip } from '../ui/components'
import { PlanPanel } from './PlanPanel'
import { StoryLines } from './StoryLines'
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
  levels: HazardLevels
  activeHazard: Hazard | null
  onApplyKeys: (keys: string[]) => void
  onClearApplied: () => void
}

const partLabel = (graph: Graph, nodeId: string) => {
  const n = graph.nodes.find((x) => x.id === nodeId)
  return (n && getPart(n.partId)?.label) ?? '?'
}

export function ThreatPanel({ graph, analysis, rules, applied, before, after, hasAi, activeKey, onToggleActive, onToggleFix, levels, activeHazard, onApplyKeys, onClearApplied }: Props) {
  const [tab, setTab] = useState<'plan' | 'threats'>('plan')
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

      {hasAi && (
        <div className="tl-tabs" role="tablist" aria-label="위협 패널">
          {(['plan', 'threats'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`tl-tab-${t}`}
              aria-selected={tab === t}
              aria-controls="tl-tabpanel"
              tabIndex={tab === t ? 0 : -1}
              className="tl-tab"
              onClick={() => setTab(t)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  const next = tab === 'plan' ? 'threats' : 'plan'
                  setTab(next)
                  requestAnimationFrame(() => document.getElementById(`tl-tab-${next}`)?.focus())
                }
              }}
            >
              {t === 'plan' ? '행동 계획' : `위협 ${analysis.findings.length}`}
            </button>
          ))}
        </div>
      )}

      <div className="tl-threats__list" id="tl-tabpanel" role={hasAi ? 'tabpanel' : undefined} aria-labelledby={hasAi ? `tl-tab-${tab}` : undefined}>
        {hasAi && tab === 'plan' && (
          <PlanPanel
            graph={graph}
            rules={rules}
            applied={applied}
            analysis={analysis}
            levels={levels}
            activeHazard={activeHazard}
            activeKey={activeKey}
            onToggleActive={onToggleActive}
            onApplyKeys={onApplyKeys}
            onClearApplied={onClearApplied}
          />
        )}
        {!hasAi && <p className="tl-threats__empty">AI 부품을 놓고 입력·도구와 이으면 위협이 여기에 나타납니다.</p>}
        {hasAi && tab === 'threats' && analysis.findings.length === 0 && (
          <p className="tl-threats__empty">지금 구조에서 발견된 위협이 없습니다. 입력이나 도구를 이어 보세요.</p>
        )}
        {tab === 'threats' && analysis.findings.map((f: Finding) => {
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
                  <StoryLines story={rule.story} />
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
