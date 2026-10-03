import { useMemo, useRef } from 'react'
import type { Analysis } from '../domain/analyze'
import type { Graph } from '../domain/graph'
import { getPart } from '../domain/parts'
import type { HazardLevels } from '../domain/hazard'
import { planActions } from '../domain/plan'
import { EFFORT_LABEL, type Hazard, type Rule } from '../domain/rules'
import { scoreGraph } from '../domain/score'
import { Button, Chip, SeverityChip } from '../ui/components'
import { HazardTable, RiskDiamond } from './RiskDiamond'
import { scoreTone } from './scoreTone'
import { StoryLines } from './StoryLines'
import { findingKey } from './threat'

interface Props {
  graph: Graph
  rules: readonly Rule[]
  applied: ReadonlySet<string>
  analysis: Analysis
  levels: HazardLevels
  activeHazard: Hazard | null
  activeKey: string | null
  onToggleActive: (key: string) => void
  onApplyKeys: (keys: string[]) => void
  onClearApplied: () => void
}

const partLabel = (graph: Graph, nodeId: string) => getPart(graph.nodes.find((n) => n.id === nodeId)?.partId ?? '')?.label ?? '?'

export function PlanPanel({ graph, rules, applied, analysis, levels, activeHazard, activeKey, onToggleActive, onApplyKeys, onClearApplied }: Props) {
  const plan = useMemo(() => planActions(graph, rules, applied), [graph, rules, applied])
  const score = useMemo(() => scoreGraph(graph, rules, applied), [graph, rules, applied])
  const ruleById = useMemo(() => new Map(rules.map((r) => [r.id, r])), [rules])
  const headRef = useRef<HTMLHeadingElement>(null)
  const apply = (keys: string[]) => {
    onApplyKeys(keys)
    // 눌렀던 버튼이 목록에서 사라지므로 포커스를 "지금 할 일" 제목으로 보낸다
    requestAnimationFrame(() => headRef.current?.focus())
  }

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
          <h2 className="tl-plan__kicker">가장 먼저 막을 위험</h2>
          <div className="tl-plan__toprow">
            <SeverityChip severity={top.severity} />
            <span className="tl-threat__id">{topRule.id}</span>
          </div>
          <div className="tl-plan__toptitle">{topRule.title}</div>
          <p className="tl-plan__where">대상: {partLabel(graph, top.nodeId)}</p>
          <StoryLines story={topRule.story} />
          <Button className="tl-plan__show" aria-pressed={activeKey === topKey} onClick={() => onToggleActive(topKey)}>
            {activeKey === topKey ? '캔버스 표시 끄기' : '캔버스에서 경로 보기'}
          </Button>
        </section>
      )}

      {plan.steps.length > 0 ? (
        <section aria-label="지금 할 일">
          <div className="tl-plan__headrow">
            <h2 className="tl-plan__h" tabIndex={-1} ref={headRef}>
              지금 할 일 {plan.steps.length}개
            </h2>
            <div className="tl-plan__chain">
              <span className="tl-sr">점수 변화: {chain.map((n) => `${n}점`).join(', ')} 순</span>
              <span aria-hidden>
                {chain.map((n, i) => (
                  <span key={i}>
                    {i > 0 && ' → '}
                    <b style={{ color: scoreTone(n) }}>{n}</b>
                  </span>
                ))}
              </span>
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
                      <span className="tl-sr">
                        {s.before}점에서 {s.after}점으로
                      </span>
                      <span aria-hidden>
                        {s.before} → <b style={{ color: scoreTone(s.after) }}>{s.after}</b>
                      </span>
                    </span>
                    <Button className="tl-plan__one" aria-label={`${s.label} 적용`} onClick={() => apply(s.keys)}>
                      적용
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="primary" className="tl-plan__all" aria-label={`대응 ${plan.steps.length}개 적용 (${plan.before}점에서 ${plan.after}점으로)`} onClick={() => apply(allKeys)}>
            대응 {plan.steps.length}개 적용 ({plan.before} → {plan.after})
          </Button>
          <p className="tl-plan__note">
            점수를 많이 낮추면서 쉬운 대응부터 고릅니다. 적용하면 점수와 다음 할 일이 바로 바뀝니다. 난이도: 쉬움은 설정·문구 수준, 보통은 작은 개발이나 운영 절차 추가, 어려움은 구조를 바꾸거나 별도 구성이 필요한 일입니다(사람이 정한 값).
          </p>
        </section>
      ) : (
        <p className="tl-threats__empty">
          추천할 대응을 모두 적용했습니다. 남은 {plan.after}점은 대응을 다 해도 남는 위험(위협마다 최소 10%)입니다.
        </p>
      )}

      <p className="tl-plan__disclaimer">
        <b>이 점수는 0~100의 참고 지표입니다.</b> 사고가 날 확률이 아니고, 대응을 적용해 점수가 내려가도 실제 설비나 서비스가 안전해졌다는 보증이 아닙니다. 화공 공정에서는 HAZOP(위험성 평가)·LOPA(방호계층 분석), SIL(안전무결성 수준) 검증, IEC 61511 평가, 변경관리(MOC)를 대체하지 못하므로 공정안전 담당자와 확인하세요. 규칙과 정답 목록은 AI가 썼고 사람 전문가 검수 전입니다. <a href="#/eval">신뢰도와 한계는 평가표</a>에서 볼 수 있습니다.
      </p>

      <section className="tl-plan__hz" aria-label="위험 마름모">
        <h2 className="tl-sr">위험 마름모</h2>
        <RiskDiamond levels={levels} size={132} labels active={activeHazard} />
        <HazardTable levels={levels} active={activeHazard} />
      </section>

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
