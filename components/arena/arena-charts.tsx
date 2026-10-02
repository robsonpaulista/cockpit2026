'use client'

type DayPoint = { day: string; comentarios?: number; curtidas?: number; points?: number }

function fmtDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

type Pt = { x: number; y: number }

/** Catmull-Rom → cubics — linhas suaves sem picos duros. */
function smoothLine(points: Pt[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`
  }

  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

type DualProps = {
  data: { day: string; comentarios: number; curtidas: number }[]
}

/** Gráfico full-width — duas séries, um eixo Y, curvas suaves. */
export function ArenaInteractionsChart({ data }: DualProps) {
  const w = 1120
  const h = 280
  const pad = { t: 36, r: 24, b: 32, l: 40 }
  const max = Math.max(1, ...data.flatMap((d) => [d.comentarios, d.curtidas]))
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b

  const xAt = (i: number) =>
    pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const yAt = (v: number) => pad.t + innerH - (v / max) * innerH

  const pts = (key: 'comentarios' | 'curtidas'): Pt[] =>
    data.map((d, i) => ({ x: xAt(i), y: yAt(d[key]) }))

  const last = data[data.length - 1]
  const lastI = Math.max(0, data.length - 1)

  return (
    <div className="arena-chart-wrap">
      <svg
        className="arena-chart"
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Interações por dia"
      >
        {[0, 0.5, 1].map((t) => {
          const yy = pad.t + innerH * (1 - t)
          return (
            <g key={t}>
              <line
                x1={pad.l}
                x2={w - pad.r}
                y1={yy}
                y2={yy}
                stroke="var(--cx-hairline, #e8e8e6)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={pad.l - 8}
                y={yy + 3}
                textAnchor="end"
                fontSize={11}
                fill="var(--cx-muted, #686865)"
                fontFamily="var(--arena-font-mono)"
              >
                {Math.round(max * t)}
              </text>
            </g>
          )
        })}

        <path
          d={smoothLine(pts('comentarios'))}
          fill="none"
          stroke="var(--cx-ink, #14161a)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={smoothLine(pts('curtidas'))}
          fill="none"
          stroke="var(--cx-amber, #e8a825)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {data.map((d, i) => (
          <text
            key={d.day}
            x={xAt(i)}
            y={h - 10}
            textAnchor="middle"
            fontSize={10}
            fill="var(--cx-muted, #686865)"
            fontFamily="var(--arena-font-mono)"
          >
            {fmtDay(d.day)}
          </text>
        ))}

        {last ? (
          <>
            <circle
              cx={xAt(lastI)}
              cy={yAt(last.comentarios)}
              r={4.5}
              fill="var(--cx-ink, #14161a)"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={xAt(lastI) - 6}
              y={yAt(last.comentarios) - 10}
              textAnchor="end"
              fontSize={12}
              fontWeight={700}
              fill="var(--cx-ink, #14161a)"
              fontFamily="var(--arena-font-mono)"
            >
              {last.comentarios}
            </text>
            <circle
              cx={xAt(lastI)}
              cy={yAt(last.curtidas)}
              r={4.5}
              fill="var(--cx-amber, #e8a825)"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={xAt(lastI) + 6}
              y={yAt(last.curtidas) - 10}
              textAnchor="start"
              fontSize={12}
              fontWeight={700}
              fill="var(--cx-amber, #e8a825)"
              fontFamily="var(--arena-font-mono)"
            >
              {last.curtidas}
            </text>
          </>
        ) : null}

        <g transform={`translate(${pad.l}, 14)`}>
          <rect width={12} height={3} y={-7} fill="var(--cx-ink, #14161a)" rx={1} />
          <text x={16} y={-4} fontSize={11} fill="var(--cx-muted, #686865)">
            Comentários
          </text>
          <rect x={110} width={12} height={3} y={-7} fill="var(--cx-amber, #e8a825)" rx={1} />
          <text x={126} y={-4} fontSize={11} fill="var(--cx-muted, #686865)">
            Curtidas
          </text>
        </g>
      </svg>
    </div>
  )
}

export function ArenaPointsBarChart({ data }: { data: DayPoint[] }) {
  const w = 1120
  const h = 200
  const pad = { t: 12, r: 12, b: 28, l: 12 }
  const max = Math.max(1, ...data.map((d) => d.points ?? 0))
  const slot = (w - pad.l - pad.r) / Math.max(1, data.length)
  const barW = Math.max(8, slot - 10)

  return (
    <div className="arena-chart-wrap arena-chart-wrap--bars">
      <svg
        className="arena-chart"
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Pontos por dia"
      >
        {data.map((d, i) => {
          const val = d.points ?? 0
          const bh = (val / max) * (h - pad.t - pad.b)
          const x = pad.l + i * slot + (slot - barW) / 2
          const y = pad.t + (h - pad.t - pad.b) - bh
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, bh)}
                rx={4}
                fill="var(--cx-amber, #e8a825)"
              />
              <text
                x={x + barW / 2}
                y={h - 8}
                textAnchor="middle"
                fontSize={10}
                fill="var(--cx-muted, #686865)"
                fontFamily="var(--arena-font-mono)"
              >
                {fmtDay(d.day)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
