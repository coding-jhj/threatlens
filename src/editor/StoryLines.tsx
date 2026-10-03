const LABELS = ['원인', 'AI가 하는 일', '결과'] as const

/** 규칙의 공격 시나리오 3줄 (원인 → AI가 하는 일 → 결과) */
export function StoryLines({ story }: { story: readonly [string, string, string] }) {
  return (
    <ol className="tl-story" aria-label="이런 일이 벌어질 수 있습니다">
      {story.map((line, i) => (
        <li key={i}>
          <span className="tl-story__k">{LABELS[i]}</span>
          <span>{line}</span>
        </li>
      ))}
    </ol>
  )
}
