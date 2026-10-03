import { useMemo } from 'react'
import type { Analysis } from '../domain/analyze'
import type { Graph } from '../domain/graph'
import { getPart } from '../domain/parts'
import { planActions } from '../domain/plan'
import { EFFORT_LABEL, type Rule } from '../domain/rules'
import { scoreGraph } from '../domain/score'
import { Button, Chip, SeverityChip } from '../ui/components'
import { scoreTone } from './scoreTone'
import { findingKey } from './threat'

interface Props {
  graph: Graph
  rules: readonly Rule[]
  applied: ReadonlySet<string>
  analysis: Analysis
  activeKey: string | null
  onToggleActive: (key: string) => void
  onApplyKeys: (keys: string[]) => void
  onClearApplied: () => void
}

const partLabel = (graph: Graph, nodeId: string) => getPart(graph.nodes.find((n) => n.id === nodeId)?.partId ?? '')?.label ?? '?'

export function PlanPanel({ graph, rules, applied, analysis, activeKey, onToggleActive, onApplyKeys, onClearApplied }: Props) {
  const plan = useMemo(() => planActions(graph, rules, applied), [graph, rules, applied])
  const score = useMemo(() => scoreGraph(graph, rules, applied), [graph, rules, applied])
  const ruleById = useMemo(() => new Map(rules.map((r) => [r.id, r])), [rules])

  if (analysis.findings.length === 0) {
    return <p className="tl-threats__empty">지금 구조에서 발견된 위협이 없습니다. 입력이나 도구를 이어 보세요.</p>
  }

  const top = [...score.findings].sort((a, b) => b.risk - a.risk)[0]
  const topRule = top && ruleById.get(top.ruleId)
  const topKey = top ? findingKey(top) : null
  const chain = [plan.before, ...plan.steps.map((s) => s.after)]
  const allKeys = plan.steps.flatMap((s) => s.keys)

  return (
    <div className="tl-plan">
      {topRule && top && topKey && (
        <section className="tl-plan__top" aria-label="가장 먼저 막을 위험">
          <div className="tl-plan__kicker">가장 먼저 막을 위험</div>
          <div className="tl-plan__toprow">
            <SeverityChip severity={top.severity} />
            <span className="tl-threat__id">{topRule.id}</span>
          </div>
          <div className="tl-plan__toptitle">{topRule.title}</div>
          <p className="tl-plan__where">대상: {partLabel(graph, top.nodeId)}</p>
          <Button className="tl-plan__show" aria-pressed={activeKey === topKey} onClick={() => onToggleActive(topKey)}>
            {activeKey === topKey ? '캔버스 표시 끄기' : '캔버스에서 경로 보기'}
          </Button>
        </section>
      )}

      {plan.steps.length > 0 ? (
        <section aria-label="지금 할 일">
          <div className="tl-plan__headrow">
            <h3 className="tl-plan__h">지금 할 일 {plan.steps.length}개</h3>
            <div className="tl-plan__chain" aria-label={`점수 ${chain.join(' → ')}`}>
              {chain.map((n, i) => (
                <span key={i}>
                  {i > 0 && <span aria-hidden> → </span>}
                  <b style={{ color: scoreTone(n) }}>{n}</b>
                </span>
              ))}
            </div>
          </div>
          <ol className="tl-plan__steps">
            {plan.steps.map((s, i) => (
              <li key={s.keys[0]} className="tl-plan__step">
                <span className="tl-plan__num" aria-hidden>
                  {i + 1}
                </span>
                <div className="tl-plan__body">
                  <div className="tl-plan__label">{s.label}</div>
                  <div className="tl-plan__meta">
                    {partLabel(graph, s.nodeId)} · {s.ruleIds.join(', ')} 대응
                  </div>
                  <div className="tl-plan__foot">
                    <Chip tone="neutral">난이도 {EFFORT_LABEL[s.effort]}</Chip>
                    <span className="tl-plan__delta">
                      {s.before} → <b style={{ color: scoreTone(s.after) }}>{s.after}</b>
                    </span>
                    <Button className="tl-plan__one" aria-label={`${s.label} 적용`} onClick={() => onApplyKeys(s.keys)}>
                      적용
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="primary" className="tl-plan__all" onClick={() => onApplyKeys(allKeys)}>
            대응 {plan.steps.length}개 적용 ({plan.before} → {plan.after})
          </Button>
          <p className="tl-plan__note">
            점수를 많이 낮추면서 쉬운 대응부터 고릅니다. 적용하면 점수와 다음 할 일이 바로 바뀝니다.
          </p>
        </section>
      ) : (
        <p className="tl-threats__empty">
          추천할 대응을 모두 적용했습니다. 남은 {plan.after}점은 대응을 다 해도 남는 위험(위협마다 최소 10%)입니다.
        </p>
      )}

      {applied.size > 0 && (
        <div className="tl-plan__applied">
          적용한 대응 {applied.size}개
          <Button className="tl-plan__reset" onClick={onClearApplied}>
            모두 해제
          </Button>
        </div>
      )}
    </div>
  )
}
