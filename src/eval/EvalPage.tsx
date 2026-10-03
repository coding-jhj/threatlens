import { useMemo, useState } from 'react'
import addRaw from '../../docs/eval/ground-truth-additions.json?raw'
import raw from '../../docs/eval/ground-truth.json?raw'
import { RULES } from '../data'
import { Chip } from '../ui/components'
import { SAMPLES } from '../samples/samples'
import { evaluateAll, ratio, type GroundTruth, type GtThreat } from './evaluate'
import './eval.css'

const GT = JSON.parse(raw) as GroundTruth
const ADD = (JSON.parse(addRaw) as { structures: Record<string, { threats: GtThreat[] }> }).structures
const GT2: GroundTruth = {
  ...GT,
  structures: Object.fromEntries(Object.entries(GT.structures).map(([id, s]) => [id, { ...s, threats: [...s.threats, ...(ADD[id]?.threats ?? [])] }])),
}
const STATUS_LABEL: Record<string, string> = { 'confirmed-no-edits': '확정, 수정 없음' }
const TAG_TITLE: Record<string, string> = {
  LLM01: 'OWASP LLM01 프롬프트 주입',
  LLM02: 'OWASP LLM02 민감정보 노출',
  LLM03: 'OWASP LLM03 공급망',
  LLM04: 'OWASP LLM04 데이터·모델 오염',
  LLM05: 'OWASP LLM05 출력 처리 미흡',
  LLM06: 'OWASP LLM06 과도한 권한(에이전시)',
  LLM07: 'OWASP LLM07 시스템 프롬프트 노출',
  LLM08: 'OWASP LLM08 벡터·임베딩 취약점',
  LLM09: 'OWASP LLM09 잘못된 정보',
  LLM10: 'OWASP LLM10 무제한 소비',
  'OT-HUMAN-OVERSIGHT': 'CISA AI-OT 지침: 사람의 감독',
  'SIS-INDEPENDENCE': 'IEC 61511: 안전계장시스템(SIS)의 독립성',
}
const tagTitle = (t: string) => TAG_TITLE[t] ?? (/^T\d{4}/.test(t) ? `MITRE ATT&CK for ICS 기법 ${t}` : t)
function Tag({ t }: { t: string }) {
  return (
    <Chip tone="neutral">
      <abbr title={tagTitle(t)}>{t}</abbr>
    </Chip>
  )
}
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
        <span aria-hidden>
          {n} / {d}
        </span>
        <span className="tl-sr">
          {d}개 중 {n}개
        </span>
      </span>
      <p>{hint}</p>
    </div>
  )
}

