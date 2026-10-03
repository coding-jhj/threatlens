import { useEffect, useMemo, useRef, useState } from 'react'
import { RULES } from '../data'
import { planActions } from '../domain/plan'
import { scoreGraph } from '../domain/score'
import { QUESTIONS, buildFromAnswers } from '../wizard/wizard'
import type { EditorGraph } from './model'
import { Button } from '../ui/components'
import { useModal } from './useModal'
import './editor.css'

/** 질문 8개에 예/아니오로 답하면 규칙표대로 구조를 만들어 캔버스에 연다. AI 호출 없음. */
export function Wizard({ onClose, onOpen }: { onClose: () => void; onOpen: (graph: EditorGraph) => void }) {
  const box = useModal(onClose)
  const [answers, setAnswers] = useState<boolean[]>([])
  const step = answers.length
  const done = step >= QUESTIONS.length
  const head = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    head.current?.focus()
  }, [step])

  const graph = useMemo(() => (done ? buildFromAnswers(answers) : null), [done, answers])
  const result = useMemo(() => (graph ? { score: scoreGraph(graph, RULES).overall, plan: planActions(graph, RULES) } : null), [graph])
  const answer = (v: boolean) => setAnswers((a) => [...a, v])

  return (
    <div className="tl-modal" role="dialog" aria-modal="true" aria-labelledby="tl-wiz-title">
      <div className="tl-modal__box" ref={box}>
        <h2 id="tl-wiz-title" ref={head} tabIndex={-1}>
          {done ? '구조가 만들어졌습니다' : `질문 ${step + 1} / ${QUESTIONS.length}`}
        </h2>
        <progress className="tl-wiz__bar" value={step} max={QUESTIONS.length} aria-label="진행 상황" />
        {!done ? (
          <>
            <p className="tl-wiz__q">{QUESTIONS[step].text}</p>
            <p className="tl-wiz__hint">{QUESTIONS[step].hint}</p>
            <div className="tl-modal__actions">
              <Button variant="primary" onClick={() => answer(true)}>
                예
              </Button>
              <Button onClick={() => answer(false)}>아니오</Button>
              {step > 0 && <Button onClick={() => setAnswers((a) => a.slice(0, -1))}>이전 질문</Button>}
              <Button onClick={onClose}>취소</Button>
            </div>
          </>
        ) : (
          graph &&
          result && (
            <>
              <p className="tl-wiz__q">
                부품 {graph.nodes.length}개, 연결 {graph.edges.length}개로 그렸습니다. 지금 위험 점수는 <b>{result.score}</b>점(0~100 참고 지표)이고, [도면 열기]를 누르면 행동 계획 {result.plan.steps.length}개가 나옵니다.
              </p>
              <p className="tl-wiz__hint">답변은 규칙표로 부품과 화살표를 만들 뿐이며, 연 뒤에는 자유롭게 고칠 수 있습니다. 맞는 구조인지는 직접 확인하세요.</p>
              <div className="tl-modal__actions">
                <Button variant="primary" onClick={() => onOpen(graph)}>
                  도면 열기
                </Button>
                <Button onClick={() => setAnswers([])}>처음부터 다시</Button>
                <Button onClick={() => setAnswers((a) => a.slice(0, -1))}>이전 질문</Button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
