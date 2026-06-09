'use client'

import { IconAlertTriangle } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

interface SectionDividerProps {
  label: string
  variant: 'risk' | 'date'
}

export function SectionDivider({ label, variant }: SectionDividerProps) {
  return (
    <div
      className={cn(
        'noticias-section-divider my-2 flex items-center gap-3',
        variant === 'risk' ? 'text-[#A32D2D]' : 'text-text-muted'
      )}
      role="separator"
    >
      {variant === 'risk' ? (
        <IconAlertTriangle className="h-3 w-3 shrink-0" stroke={1.75} aria-hidden />
      ) : null}
      <span className="shrink-0 text-[11px] font-medium">{label}</span>
    </div>
  )
}
