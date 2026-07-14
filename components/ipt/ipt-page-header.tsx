'use client'

import { Info } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import { dashboardPageHeaderZoneClass, dashboardPageMetaStripClass } from '@/lib/dashboard-chrome-layout'
import { cn } from '@/lib/utils'

type IptPageHeaderProps = {
  title: string
  description: string
  action?: React.ReactNode
  /** Sidebar recolhida: título no topbar — faixa compacta alinhada à sidebar. */
  compact?: boolean
}

export function IptPageHeader({ title, description, action, compact = false }: IptPageHeaderProps) {
  if (compact) {
    return (
      <header className={cn(dashboardPageMetaStripClass, 'ipt-page-header-band ipt-page-header-band--compact')}>
        <div className="ipt-page-header__compact-left">
          <h1 className="ipt-page-title ipt-page-title--compact">{title}</h1>
          <p className="ipt-page-lead ipt-page-lead--compact">{description}</p>
        </div>
        {action ? <div className="ipt-page-header__actions">{action}</div> : null}
      </header>
    )
  }

  return (
    <header className={cn(dashboardPageHeaderZoneClass, 'ipt-page-header-band ipt-page-header-band--clean')}>
      <div className="ipt-page-header__row">
        <div className="ipt-page-header__copy">
          <h1 className="ipt-page-title">{title}</h1>
          <p className="ipt-page-lead">
            <span>{description}</span>
            <span className="ipt-page-lead__info" title={description} aria-hidden>
              <CockpitIcon icon={Info} size="sm" />
            </span>
          </p>
        </div>
        {action ? <div className="ipt-page-header__actions">{action}</div> : null}
      </div>
    </header>
  )
}
