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
import type { CandidatosEngajamentoChartModel } from '@/lib/war-room/instagram-candidatos-engajamento'
import { cn } from '@/lib/utils'

type Props = {
  model: CandidatosEngajamentoChartModel
  className?: string
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

export function WarRoomCopilotoCandidatosEngajamentoChart({ model, className }: Props) {
  if (model.empty || model.lines.length === 0) {
    return (
      <p className="wr-copiloto-redes__empty">
        Sem engajamento diário dos candidatos no período.
      </p>
    )
  }

  const tickEvery = Math.max(1, Math.floor(model.chartData.length / 8))

  return (
    <div className={cn('wr-copiloto-redes-candidatos', className)}>
      <div className="wr-copiloto-redes-candidatos__chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={model.chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid
              stroke="color-mix(in srgb, var(--wr-slate, #424E5C) 12%, transparent)"
              strokeDasharray="0"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={tickEvery}
              minTickGap={28}
              tick={{ fontSize: 10, fill: 'var(--wr-aux, #6b7280)' }}
              height={20}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={formatAxis}
              tick={{ fontSize: 10, fill: 'var(--wr-aux, #6b7280)' }}
              domain={[0, (dataMax: number) => Math.max(dataMax * 1.15, 1)]}
            />
            <Tooltip
              formatter={(value, name) => [
                formatWarRoomNumber(typeof value === 'number' ? value : Number(value) || 0),
                String(name),
              ]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                borderRadius: 10,
                border: '1px solid var(--wr-divider, #e5e7eb)',
                fontSize: 12,
              }}
            />
            {model.lines.map((line) => (
              <Line
                key={line.slug}
                type="monotone"
                dataKey={line.slug}
                name={line.name}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="wr-copiloto-redes-candidatos__legend">
        {model.lines.map((line) => (
          <span key={line.slug} className="wr-copiloto-redes-candidatos__legend-item" title={line.name}>
            <span
              className="wr-copiloto-redes-candidatos__legend-swatch"
              style={{ backgroundColor: line.color }}
              aria-hidden
            />
            <span className="wr-copiloto-redes-candidatos__legend-name">{line.name}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
