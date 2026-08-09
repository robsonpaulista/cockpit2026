'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import { cn } from '@/lib/utils'
import type {
  WarRoomDesempenhoKpi,
  WarRoomDesempenhoSparkPoint,
} from '@/components/war-room/war-room-redes-desempenho-view'

type Props = {
  kpis: WarRoomDesempenhoKpi[]
  className?: string
  compact?: boolean
}

function formatDelta(deltaPct: number | null): string {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return '—'
  const sign = deltaPct > 0 ? '↑ ' : deltaPct < 0 ? '↓ ' : ''
  return `${sign}${Math.abs(deltaPct).toLocaleString('pt-BR', {
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

function formatAxis(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  }
  return value.toLocaleString('pt-BR')
}

function DesempenhoMetaCard({
  kpi,
  compact = false,
}: {
  kpi: WarRoomDesempenhoKpi
  compact?: boolean
}) {
  const up = kpi.deltaPct != null && kpi.deltaPct > 0
  const down = kpi.deltaPct != null && kpi.deltaPct < 0
  const hasChart = kpi.series.length > 1
  const tickEvery = Math.max(1, Math.floor(kpi.series.length / 5))

  return (
    <article className="wr-copiloto-redes-desempenho__card" data-wr-kpi={kpi.id}>
      <header className="wr-copiloto-redes-desempenho__head">
        <h3 className="wr-copiloto-redes-desempenho__label">{kpi.label}</h3>
        <div className="wr-copiloto-redes-desempenho__head-value">
          <p className="wr-copiloto-redes-desempenho__total tabular-nums">
            {kpi.valueLabel ?? formatWarRoomNumber(kpi.total)}
          </p>
          <span
            className={cn(
              'wr-copiloto-redes-desempenho__delta tabular-nums',
              up && 'wr-copiloto-redes-desempenho__delta--up',
              down && 'wr-copiloto-redes-desempenho__delta--down',
            )}
          >
            {formatDelta(kpi.deltaPct)}
          </span>
        </div>
      </header>

      {!compact && (kpi.followersPct != null || kpi.nonFollowersPct != null) ? (
        <p className="wr-copiloto-redes-desempenho__split">
          <span>Seg. {kpi.followersPct != null ? formatPct1(kpi.followersPct) : '—'}</span>
          <span>
            Não seg. {kpi.nonFollowersPct != null ? formatPct1(kpi.nonFollowersPct) : '—'}
          </span>
        </p>
      ) : null}

      {compact && (kpi.followersPct != null || kpi.nonFollowersPct != null) ? (
        <p className="wr-copiloto-redes-desempenho__split wr-copiloto-redes-desempenho__split--inline">
          Seg. {kpi.followersPct != null ? formatPct1(kpi.followersPct) : '—'}
          {' · '}
          Não seg. {kpi.nonFollowersPct != null ? formatPct1(kpi.nonFollowersPct) : '—'}
        </p>
      ) : null}

      <div className="wr-copiloto-redes-desempenho__chart">
        {hasChart ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={kpi.series}
              margin={
                compact
                  ? { top: 4, right: 8, left: 0, bottom: 0 }
                  : { top: 8, right: 10, left: 0, bottom: 0 }
              }
            >
              <CartesianGrid
                stroke="color-mix(in srgb, var(--wr-slate, #424E5C) 6%, transparent)"
                strokeDasharray="3 6"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={tickEvery}
                minTickGap={compact ? 40 : 28}
                tick={{ fontSize: compact ? 9 : 10, fill: 'var(--wr-aux, #6b7280)' }}
                height={compact ? 16 : 24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={compact ? 30 : 42}
                tickFormatter={formatAxis}
                tick={{ fontSize: compact ? 9 : 10, fill: 'var(--wr-aux, #6b7280)' }}
              />
              <Tooltip
                formatter={(value) => [
                  formatWarRoomNumber(typeof value === 'number' ? value : Number(value) || 0),
                  kpi.label,
                ]}
                labelFormatter={(label) => String(label)}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid color-mix(in srgb, var(--wr-slate) 10%, transparent)',
                  boxShadow: '0 8px 24px color-mix(in srgb, var(--wr-petrol) 8%, transparent)',
                  fontSize: 12,
                  background: 'var(--wr-card, #fff)',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={kpi.label}
                stroke="color-mix(in srgb, var(--wr-petrol, #022b3a) 72%, var(--wr-aux, #6b7280))"
                strokeWidth={compact ? 1.75 : 2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: 'var(--wr-petrol, #022b3a)',
                  stroke: 'var(--wr-card, #fff)',
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="wr-copiloto-redes-desempenho__chart-empty">Sem série diária</div>
        )}
      </div>

      {!compact && kpi.legend ? (
        <p className="wr-copiloto-redes-desempenho__legend">
          <span className="wr-copiloto-redes-desempenho__legend-swatch" aria-hidden />
          {kpi.legend}
        </p>
      ) : null}
    </article>
  )
}

/** Grade Meta Business — visualizações, alcance, engajamento, visitas, seguidores. */
export function WarRoomCopilotoRedesDesempenho({ kpis, className, compact = false }: Props) {
  if (kpis.length === 0) {
    return (
      <p className="wr-copiloto-redes__empty">
        Sem histórico diário ainda. Os gráficos aparecem após coleta de snapshots do Instagram.
      </p>
    )
  }

  return (
    <div
      className={cn(
        'wr-copiloto-redes-desempenho',
        compact && 'wr-copiloto-redes-desempenho--compact',
        className,
      )}
      aria-label="Desempenho Instagram"
    >
      {kpis.map((kpi) => (
        <DesempenhoMetaCard key={kpi.id} kpi={kpi} compact={compact} />
      ))}
    </div>
  )
}

export type { WarRoomDesempenhoSparkPoint }
