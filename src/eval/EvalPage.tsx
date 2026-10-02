import { useMemo, useState } from 'react'
import raw from '../../docs/eval/ground-truth.json?raw'
import { RULES } from '../data'
import { Chip } from '../ui/components'
import { SAMPLES } from '../samples/samples'
import { evaluateAll, ratio, type GroundTruth } from './evaluate'
import './eval.css'

const GT = JSON.parse(raw) as GroundTruth
const pct = (n: number, d: number) => {
  const r = ratio(n, d)
  return r === null ? '–' : `${Math.round(r * 100)}%`
}

function Stat({ label, n, d, hint }: { label: string; n: number; d: number; hint: string }) {
  return (
    <div className="tl-eval__stat">
      <span className="tl-eval__label">{label}</span>
      <b>{pct(n, d)}</b>
      <span className="tl-eval__count">
        {n} / {d}
      </span>
      <p>{hint}</p>
    </div>
  )
}

export default function EvalPage() {
  const result = useMemo(() => evaluateAll(SAMPLES, RULES, GT), [])
  const [showStrict, setShowStrict] = useState(false)
  const missed = result.structures.flatMap((s) => s.threats.filter((t) => !t.found).map((t) => ({ s, t })))
  const looseOnly = result.structures.flatMap((s) => s.threats.filter((t) => t.found && !t.strict).map((t) => ({ s, t })))
  const extra = result.structures.flatMap((s) => s.fired.filter((f) => f.inGroundTruth === false).map((f) => ({ s, f })))

  return (
    <main className="tl-eval">
      <h1>평가표</h1>
      <p className="tl-eval__lead">
        참조 구조 5개에서 ThreatLens가 <b>정답 위협 목록</b>을 얼마나 찾는지 잰 결과입니다. 점수는 대응책을 적용하지 않은 상태에서 계산했고, 이 화면의 숫자는 코드가 지금 규칙으로 직접 계산한 값입니다.
      </p>
      <div className="tl-eval__source" role="note">
        <Chip tone="medium">정답 작성: AI</Chip> 규칙을 보지 않은 별도 AI 에이전트가 공개 표준(OWASP LLM Top 10 2025, ATT&CK for ICS, CISA AI-OT 지침)만 보고 썼고, 사람 전문가의 검수는 거치지 않았습니다. 상태: <code>{GT.status}</code>
      </div>

      <section className="tl-eval__stats" aria-label="요약">
        <Stat label="재현율 (느슨)" n={result.found} d={result.threatTotal} hint="정답 위협마다, 근거 태그가 하나라도 겹치는 규칙이 발동했는가" />
        <Stat label="재현율 (엄격)" n={result.strict} d={result.threatTotal} hint="정답 위협의 근거 태그가 모두 발동한 규칙으로 덮였는가" />
        <Stat label="경보 적중률" n={result.matchedFired} d={result.comparable} hint="발동한 규칙(구조별) 중 정답 위협과 태그가 겹친 비율. 낮을수록 오탐이 많다는 뜻" />
      </section>

      <h2>구조별 결과</h2>
      <div className="tl-eval__scroll">
        <table className="tl-eval__table">
          <thead>
            <tr>
              <th>구조</th>
              <th>정답 위협</th>
              <th>찾음(느슨)</th>
              <th>찾음(엄격)</th>
              <th>발동 규칙</th>
              <th>정답과 겹침</th>
            </tr>
          </thead>
          <tbody>
            {result.structures.map((s) => (
              <tr key={s.id}>
                <th scope="row">{s.title}</th>
                <td>{s.threats.length}</td>
                <td>
                  {s.foundCount} <span className="tl-eval__muted">({pct(s.foundCount, s.threats.length)})</span>
                </td>
                <td>
                  {s.strictCount} <span className="tl-eval__muted">({pct(s.strictCount, s.threats.length)})</span>
                </td>
                <td>{s.fired.length}</td>
                <td>
                  {s.matchedFired} <span className="tl-eval__muted">({pct(s.matchedFired, s.comparable)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>놓친 위협 ({missed.length}개)</h2>
      <p className="tl-eval__muted">정답에는 있지만 발동한 규칙 중 근거 태그가 하나도 겹치지 않은 위협입니다. ThreatLens가 못 찾은 것으로 셉니다.</p>
      <ul className="tl-eval__list" aria-label="놓친 위협">
        {missed.map(({ s, t }) => (
          <li key={t.threat.id}>
            <div className="tl-eval__item-head">
              <b>{s.title}</b>
              {t.threat.tags.map((x) => (
                <Chip key={x} tone="neutral">
                  {x}
                </Chip>
              ))}
            </div>
            <p>{t.threat.statement}</p>
          </li>
        ))}
      </ul>

      <h2>정답에 없는 경보 ({extra.length}개)</h2>
      <p className="tl-eval__muted">발동했지만 정답 위협과 태그가 겹치지 않은 규칙입니다. 오탐일 수도 있고 정답 목록이 놓친 것일 수도 있어 사람이 판단해야 합니다.</p>
      <ul className="tl-eval__list" aria-label="정답에 없는 경보">
        {extra.length === 0 && <li>없음</li>}
        {extra.map(({ s, f }) => (
          <li key={`${s.id}-${f.ruleId}`}>
            <div className="tl-eval__item-head">
              <b>{s.title}</b>
              <Chip tone="neutral">{f.ruleId}</Chip>
              {f.tags.map((x) => (
                <Chip key={x} tone="neutral">
                  {x}
                </Chip>
              ))}
            </div>
            <p>{f.title}</p>
          </li>
        ))}
      </ul>

      <h2>
        <button type="button" className="tl-eval__toggle" aria-expanded={showStrict} onClick={() => setShowStrict((v) => !v)}>
          엄격 기준으로는 못 찾은 위협 ({looseOnly.length}개) {showStrict ? '▲' : '▼'}
        </button>
      </h2>
      {showStrict && (
        <ul className="tl-eval__list" aria-label="엄격 기준 미달">
          {looseOnly.map(({ s, t }) => (
            <li key={t.threat.id}>
              <div className="tl-eval__item-head">
                <b>{s.title}</b>
                <span className="tl-eval__muted">덮이지 않은 태그:</span>
                {t.uncoveredTags.map((x) => (
                  <Chip key={x} tone="medium">
                    {x}
                  </Chip>
                ))}
              </div>
              <p>{t.threat.statement}</p>
            </li>
          ))}
        </ul>
      )}

      <h2>읽는 법과 한계</h2>
      <ul className="tl-eval__notes">
        <li>비교는 근거 태그(OWASP LLM 번호, ATT&CK ICS 기법 번호 등)가 겹치는지로 합니다. 같은 위협을 다른 번호로 분류했으면 찾았어도 못 찾은 것으로 셀 수 있어, 특히 엄격 기준과 화공 구조에서 실제보다 낮게 나옵니다.</li>
        <li>반대로 하나의 번호(예: LLM06)에 규칙이 많아, 느슨 기준과 경보 적중률은 실제보다 높게 나올 수 있습니다.</li>
        <li>정답 목록과 규칙은 모두 AI가 썼습니다. 서로 독립적으로 쓰도록 했지만 완전한 독립은 증명할 수 없습니다.</li>
        <li>구조 5개, 정답 위협 {result.threatTotal}개는 작은 표본입니다. 이 숫자는 일반적인 성능이 아니라 이 5개 구조에서의 결과입니다.</li>
      </ul>
    </main>
  )
}
