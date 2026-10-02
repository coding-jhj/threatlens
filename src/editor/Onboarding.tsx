import { useEffect } from 'react'
import { Button } from '../ui/components'
import './editor.css'

export function Onboarding({ onClose, onSample }: { onClose: () => void; onSample: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="tl-modal" role="dialog" aria-modal="true" aria-labelledby="tl-onb-title">
      <div className="tl-modal__box">
        <h2 id="tl-onb-title">처음이신가요? 3단계면 됩니다</h2>
        <ol className="tl-onb__steps">
          <li>
            <b>부품을 놓습니다.</b> 왼쪽 목록의 부품을 클릭하거나 캔버스로 끌어 놓습니다. AI 부품을 꼭 하나 넣으세요.
          </li>
          <li>
            <b>화살표로 잇습니다.</b> 부품 오른쪽 점을 끌어 다음 부품 왼쪽 점에 놓습니다.
          </li>
          <li>
            <b>AI를 눌러 속성을 고릅니다.</b> 체크하면 오른쪽에 위협 카드가 나오고 점수가 바로 바뀝니다.
          </li>
        </ol>

        <div className="tl-onb__arrow">
          <svg width="260" height="64" viewBox="0 0 260 64" role="img" aria-label="웹 페이지에서 AI 에이전트로 향하는 화살표 예시">
            <rect x="2" y="12" width="90" height="40" rx="8" fill="none" stroke="currentColor" />
            <text x="47" y="37" textAnchor="middle" fontSize="12" fill="currentColor">웹 페이지</text>
            <rect x="168" y="12" width="90" height="40" rx="8" fill="none" stroke="currentColor" />
            <text x="213" y="37" textAnchor="middle" fontSize="12" fill="currentColor">AI 에이전트</text>
            <path d="M92 32h68m0 0-8-6m8 6-8 6" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p>
            <b>화살표는 정보·명령이 흐르는 방향</b>입니다. 위 그림은 "AI가 웹 페이지를 읽는다"는 뜻이고, 반대로 "AI → 메일 전송"은 "AI가 메일을 보낸다"는 뜻입니다.
          </p>
        </div>

        <div className="tl-modal__actions">
          <Button variant="primary" onClick={onSample}>
            예시로 시작 (메일 비서)
          </Button>
          <Button onClick={onClose}>직접 그리기</Button>
        </div>
      </div>
    </div>
  )
}
