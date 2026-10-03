import { useEffect, useRef } from 'react'
import { Button } from '../ui/components'
import './editor.css'

export function Onboarding({ onClose, onSample }: { onClose: () => void; onSample: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const focusables = () => [...(box.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, [tabindex]:not([tabindex="-1"])') ?? [])]
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [onClose])

  return (
    <div className="tl-modal" role="dialog" aria-modal="true" aria-labelledby="tl-onb-title">
      <div className="tl-modal__box" ref={box}>
        <h2 id="tl-onb-title">처음이신가요? 3단계면 됩니다</h2>
        <p>ThreatLens는 AI 서비스의 구조를 부품으로 그리면 보안 위협과 대응책을 알려주는 도구입니다. 서버 없이 이 브라우저 안에서만 계산합니다. 점수는 사고 확률이 아닌 참고 지표이며, 규칙과 정답 목록은 AI가 썼고 사람 전문가 검수 전입니다(평가표 참고).</p>
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

        <h3 className="tl-onb__sub">조작 요약</h3>
        <ul className="tl-onb__keys">
          <li><b>삭제</b> 부품·화살표를 클릭하고 Delete 또는 [선택 삭제]. 전부 지우려면 [모두 지우기]</li>
          <li><b>취소</b> Ctrl+Z (다시 실행은 Ctrl+Shift+Z). [예시 불러오기]·[모두 지우기]도 되돌릴 수 있습니다</li>
          <li><b>여러 개 선택</b> Ctrl+A(전체), 또는 Shift를 누른 채 드래그</li>
          <li><b>화살표</b> 오른쪽 점을 끌어 다른 부품의 점 또는 부품 위에 놓습니다. 키보드로는 부품을 선택(Enter)한 뒤 오른쪽 속성 창의 [화살표 관리]에서 대상을 고릅니다</li>
          <li><b>화면 이동·확대</b> 빈 곳을 끌면 이동, 마우스 휠로 확대·축소</li>
        </ul>

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
