'use client'

import { dashboardPageHeaderZoneClass, dashboardPageMetaStripClass } from '@/lib/dashboard-chrome-layout'
import { cn } from '@/lib/utils'

type IptPageHeaderProps = {
  action?: React.ReactNode
  /** Sidebar recolhida: faixa compacta alinhada à sidebar. */
  compact?: boolean
}

export function IptPageHeader({ action, compact = false }: IptPageHeaderProps) {
  if (compact) {
    return (
      <header className={cn(dashboardPageMetaStripClass, 'ipt-page-header-band ipt-page-header-band--compact')}>
        {action ? <div className="ipt-page-header__actions ipt-page-header__actions--solo">{action}</div> : null}
      </header>
    )
  }

  return (
    <header className={cn(dashboardPageHeaderZoneClass, 'ipt-page-header-band ipt-page-header-band--clean')}>
      <div className="ipt-page-header__row ipt-page-header__row--actions-only">
        {action ? <div className="ipt-page-header__actions ipt-page-header__actions--solo">{action}</div> : null}
      </div>
    </header>
  )
}
