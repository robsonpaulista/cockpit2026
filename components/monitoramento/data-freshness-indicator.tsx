'use client'

import {
  formatDataFreshnessLabel,
  getDataFreshnessLevel,
  type DataFreshnessLevel,
} from '@/lib/data-freshness'
import { cn } from '@/lib/utils'

const DOT_CLASS: Record<DataFreshnessLevel, string> = {
  fresh: 'bg-emerald-600',
  stale: 'bg-amber-500',
  old: 'bg-red-600',
}

interface DataFreshnessIndicatorProps {
  lastUpdated: string | null
  isLive?: boolean
  className?: string
}

export function DataFreshnessIndicator({
  lastUpdated,
  isLive,
  className,
}: DataFreshnessIndicatorProps) {
  const level = getDataFreshnessLevel(lastUpdated, isLive)
  const label = formatDataFreshnessLabel(lastUpdated, isLive)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app px-2 py-0.5 text-[13px] font-medium text-text-primary',
        className
      )}
      title={lastUpdated ? new Date(lastUpdated).toLocaleString('pt-BR') : undefined}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          DOT_CLASS[level],
          level === 'fresh' && 'data-freshness-pulse'
        )}
        aria-hidden
      />
      {label}
    </span>
  )
}
