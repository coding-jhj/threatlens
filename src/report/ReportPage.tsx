import { useMemo, useState } from 'react'
import { RULES } from '../data'
import { Chip, SeverityChip, Button } from '../ui/components'
import { SEVERITY_LABEL } from '../ui/severity'
import { scoreTone } from '../editor/scoreTone'
import type { Workspace } from '../workspace'
import { RiskDiamond } from '../editor/RiskDiamond'
import { ReportDiagram } from './ReportDiagram'
import { STORY_LABELS, buildReport, downloadText, reportDate, reportToMarkdown } from './report'
import './report.css'

export default function ReportPage({ ws }: { ws: Workspace }) {
  const { state, applied } = ws
  const [now] = useState(() => new Date())
  const report = useMemo(() => buildReport(state.graph, RULES, applied, now), [state.graph, applied, now])
  const date = reportDate(report.generatedAt)

  if (!report.hasAi) {
    return (
      <main className="tl-report-empty">
        <h1>보고서</h1>
        <p>
          아직 분석할 구조가 없습니다. <a href="#/">위협 지도</a>에서 AI 부품을 놓고 구조를 그린 뒤 다시 오세요.
        </p>
      </main>
    )
  }

  return (
    <main className="tl-report-wrap">
      <div className="tl-report-bar">
        <Button variant="primary" onClick={() => downloadText(`threatlens-report-${date}.md`, reportToMarkdown(report))}>
          Markdown으로 저장
        </Button>
        <Button onClick={() => window.print()}>PDF로 저장 (인쇄)</Button>
        <span className="tl-report-bar__hint">인쇄 창에서 대상을 "PDF로 저장"으로 고르면 PDF 파일이 됩니다.</span>
      </div>

      <article className="tl-report" aria-label="위협 분석 보고서">
        <section className="tl-report__sheet" aria-label="요약 장">
          <table className="tl-report__title">
            <tbody>
              <tr>
                <th scope="row">문서</th>
                <td colSpan={3}>ThreatLens 위협 분석 보고서</td>
              </tr>
              <tr>
                <th scope="row">작성일</th>
                <td>{date}</td>
                <th scope="row">위험 점수</th>
                <td>
                  <b style={{ color: scoreTone(report.before) }}>{report.before}</b> → <b style={{ color: scoreTone(report.after) }}>{report.after}</b> <span className="tl-report__muted">(대응 전 → 대응 후)</span>
                </td>
              </tr>
              <tr>
                <th scope="row">위협</th>
                <td>
                  {report.findings.length}개 · 적용한 대응 {report.appliedCount}개
                </td>
                <th scope="row">검수</th>
                <td>AI 교차검증, 사람 전문가 검수 전</td>
              </tr>
            </tbody>
          </table>

          <h1 className="tl-sr">ThreatLens 위협 분석 보고서</h1>
          <h2>구조 도면</h2>
          <ReportDiagram diagram={report.diagram} />
          <p className="tl-report__legend">
            <span className="tl-report__key tl-report__key--red" aria-hidden /> 위험 경로 <span className="tl-report__key tl-report__key--amber" aria-hidden /> 신뢰 경계를 넘는 연결 <span className="tl-report__key tl-report__key--ink" aria-hidden /> 그 밖의 연결 (화살표는 정보·명령이 흐르는 방향)
          </p>

          <h2>요약</h2>
          <div className="tl-report__sum">
            <p>{report.summary}</p>
            <RiskDiamond levels={report.levels} size={120} labels />
          </div>
        </section>

        <section className="tl-report__sheet tl-report__sheet--plan" aria-label="행동 계획">
          <h2>행동 계획</h2>
          {report.steps.length === 0 ? (
            <p>더 적용할 대응이 없습니다.</p>
          ) : (
            <table className="tl-report__table">
              <thead>
                <tr>
                  <th scope="col">순서</th>
                  <th scope="col">대응</th>
                  <th scope="col">대상</th>
                  <th scope="col">난이도</th>
                  <th scope="col">해결하는 위협</th>
                  <th scope="col">예상 점수</th>
                </tr>
              </thead>
              <tbody>
                {report.steps.map((s) => (
                  <tr key={s.order}>
                    <td>{s.order}</td>
                    <td>{s.label}</td>
                    <td>{s.target}</td>
                    <td>{s.effort}</td>
                    <td>{s.ruleIds.join(', ')}</td>
                    <td>
                      {s.before} → <b>{s.after}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="tl-report__muted">순서는 점수가 크게 내려가고 난이도가 낮은 대응부터 정한 것입니다. 점수는 참고 지표이며 실제 안전을 보증하지 않습니다.</p>

          <h2>분석한 구조</h2>
          <h3>부품</h3>
          <ul>
            {report.parts.map((p) => (
              <li key={p.name}>
                {p.name}
                {p.attributes.length > 0 && <span className="tl-report__muted"> ({p.attributes.join(', ')})</span>}
              </li>
            ))}
          </ul>
          <h3>연결 (화살표는 정보·명령이 흐르는 방향)</h3>
          <ul>
            {report.connections.length === 0 && <li>없음</li>}
            {report.connections.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>

          <h2>위험 경로</h2>
          <ul>
            {report.paths.length === 0 && <li>위험한 입력에서 AI를 거쳐 밖으로 이어지는 경로가 없습니다.</li>}
            {report.paths.map((p) => (
              <li key={p.text}>
                <Chip tone={p.severity}>{SEVERITY_LABEL[p.severity]}</Chip> {p.text}
              </li>
            ))}
          </ul>
        </section>

        <h2>위협 상세</h2>
        {report.findings.length === 0 && <p>발견된 위협이 없습니다.</p>}
        {report.findings.map((f) => (
          <section key={`${f.ruleId}|${f.target}`} className="tl-report__finding">
            <h3>
              <SeverityChip severity={f.severity} /> {f.ruleId} {f.title}
            </h3>
            <p className="tl-report__muted">
              분류 {f.category} · 대상 {f.target} ·{' '}
              <strong>{f.resolved ? '해결됨' : f.fixes.some((x) => x.applied) ? '일부 대응 적용' : '대응 필요'}</strong>
            </p>
            <p>{f.summary}</p>
            <ol className="tl-report__story" aria-label="이런 일이 벌어질 수 있습니다">
              {f.story.map((s, i) => (
                <li key={i}>
                  <b>{STORY_LABELS[i]}</b> {s}
                </li>
              ))}
            </ol>
            <ul className="tl-report__fixes">
              {f.fixes.map((x) => (
                <li key={x.label}>
                  {x.applied ? '☑' : '☐'} {x.label} <span className="tl-report__muted">({x.score})</span>
                </li>
              ))}
            </ul>
            <p className="tl-report__basis">
              근거:{' '}
              {f.basis.map((b, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  {b.url ? (
                    <a href={b.url} target="_blank" rel="noreferrer">
                      {b.label}
                    </a>
                  ) : (
                    b.label
                  )}
                </span>
              ))}
            </p>
          </section>
        ))}

        <h2>읽는 법과 한계</h2>
        <ul>
          <li>점수는 사람이 작성한 규칙으로 계산한 상대적 위험 지표이며, 실제 사고 확률이 아닙니다.</li>
          <li>그려 넣은 구조와 체크한 속성만 분석합니다. 빠진 부품이나 잘못 체크한 속성은 결과에 반영되지 않습니다.</li>
          <li>대응책을 모두 적용해도 위험이 0이 되지는 않습니다.</li>
          <li>규칙과 정답 목록은 AI가 작성했고 사람 전문가 검수 전입니다. 화공 공정은 HAZOP·LOPA, SIL 검증, IEC 61511 평가, 변경관리(MOC)를 대체하지 못하므로 공정안전 담당자와 확인하세요.</li>
        </ul>
      </article>
    </main>
  )
}
