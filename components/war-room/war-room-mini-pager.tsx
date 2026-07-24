'use client'

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

export function warRoomPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

type Props = {
  page: number
  total: number
  pageSize: number
  onChange: (page: number) => void
  className?: string
}

/** Paginação compacta da War Room (setas + n/total). */
export function WarRoomMiniPager({
  page,
  total,
  pageSize,
  onChange,
  className,
}: Props) {
  const pages = warRoomPageCount(total, pageSize)
  if (total <= pageSize) return null

  return (
    <div
      className={cn(
        'flex h-7 shrink-0 items-center justify-end gap-1.5',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page <= 0}
        onClick={() => onChange(page - 1)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#ebe8e4] text-[#57534e] transition-colors hover:bg-[#f6f5f2] disabled:pointer-events-none disabled:opacity-35"
      >
        <IconChevronLeft className="h-3.5 w-3.5" stroke={1.5} />
      </button>
      <span className="min-w-[2.5rem] text-center text-[11px] tabular-nums text-[#78716c]">
        {page + 1}/{pages}
      </span>
      <button
        type="button"
        aria-label="Próxima página"
        disabled={page >= pages - 1}
        onClick={() => onChange(page + 1)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#ebe8e4] text-[#57534e] transition-colors hover:bg-[#f6f5f2] disabled:pointer-events-none disabled:opacity-35"
      >
        <IconChevronRight className="h-3.5 w-3.5" stroke={1.5} />
      </button>
    </div>
  )
}
