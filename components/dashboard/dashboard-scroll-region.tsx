'use client'

import { useDashboardFixedChromeActive } from '@/contexts/dashboard-page-chrome-context'
import { cn } from '@/lib/utils'

/** Região de scroll da coluna principal — respeita páginas com chrome fixo. */
export function DashboardScrollRegion({ children }: { children: React.ReactNode }) {
  const fixedChrome = useDashboardFixedChromeActive()

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col',
        fixedChrome ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'
      )}
    >
      {children}
    </div>
  )
}