export default function EvalPage() {
  const result = useMemo(() => evaluateAll(SAMPLES, RULES, GT), [])
  const v2 = useMemo(() => evaluateAll(SAMPLES, RULES, GT2), [])
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
        <Chip tone="medium">정답 작성: AI</Chip> 규칙을 보지 않은 별도 AI 에이전트가 공개 표준(OWASP LLM Top 10 2025, ATT&CK for ICS, CISA AI-OT 지침)만 보고 썼고, 사람 전문가의 검수는 거치지 않았습니다. 상태: {STATUS_LABEL[GT.status] ?? GT.status}
      </div>

      <section className="tl-eval__stats" aria-label="요약">
        <h2 className="tl-sr">요약</h2>
        <Stat label="재현율 (느슨)" n={result.found} d={result.threatTotal} hint="정답 위협마다, 근거 태그가 하나라도 겹치는 규칙이 발동했는가" />
        <Stat label="재현율 (엄격)" n={result.strict} d={result.threatTotal} hint="정답 위협의 근거 태그가 모두 발동한 규칙으로 덮였는가" />
        <Stat label="경보 적중률" n={result.matchedFired} d={result.comparable} hint="발동한 규칙(구조별) 중 정답 위협과 태그가 겹친 비율. 낮을수록 오탐이 많다는 뜻" />
      </section>

      <p className="tl-eval__muted">
        AI 판정자 3명이 따로 판정해 2명 이상이 동의한 보충 정답 7개를 넣은 <b>v2 기준</b>(정답 {v2.threatTotal}개): 재현율 느슨 {pct(v2.found, v2.threatTotal)} ({v2.found}/{v2.threatTotal}), 엄격 {pct(v2.strict, v2.threatTotal)} ({v2.strict}/{v2.threatTotal}). 위 숫자(v1)는 처음 쓴 정답 {result.threatTotal}개 기준입니다.
      </p>

      <p className="tl-eval__muted" aria-label="규칙 확장 전후">
        <b>규칙 28개 → 40개(G6) 전후 비교</b>, 정답표(v1)는 그대로 두었습니다: 재현율 느슨 21/29 (72%) → {result.found}/{result.threatTotal} ({pct(result.found, result.threatTotal)}), 엄격 15/29 (52%) → {result.strict}/{result.threatTotal} ({pct(result.strict, result.threatTotal)}), 경보 적중률 29/32 (91%) → {result.matchedFired}/{result.comparable} ({pct(result.matchedFired, result.comparable)}). 새 규칙 12개 중 정답표와 겹친 것은 8개이고, 나머지 3개(R-32, R-33, R-40, 구조별 발동 4건)는 정답표에 해당 위협이 없어 <b>정답표 확장 필요</b>로 분류합니다. 오탐으로 단정하지 않습니다.
      </p>

      <h2>구조별 결과</h2>
      <div className="tl-eval__scroll">
        <table className="tl-eval__table">
          <caption className="tl-sr">구조별 결과</caption>
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
                <Tag key={x} t={x} />
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
                <Tag key={x} t={x} />
              ))}
            </div>
            <p>{f.title}</p>
          </li>
        ))}
      </ul>

      <h2>
        <button type="button" className="tl-eval__toggle" aria-expanded={showStrict} aria-controls="tl-strict-list" onClick={() => setShowStrict((v) => !v)}>
          엄격 기준으로는 못 찾은 위협 ({looseOnly.length}개) <span aria-hidden>{showStrict ? '▲' : '▼'}</span>
        </button>
      </h2>
      {showStrict && (
        <ul className="tl-eval__list" id="tl-strict-list" aria-label="엄격 기준 미달">
          {looseOnly.map(({ s, t }) => (
            <li key={t.threat.id}>
              <div className="tl-eval__item-head">
                <b>{s.title}</b>
                <span className="tl-eval__muted">덮이지 않은 태그:</span>
                {t.uncoveredTags.map((x) => (
                  <Chip key={x} tone="medium">
                    <abbr title={tagTitle(x)}>{x}</abbr>
                  </Chip>
                ))}
              </div>
              <p>{t.threat.statement}</p>
            </li>
          ))}
        </ul>
      )}

      <h2>용어</h2>
      <dl className="tl-eval__notes">
        <dt>정답 위협</dt>
        <dd>구조마다 AI 에이전트가 공개 표준만 보고 적어 둔 &quot;이 구조에 있어야 할 위협&quot; 목록입니다.</dd>
        <dt>재현율</dt>
        <dd>정답 위협 중 ThreatLens가 찾아낸 비율입니다. 높을수록 덜 놓칩니다. 100%에 가까울수록 좋지만, 이 표본은 작아서 참고용입니다.</dd>
        <dt>경보 적중률</dt>
        <dd>ThreatLens가 띄운 경보 중 정답 위협과 겹친 비율입니다. 낮으면 쓸데없는 경보(오탐)가 많다는 뜻입니다.</dd>
        <dt>근거 태그</dt>
        <dd>위협의 분류 번호입니다. LLM01~LLM10은 OWASP LLM Top 10 2025 항목, T로 시작하는 번호는 ATT&amp;CK for ICS 기법입니다. 마우스를 올리면 이름이 보입니다.</dd>
      </dl>

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
