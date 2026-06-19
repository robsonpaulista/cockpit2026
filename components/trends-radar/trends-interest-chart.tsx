'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { GoogleTrendsSeries } from '@/lib/google-trends-types'

const LINE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#ca8a04']

function formatDateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

interface TrendsInterestChartProps {
  series: GoogleTrendsSeries[]
  chartData: Array<Record<string, string | number>>
  loading?: boolean
}

export function TrendsInterestChart({ series, chartData, loading = false }: TrendsInterestChartProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-10 text-center text-sm text-text-muted">
        Carregando gráfico…
      </div>
    )
  }

  if (series.length === 0 || chartData.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-6 py-10 text-center text-sm text-text-muted">
        Sem dados de interesse ainda. Rode a coleta do Google Trends.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-4">
      <div className="mb-3">
        <h2 className="text-sm font-medium text-text-primary">Interesse de busca ao longo do tempo</h2>
        <p className="text-xs text-text-muted">Índice relativo 0–100 · Google Trends</p>
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border-tertiary)/0.5)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }}
              minTickGap={24}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }}
              width={28}
            />
            <Tooltip
              labelFormatter={(v) => formatDateLabel(String(v))}
              formatter={(value: number) => [value, 'Interesse']}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s, i) => (
              <Line
                key={s.searchTerm}
                type="monotone"
                dataKey={s.name}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
