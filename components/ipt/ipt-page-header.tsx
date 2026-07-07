'use client'

import { ChevronRight } from 'lucide-react'
import { dashboardPageHeaderZoneClass, dashboardPageMetaStripClass } from '@/lib/dashboard-chrome-layout'
import { typographyPageLeadClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

type IptPageHeaderProps = {
  title: string
  description: string
  action?: React.ReactNode
  /** Sidebar recolhida: título no topbar — faixa compacta alinhada à sidebar. */
  compact?: boolean
}

function IptBreadcrumb() {
  return (
    <nav className="ipt-breadcrumb shrink-0" aria-label="Navegação">
      <span>Operação</span>
      <ChevronRight className="h-3 w-3 opacity-50" strokeWidth={1.5} aria-hidden />
      <span>Diagnóstico</span>
    </nav>
  )
}

export function IptPageHeader({ title, description, action, compact = false }: IptPageHeaderProps) {
  if (compact) {
    return (
      <header className={cn(dashboardPageMetaStripClass, 'ipt-page-header-band ipt-page-header-band--compact')}>
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <IptBreadcrumb />
          <span className={cn(typographyPageLeadClass, 'hidden min-w-0 truncate sm:inline')}>
            {description}
          </span>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
    )
  }

  return (
    <header className={cn(dashboardPageHeaderZoneClass, 'ipt-page-header-band')}>
      <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
        <IptBreadcrumb />
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="ipt-page-title">{title}</h1>
            <p className="ipt-page-lead line-clamp-2">{description}</p>
          </div>
          {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
        </div>
      </div>
    </header>
  )
}
