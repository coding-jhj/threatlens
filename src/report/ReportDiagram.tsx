import type { Diagram } from './report'
import { NODE_H, NODE_W } from './report'

const R = 6

/** 보고서용 도면: 부품 상자와 화살표. 위험 경로는 빨강 실선, 신뢰 경계를 넘는 연결은 주황 점선, 사외 부품은 점선 테두리. */
export function ReportDiagram({ diagram }: { diagram: Diagram }) {
  const by = new Map(diagram.nodes.map((n) => [n.id, n]))
  const outside = diagram.nodes.filter((n) => n.outside)
  const zone =
    outside.length > 0
      ? {
          x: Math.min(...outside.map((n) => n.x)) - 10,
          y: Math.min(...outside.map((n) => n.y)) - 22,
          w: Math.max(...outside.map((n) => n.x + NODE_W)) - Math.min(...outside.map((n) => n.x)) + 20,
          h: Math.max(...outside.map((n) => n.y + NODE_H)) - Math.min(...outside.map((n) => n.y)) + 32,
        }
      : null
  const w = Math.max(diagram.width, zone ? zone.x + zone.w + 12 : 0)
  const h = Math.max(diagram.height, zone ? zone.y + zone.h + 12 : 0)
  const desc = `${diagram.nodes.length}개 부품과 ${diagram.edges.length}개 연결`
  return (
    <svg className="tl-rdiag" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`구조 도면: ${desc}`}>
      <defs>
        {(['ink', 'red', 'amber'] as const).map((c) => (
          <marker key={c} id={`rd-arrow-${c}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10Z" className={`tl-rdiag__m tl-rdiag__m--${c}`} />
          </marker>
        ))}
      </defs>
      {zone && (
        <g>
          <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx={8} className="tl-rdiag__zone" />
          <text x={zone.x + 8} y={zone.y + 14} className="tl-rdiag__zonelabel">
            사외 (회사 밖)
          </text>
        </g>
      )}
      {diagram.edges.map((e) => {
        const a = by.get(e.from)
        const b = by.get(e.to)
        if (!a || !b) return null
        const x1 = a.x + NODE_W
        const y1 = a.y + NODE_H / 2
        const x2 = b.x
        const y2 = b.y + NODE_H / 2
        const mid = Math.max(24, Math.abs(x2 - x1) / 2)
        const cls = e.risk ? 'red' : e.cross ? 'amber' : 'ink'
        return <path key={e.id} d={`M${x1} ${y1} C${x1 + mid} ${y1} ${x2 - mid} ${y2} ${x2} ${y2}`} className={`tl-rdiag__edge tl-rdiag__edge--${cls}${e.cross ? ' is-cross' : ''}`} markerEnd={`url(#rd-arrow-${cls})`} />
      })}
      {diagram.nodes.map((n) => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={R} className={`tl-rdiag__node tl-rdiag__node--${n.kind}${n.ai ? ' is-ai' : ''}`} />
          <text x={n.x + 8} y={n.y + 16} className="tl-rdiag__tag">
            {n.tag}
          </text>
          <text x={n.x + 8} y={n.y + 38} className="tl-rdiag__name">
            {n.name.length > 12 ? `${n.name.slice(0, 11)}…` : n.name}
          </text>
        </g>
      ))}
    </svg>
  )
}
