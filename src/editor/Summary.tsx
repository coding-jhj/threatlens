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
      {hasAi && levels && <RiskDiamond levels={levels} size={52} active={activeHazard} />}
      <div className="tl-summary__score" style={{ color: hasAi ? scoreTone(score) : 'var(--muted)' }} aria-label={`위험 점수 ${score}`}>
        {hasAi ? score : '–'}
      </div>
      <div>
        <div className="tl-summary__label">위험 점수</div>
        <div className="tl-summary__chips">
          {hasAi ? (
            <>
              <Chip tone="high">높음 {count('high')}</Chip>
              <Chip tone="medium">중간 {count('medium')}</Chip>
              <Chip tone="low">낮음 {count('low')}</Chip>
            </>
          ) : (
            <span className="tl-summary__hint">AI 부품을 놓으면 분석이 시작됩니다</span>
          )}
        </div>
      </div>
    </div>
  )
}
