'use client'

import { IconSparkles } from '@tabler/icons-react'
import type { WarRoomCardChange } from '@/lib/war-room/change-snapshots'
import { cn } from '@/lib/utils'

type Props = {
  change: WarRoomCardChange | null
  className?: string
}

/** Indicador compacto de “o que mudou” após refresh silencioso. */
export function WarRoomChangeBadge({ change, className }: Props) {
  if (!change) return null
  return (
    <span
      className={cn(
        'inline-flex max-w-[9.5rem] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        'bg-[var(--wr-orange-tint)] text-[var(--wr-orange)]',
        className,
      )}
      title={change.summary}
    >
      <IconSparkles className="h-3 w-3 shrink-0" stroke={1.5} aria-hidden />
      <span className="truncate normal-case tracking-normal">{change.summary}</span>
    </span>
  )
}
