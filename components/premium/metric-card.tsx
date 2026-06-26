'use client'

import type { TablerIcon } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { metricCardClass, metricCardCompactClass } from '@/lib/premium-ui-classes'

interface PremiumMetricCardProps {
  label: string
  value: string | number
  contextLine?: string
  icon: TablerIcon
  className?: string
  compact?: boolean
  labelClassName?: string
  valueClassName?: string
  contextClassName?: string
  iconClassName?: string
}

export function PremiumMetricCard({
  label,
  value,
  contextLine,
  icon: Icon,
  className,
  compact = false,
  labelClassName,
  valueClassName,
  contextClassName,
  iconClassName,
}: PremiumMetricCardProps) {
  return (
    <div className={cn(compact ? metricCardCompactClass : metricCardClass, 'text-center', className)}>
      <div className={cn('flex items-center justify-center gap-1.5', compact ? 'mb-1' : 'mb-2')}>
        <Icon
          className={cn(
            'h-[14px] w-[14px] shrink-0',
            iconClassName ?? 'text-[rgb(var(--color-primary))]',
          )}
          stroke={1.5}
          aria-hidden
        />
        <span className={cn('text-[12px] font-medium', labelClassName ?? 'text-text-secondary')}>
          {label}
        </span>
      </div>
      <p
        className={cn(
          'text-[26px] font-medium leading-none tabular-nums',
          valueClassName ?? 'text-text-primary',
        )}
      >
        {value}
      </p>
      {contextLine ? (
        <p
          className={cn(
            compact ? 'mt-1' : 'mt-2',
            'text-[11px]',
            contextClassName ?? 'text-text-muted',
          )}
        >
          {contextLine}
        </p>
      ) : null}
    </div>
  )
}
