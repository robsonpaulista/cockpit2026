'use client'

import { useLayoutEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  dashboardPageHeaderZoneClass,
  dashboardPageMetaStripClass,
  dashboardSubnavStripClass,
  dashboardSubnavStripPageInnerClass,
} from '@/lib/dashboard-chrome-layout'
import { useRegisterDashboardFixedChrome } from '@/contexts/dashboard-page-chrome-context'
import {
  dashboardHubTabActiveClass,
  dashboardHubTabBaseClass,
  dashboardHubTabIdleClass,
} from '@/lib/sidebar-brand-styles'
import {
  typographyPageLeadClass,
  typographyPageTitleClass,
  typographyTabClass,
} from '@/lib/typography-chrome'

export const dashboardPageBgClass = 'bg-bg-surface'

export const dashboardPageChromeClass = 'shrink-0'
/** Agrupa título + abas fixos no topo (não rolam com o conteúdo). */
export function DashboardPageChrome({ children }: { children: React.ReactNode }) {
  return <div className={dashboardPageChromeClass}>{children}</div>
}

export function DashboardPageHeader({
  title,
  description,
  meta,
  action,
}: {
  title?: string
  description?: React.ReactNode
  meta?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <header className={dashboardPageHeaderZoneClass}>
      <div className="flex h-full min-h-0 flex-col justify-center overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {title ? <h1 className={typographyPageTitleClass}>{title}</h1> : null}
            {description ? (
              <div
                className={cn(
                  'max-w-3xl line-clamp-2',
                  title ? 'mt-1' : undefined,
                  typographyPageLeadClass
                )}
              >
                {description}
              </div>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
    </header>
  )
}

/** Meta da página (período, frescor) sem título — título no topbar. */
export function DashboardPageMetaStrip({ children }: { children: React.ReactNode }) {
  return <div className={dashboardPageMetaStripClass}>{children}</div>
}

export type DashboardHubTab = {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

export function DashboardHubTabBar({
  tabs,
  activeTab,
  onTabChange,
  actions,
}: {
  tabs: DashboardHubTab[]
  activeTab: string
  onTabChange: (id: string) => void
  actions?: React.ReactNode
}) {
  return (
    <div className={dashboardSubnavStripClass}>
      <div className={dashboardSubnavStripPageInnerClass}>
        <nav className="-mb-px flex min-w-0 flex-1 flex-wrap gap-5" aria-label="Seções">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  dashboardHubTabBaseClass,
                  typographyTabClass,
                  active ? dashboardHubTabActiveClass : dashboardHubTabIdleClass
                )}
              >
                {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
                {tab.label}
              </button>
            )
          })}
        </nav>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 pb-2">{actions}</div> : null}
      </div>
    </div>
  )
}

export function DashboardPageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const registerFixedChrome = useRegisterDashboardFixedChrome()

  useLayoutEffect(() => registerFixedChrome(), [registerFixedChrome])

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden',
        dashboardPageBgClass,
        className
      )}
    >
      {children}
    </div>
  )
}

export function DashboardPageContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 md:p-6', className)}>
      {children}
    </div>
  )
}
