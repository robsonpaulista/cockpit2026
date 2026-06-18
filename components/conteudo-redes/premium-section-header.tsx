import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PremiumSectionHeaderProps = {
  title: string
  description?: string
  hint?: string
  actions?: ReactNode
  className?: string
}

export function PremiumSectionHeader({
  title,
  description,
  hint,
  actions,
  className,
}: PremiumSectionHeaderProps) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-text-primary">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
        {hint ? <p className="mt-1 text-[11px] text-text-muted">{hint}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
