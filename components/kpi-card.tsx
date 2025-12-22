'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KPI } from '@/types'
import Link from 'next/link'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface KPICardProps {
  kpi: KPI
  href?: string
}

export function KPICard({ kpi, href = '#' }: KPICardProps) {
  const hasVariation = kpi.variation !== undefined
  const variationValue = kpi.variation ?? 0
  const isPositive = hasVariation && variationValue > 0
  const isNegative = hasVariation && variationValue < 0
  const VariationIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

  const statusColors = {
    success: 'text-status-success',
    warning: 'text-status-warning',
    error: 'text-status-error',
    neutral: 'text-text-muted',
  }

  const statusBgColors = {
    success: 'bg-status-success/10',
    warning: 'bg-status-warning/10',
    error: 'bg-status-error/10',
    neutral: 'bg-primary-soft',
  }

  const content = (
    <div
      className={cn(
        'p-5 rounded-2xl border border-border bg-surface',
        'hover:shadow-card-hover hover:border-primary/20 transition-all duration-200 ease-premium',
        'cursor-pointer group'
      )}
    >
      {/* Label */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-text-muted">{kpi.label}</p>
        {kpi.status && (
          <div className={cn('w-2 h-2 rounded-full', statusBgColors[kpi.status])} />
        )}
      </div>

      {/* Value */}
      <div className="mb-3">
        <p className="text-3xl font-semibold text-text-strong group-hover:text-primary transition-colors">
          {typeof kpi.value === 'number' ? kpi.value : kpi.value}
        </p>
      </div>

      {/* Variation & Sparkline */}
      <div className="flex items-end justify-between">
        {hasVariation && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
              isPositive && 'bg-status-success/10 text-status-success',
              isNegative && 'bg-status-error/10 text-status-error',
              !isPositive && !isNegative && 'bg-primary-soft text-primary'
            )}
          >
            <VariationIcon className="w-3 h-3" />
            <span>{Math.abs(variationValue)}%</span>
            <span className="text-text-muted ml-1">7d</span>
          </div>
        )}

        {kpi.sparkline && kpi.sparkline.length > 0 && (
          <div className="w-20 h-8 -mr-2 opacity-60 group-hover:opacity-100 transition-opacity">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpi.sparkline.map((v, i) => ({ value: v, index: i }))}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={kpi.status === 'error' ? '#DC2626' : '#1E4ED8'}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

