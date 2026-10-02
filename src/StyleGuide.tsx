import { useState } from 'react'
import { Button, Card, Chip, FixRow, SeverityChip } from './ui/components'
import { Icon, type IconName } from './ui/Icon'

const COLORS = ['bg', 'panel', 'panel-2', 'line', 'text', 'muted', 'accent', 'red', 'amber', 'green', 'purple']
const ICONS: IconName[] = ['user', 'doc', 'ai', 'db', 'log', 'mail', 'code', 'bolt', 'sensor', 'plc', 'globe', 'shield', 'search', 'check']

export default function StyleGuide() {
  const [on, setOn] = useState([true, false, false])
  return (
    <main style={{ padding: 32, maxWidth: 960, display: 'grid', gap: 28 }}>
      <h1>ThreatLens 스타일 가이드</h1>
      <section aria-label="색상" style={{ display: 'grid', gap: 8 }}>
        <h2>색상 토큰</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <div key={c} style={{ width: 96 }}>
              <div style={{ height: 44, borderRadius: 8, border: '1px solid var(--line)', background: `var(--${c})` }} />
              <div className="tl-mono">--{c}</div>
            </div>
          ))}
        </div>
      </section>
      <section aria-label="버튼과 칩" style={{ display: 'grid', gap: 12 }}>
        <h2>버튼 · 칩</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="primary">분석 다시 실행</Button>
          <Button>링크 복사</Button>
          <Button variant="inverse" large>보고서 내보내기</Button>
          <Button disabled>비활성</Button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SeverityChip severity="high" />
          <SeverityChip severity="medium" />
          <SeverityChip severity="low" />
          <Chip tone="chem">화공 특화</Chip>
          <Chip>믿을 수 없는 입력</Chip>
        </div>
      </section>
      <section aria-label="카드" style={{ display: 'grid', gap: 12, maxWidth: 440 }}>
        <h2>위협 카드 · 대응 체크</h2>
        <Card danger>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SeverityChip severity="high" />
              <span className="tl-mono">R-01</span>
            </div>
            <strong>외부 문서 속 숨은 명령으로 메일 도구가 악용됩니다</strong>
            {['전송 전 사람 승인 단계 추가', '도구 권한 최소화', '입력 출처를 AI에게 구분해서 전달'].map((t, i) => (
              <FixRow
                key={t}
                label={t}
                score={[-30, -20, -15][i]}
                checked={on[i]}
                onChange={(v) => setOn(on.map((x, j) => (j === i ? v : x)))}
              />
            ))}
          </div>
        </Card>
      </section>
      <section aria-label="아이콘" style={{ display: 'grid', gap: 8 }}>
        <h2>아이콘</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--accent)' }}>
          {ICONS.map((n) => (
            <span key={n} title={n}><Icon name={n} size={24} /></span>
          ))}
        </div>
      </section>
    </main>
  )
}
