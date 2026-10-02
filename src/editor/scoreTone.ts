export function scoreTone(score: number): string {
  return score >= 60 ? 'var(--red)' : score >= 30 ? 'var(--amber)' : 'var(--green)'
}
