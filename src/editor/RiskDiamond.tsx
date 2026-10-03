import { HAZARDS, HAZARD_HINT, HAZARD_LABEL, type Hazard } from '../domain/rules'
import { MAX_LEVEL, type HazardLevels } from '../domain/hazard'

/** 네 칸의 위치: 위=주입, 오른쪽=유출, 아래=오용, 왼쪽=설비 */
const DIR: Record<Hazard, [number, number]> = { inject: [0, -1], leak: [1, 0], misuse: [0, 1], plant: [-1, 0] }
const COLOR: Record<Hazard, string> = { inject: 'var(--hz-inject)', leak: 'var(--hz-leak)', misuse: 'var(--hz-misuse)', plant: 'var(--hz-plant)' }

export function RiskDiamond({ levels, size = 56, labels = false, active = null, decorative = false }: { levels: HazardLevels; size?: number; labels?: boolean; active?: Hazard | null; decorative?: boolean }) {
  const c = 50
  const r = 38
  const pt = (h: Hazard, lv: number) => `${c + DIR[h][0] * (r * lv) / MAX_LEVEL},${c + DIR[h][1] * (r * lv) / MAX_LEVEL}`
  const ring = (lv: number) => HAZARDS.map((h) => pt(h, lv)).join(' ')
  const summary = `위험 마름모: ${HAZARDS.map((h) => `${HAZARD_LABEL[h]} ${levels[h]}`).join(', ')} (각 0~${MAX_LEVEL})`
  return (
    <svg className="tl-diamond" width={labels ? size * 1.4 : size} height={size} viewBox={labels ? '-20 -6 140 112' : '0 0 100 100'} {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': summary })}>
      {[1, 2, 3, 4].map((lv) => (
        <polygon key={lv} points={ring(lv)} fill="none" stroke="var(--line-strong)" strokeWidth={lv === MAX_LEVEL ? 1.5 : 0.6} opacity={lv === MAX_LEVEL ? 1 : 0.6} />
      ))}
      {HAZARDS.map((h) => (
        <line key={h} x1={c} y1={c} x2={c + DIR[h][0] * r} y2={c + DIR[h][1] * r} stroke="var(--line-strong)" strokeWidth={0.6} opacity={0.6} />
      ))}
      <polygon points={HAZARDS.map((h) => pt(h, levels[h])).join(' ')} fill="var(--red)" fillOpacity={0.18} stroke="var(--red)" strokeWidth={2} strokeLinejoin="round" />
      {HAZARDS.map((h) => {
        const [dx, dy] = DIR[h]
        const lv = levels[h]
        const on = active === h
        return (
          <g key={h}>
            <circle cx={c + (dx * r * lv) / MAX_LEVEL} cy={c + (dy * r * lv) / MAX_LEVEL} r={on ? 6 : 4} fill={COLOR[h]} stroke="var(--panel)" strokeWidth={1.5} />
            {labels && (
              <text
                x={c + dx * (r + 9)}
                y={c + dy * (r + 9) + 3}
                textAnchor={dx === 0 ? 'middle' : dx > 0 ? 'start' : 'end'}
                fontSize={9}
                fontWeight={on ? 800 : 600}
                fill="var(--text)"
              >
                {HAZARD_LABEL[h]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function HazardTable({ levels, active }: { levels: HazardLevels; active: Hazard | null }) {
  return (
    <table className="tl-hz">
      <caption className="tl-hz__cap">위험 종류별 수준 (0~{MAX_LEVEL})</caption>
      <thead className="tl-sr">
        <tr>
          <th scope="col">종류</th>
          <th scope="col">수준</th>
          <th scope="col">뜻</th>
        </tr>
      </thead>
      <tbody>
        {HAZARDS.map((h) => (
          <tr key={h} className={active === h ? 'is-active' : ''}>
            <th scope="row">
              <span className="tl-hz__dot" style={{ background: COLOR[h] }} aria-hidden />
              {HAZARD_LABEL[h]}
            </th>
            <td className="tl-hz__lv">{levels[h]}</td>
            <td className="tl-hz__hint">{HAZARD_HINT[h]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
