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
        <h2 className="text-[15px] font-semibold tracking-tight text-[#1c1917]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[13px] text-[#78716c]">{description}</p>
        ) : null}
        {hint ? <p className="mt-1 text-[12px] text-[#a8a29e]">{hint}</p> : null}
      </div>
      {actions ? (
        <div className="-mx-1 flex shrink-0 items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
