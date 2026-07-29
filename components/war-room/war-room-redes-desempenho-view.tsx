'use client'

import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import { cn } from '@/lib/utils'

export type WarRoomDesempenhoSparkPoint = {
  date: string
  label: string
  value: number
}

export type WarRoomDesempenhoKpi = {
  id: string
  label: string
  total: number
  deltaPct: number | null
  series: WarRoomDesempenhoSparkPoint[]
  /** Split opcional (seguidor × não-seguidor). */
  followersPct?: number | null
  nonFollowersPct?: number | null
  legend?: string
  /** Sobrescreve o total formatado (ex.: taxa de conversão). */
  valueLabel?: string
}

type Props = {
  kpis: WarRoomDesempenhoKpi[]
  className?: string
}

function formatDelta(deltaPct: number | null): string {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return '—'
  const sign = deltaPct > 0 ? '+' : ''
  return `${sign}${deltaPct.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`
}

function formatPct1(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`
}

function DesempenhoCard({ kpi }: { kpi: WarRoomDesempenhoKpi }) {
  const up = kpi.deltaPct != null && kpi.deltaPct > 0
  const down = kpi.deltaPct != null && kpi.deltaPct < 0
  const hasChart = kpi.series.length > 1

  return (
    <article className="wr-redes-desempenho__card">
      <header className="wr-redes-desempenho__head">
        <h3 className="wr-redes-desempenho__label">{kpi.label}</h3>
      </header>
      <div className="wr-redes-desempenho__value-row">
        <p className="wr-redes-desempenho__total tabular-nums">
          {kpi.valueLabel ?? formatWarRoomNumber(kpi.total)}
        </p>
        <span
          className={cn(
            'wr-redes-desempenho__delta tabular-nums',
            up && 'wr-redes-desempenho__delta--up',
            down && 'wr-redes-desempenho__delta--down',
          )}
        >
          {formatDelta(kpi.deltaPct)}
        </span>
      </div>
      {kpi.followersPct != null || kpi.nonFollowersPct != null ? (
        <p className="wr-redes-desempenho__split">
          <span>Seg. {kpi.followersPct != null ? formatPct1(kpi.followersPct) : '—'}</span>
          <span>
            Não seg. {kpi.nonFollowersPct != null ? formatPct1(kpi.nonFollowersPct) : '—'}
          </span>
        </p>
      ) : null}
      <div className="wr-redes-desempenho__chart">
        {hasChart ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kpi.series} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--wr-slate)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="wr-redes-desempenho__chart-empty" aria-hidden />
        )}
      </div>
      {kpi.legend ? <p className="wr-redes-desempenho__legend">{kpi.legend}</p> : null}
    </article>
  )
}

/** Mini cards de desempenho (KPI + sparkline), estilo Meta Desempenho. */
export function WarRoomRedesDesempenhoView({ kpis, className }: Props) {
  if (kpis.length === 0) {
    return (
      <p className="wr-redes-clean__state">
        Sem histórico diário ainda. Os gráficos aparecem após alguns dias de coleta.
      </p>
    )
  }

  return (
    <div className={cn('wr-redes-desempenho', className)} aria-label="Desempenho Instagram">
      {kpis.map((kpi) => (
        <DesempenhoCard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  )
}
