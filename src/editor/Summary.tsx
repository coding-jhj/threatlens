import type { Analysis } from '../domain/analyze'
import type { HazardLevels } from '../domain/hazard'
import type { Hazard } from '../domain/rules'
import { Chip } from '../ui/components'
import { RiskDiamond } from './RiskDiamond'
import { scoreTone } from './scoreTone'
import './editor.css'

export function Summary({ score, analysis, hasAi, levels, activeHazard = null }: { score: number; analysis: Analysis; hasAi: boolean; levels?: HazardLevels; activeHazard?: Hazard | null }) {
  const count = (s: 'high' | 'medium' | 'low') => analysis.findings.filter((f) => f.severity === s).length
  return (
    <div className="tl-summary" aria-live="polite">
      {hasAi && levels && <RiskDiamond levels={levels} size={52} active={activeHazard} decorative />}
      <div className="tl-summary__score" style={{ color: hasAi ? scoreTone(score) : 'var(--muted)' }} aria-label={hasAi ? `위험 점수 ${score}` : '위험 점수 아직 없음'}>
        {hasAi ? score : '–'}
      </div>
      <div>
        <div className="tl-summary__label" title="0~100의 참고 지표입니다. 사고 확률이 아닙니다.">
          위험 점수<span className="tl-sr"> (0~100점 참고 지표, 사고 확률 아님)</span>
          <span aria-hidden> /100</span>
        </div>
        <div className="tl-summary__chips">
          {hasAi ? (
            <>
              <span className="tl-sr">위협 개수</span>
              <Chip tone="high">높음 {count('high')}</Chip>
              <Chip tone="medium">중간 {count('medium')}</Chip>
              <Chip tone="low">낮음 {count('low')}</Chip>
            </>
          ) : (
            <span className="tl-summary__hint">아직 없음. AI 부품을 놓으면 분석이 시작됩니다</span>
          )}
        </div>
      </div>
    </div>
  )
}
