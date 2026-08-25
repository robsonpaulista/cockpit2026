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
import type { TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import {
  cityTrendLabel,
  inferCityTrend,
  type CityTrendPoint,
} from '@/lib/instagram-city-trend'
import { cn } from '@/lib/utils'

type Props = {
  points: CityTrendPoint[]
  valueLabel?: string
  emptyHint?: string
  className?: string
}

function formatDay(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

function ChartTooltip({
  active,
  payload,
  valueLabel,
}: TooltipProps<ValueType, NameType> & { valueLabel: string }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as CityTrendPoint | undefined
  if (!row) return null
  return (
    <div className="rounded-lg border border-[var(--palette-divider)] bg-[var(--palette-card)] px-2.5 py-1.5 text-[11px] shadow-sm">
      <p className="font-medium text-[var(--palette-petrol)]">
        {row.label ?? formatDay(row.date)}
      </p>
      <p className="mt-0.5 tabular-nums text-[var(--palette-aux)]">
        {valueLabel}: {formatInt(row.value)}
        {row.postsCount && row.postsCount > 1
          ? ` · ${row.postsCount} posts no dia`
          : null}
      </p>
    </div>
  )
}

export function InstagramCityTrendChart({
  points,
  valueLabel = 'Engajamento',
  emptyHint = 'Sem série temporal para esta cidade.',
  className,
}: Props) {
  const trend = inferCityTrend(points)
  const chartData = points.map((p) => ({
    ...p,
    tick: formatDay(p.date),
  }))

  return (
    <div className={cn('mt-2', className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-[var(--palette-aux)]">
          Linha do tempo · {valueLabel.toLowerCase()}
        </p>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium',
            trend === 'up' && 'bg-[var(--palette-inst-soft)] text-[var(--palette-inst)]',
            trend === 'down' && 'bg-red-50 text-[var(--palette-reject)]',
            trend === 'stable' && 'bg-[var(--palette-bg)] text-[var(--palette-aux)]',
            trend === 'insufficient' && 'bg-[var(--palette-bg)] text-[var(--palette-aux)]',
          )}
        >
          {cityTrendLabel(trend)}
        </span>
      </div>

      {points.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-[var(--palette-aux)]">{emptyHint}</p>
      ) : (
        <div className="h-[92px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--palette-divider)"
              />
              <XAxis
                dataKey="tick"
                tick={{ fontSize: 9, fill: 'var(--palette-aux)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                width={36}
                tick={{ fontSize: 9, fill: 'var(--palette-aux)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v)
                }
              />
              <Tooltip
                content={<ChartTooltip valueLabel={valueLabel} />}
                cursor={{ stroke: 'var(--palette-neutral-bar)' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--palette-inst)"
                strokeWidth={2}
                dot={{ r: points.length <= 12 ? 3 : 0, fill: 'var(--palette-inst)', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
