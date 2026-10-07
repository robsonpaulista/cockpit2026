'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import type { CityTrendPoint } from '@/lib/instagram-city-trend'

type Props = {
  points: CityTrendPoint[]
  valueLabel: string
  emptyHint: string
}

function formatDay(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function ChartTooltip({ active, payload, valueLabel }: TooltipProps<ValueType, NameType> & { valueLabel: string }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as CityTrendPoint | undefined
  if (!row) return null
  return (
    <div className="rounded-lg border border-[#DDDDDD] bg-white px-2.5 py-1.5 text-[11px] text-[#333333] shadow-sm">
      <p className="font-bold">{row.label ?? formatDay(row.date)}</p>
      <p className="mt-0.5 tabular-nums text-[#717171]">
        {valueLabel}: {row.value.toLocaleString('pt-BR')}
        {row.postsCount && row.postsCount > 1 ? ` · ${row.postsCount} posts no dia` : null}
      </p>
    </div>
  )
}

/** Linha do tempo compacta de uma cidade (engajamento por dia ou snapshots de seguidores). */
export function InstagramCityTrendChart({ points, valueLabel, emptyHint }: Props) {
  if (points.length === 0) {
    return <p className="py-4 text-center text-[12px] text-[var(--tse-muted)]">{emptyHint}</p>
  }

  const chartData = points.map((p) => ({ ...p, tick: formatDay(p.date) }))

  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#EEEEEE" />
          <XAxis
            dataKey="tick"
            tick={{ fontSize: 10, fill: '#717171' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            width={36}
            tick={{ fontSize: 10, fill: '#717171' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v))}
          />
          <Tooltip content={<ChartTooltip valueLabel={valueLabel} />} cursor={{ stroke: '#DDDDDD' }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#6A8421"
            strokeWidth={2}
            dot={{ r: points.length <= 12 ? 3 : 0, fill: '#EBB402', strokeWidth: 0 }}
            activeDot={{ r: 4, fill: '#EBB402' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
