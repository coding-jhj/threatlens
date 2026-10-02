export type Severity = 'high' | 'medium' | 'low'
export const SEVERITY_LABEL: Record<Severity, string> = { high: '높음', medium: '중간', low: '낮음' }

export function formatDelta(score: number): string {
  return score < 0 ? `−${Math.abs(score)}` : `+${score}`
}
