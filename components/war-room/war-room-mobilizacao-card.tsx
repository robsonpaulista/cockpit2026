'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import {
  WAR_ROOM_MOBILIZACAO_MOCK,
  type WarRoomMobilizacaoFunilTone,
} from '@/lib/war-room/mock-data'
import { cn } from '@/lib/utils'

const FUNIL_COLOR: Record<WarRoomMobilizacaoFunilTone, string> = {
  planejado: 'var(--wr-gold)',
  andamento: 'color-mix(in srgb, var(--wr-mist) 40%, var(--wr-slate))',
  concluido: 'var(--wr-slate)',
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

function MobilizacaoDonut({
  segments,
  pctConcluido,
}: {
  segments: Array<{ key: WarRoomMobilizacaoFunilTone; value: number }>
  pctConcluido: number
}) {
  const size = 132
  const strokeWidth = 14
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - strokeWidth / 2
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  const gap = 2.5

  let cursor = 0
  const arcs = segments.map((segment) => {
    const sweep = (segment.value / total) * 360
    const start = cursor + gap / 2
    const end = cursor + sweep - gap / 2
    cursor += sweep
    return {
      key: segment.key,
      path: describeArc(cx, cy, r, start, Math.max(start + 0.5, end)),
    }
  })

  return (
    <div
      className="wr-mob-funil__donut"
      role="img"
      aria-label={`Mobilização ${pctConcluido}% concluído`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {arcs.map((arc) => (
          <path
            key={arc.key}
            d={arc.path}
            fill="none"
            stroke={FUNIL_COLOR[arc.key]}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="wr-mob-funil__donut-center">
        <span className="wr-mob-funil__donut-pct">{pctConcluido}%</span>
        <span className="wr-mob-funil__donut-label">Concluído</span>
      </div>
    </div>
  )
}

type Props = {
  className?: string
}

/** Mobilização — funil de ações com donut + legenda. */
export function WarRoomMobilizacaoCard({ className }: Props) {
  const data = WAR_ROOM_MOBILIZACAO_MOCK

  return (
    <section
      id="wr-mobilizacao"
      className={cn('wr-mob-funil', 'wr-cell--mobilizacao', className)}
      aria-label="Mobilização — funil de ações"
    >
      <header className="wr-mob-funil__header">
        <h2 className="wr-mob-funil__heading">Mobilização – Funil de ações</h2>
        <p className="wr-mob-funil__sub">Progresso da mobilização</p>
      </header>

      <div className="wr-mob-funil__body">
        <MobilizacaoDonut segments={data.funil} pctConcluido={data.pctConcluido} />

        <ul className="wr-mob-funil__legend" aria-label="Legenda do funil">
          {data.funil.map((step) => (
            <li key={step.key} className="wr-mob-funil__legend-row">
              <span
                className="wr-mob-funil__swatch"
                style={{ background: FUNIL_COLOR[step.key] }}
                aria-hidden
              />
              <span className="wr-mob-funil__legend-label">{step.label}</span>
              <span className="wr-mob-funil__legend-value tabular-nums">
                {step.value.toLocaleString('pt-BR')}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Link href="/dashboard/mobilizacao" className="wr-mob-funil__footer">
        <span>Ver plano completo</span>
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      </Link>
    </section>
  )
}
