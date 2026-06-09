'use client'

import type { TablerIcon } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { metricCardClass } from '@/lib/premium-ui-classes'

interface PremiumMetricCardProps {
  label: string
  value: string | number
  contextLine?: string
  icon: TablerIcon
  className?: string
}

export function PremiumMetricCard({
  label,
  value,
  contextLine,
  icon: Icon,
  className,
}: PremiumMetricCardProps) {
  return (
    <div className={cn(metricCardClass, 'text-center', className)}>
      <div className="mb-2 flex items-center justify-center gap-1.5">
        <Icon
          className="h-[14px] w-[14px] shrink-0 text-[rgb(var(--color-primary))]"
          stroke={1.5}
          aria-hidden
        />
        <span className="text-[12px] font-medium text-text-secondary">{label}</span>
      </div>
      <p className="text-[26px] font-medium leading-none tabular-nums text-text-primary">{value}</p>
      {contextLine ? (
        <p className="mt-2 text-[11px] text-text-muted">{contextLine}</p>
      ) : null}
    </div>
  )
}
