'use client'

import { HardHat, LayoutGrid, MapPin, Route } from 'lucide-react'
import {
  DashboardHubTabBar,
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
  DashboardPageMetaStrip,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { typographyContentRootClass, typographyPageLeadClass } from '@/lib/typography-chrome'
import {
  TERRITORIO_CAMPO_PAGE_TITLE,
  TERRITORIO_CAMPO_TAB_BASE,
  type TerritorioCampoTab,
} from '@/lib/territorio-campo-route'
import { territorioBaseTextClass } from '@/lib/territorio-base-styles'
import { cn } from '@/lib/utils'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'

const TABS: { id: TerritorioCampoTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'panorama', label: 'Panorama', icon: LayoutGrid },
  { id: 'base', label: 'Base', icon: MapPin },
  { id: 'mapa-obras', label: 'Mapa de Obras', icon: HardHat },
  { id: 'visitas', label: 'Visitas', icon: Route },
]

interface TerritorioCampoShellProps {
  activeTab: TerritorioCampoTab
  onTabChange: (tab: TerritorioCampoTab) => void
  tabActions?: React.ReactNode
  children: React.ReactNode
}

export function TerritorioCampoShell({
  activeTab,
  onTabChange,
  tabActions,
  children,
}: TerritorioCampoShellProps) {
  const topbarVisible = useDashboardTopbarVisible()
  const pageTitle = TERRITORIO_CAMPO_PAGE_TITLE
  const isBaseTab = activeTab === TERRITORIO_CAMPO_TAB_BASE
  const descriptionText =
    'Base de lideranças, expectativa territorial e visitas de campo (Campo & Agenda).'

  return (
    <DashboardPageShell>
      <DashboardPageChrome>
        {topbarVisible ? (
          <DashboardPageMetaStrip>
            <span className={cn(typographyPageLeadClass, isBaseTab && territorioBaseTextClass)}>
              {descriptionText}
            </span>
          </DashboardPageMetaStrip>
        ) : (
          <DashboardPageHeader title={pageTitle} description={descriptionText} />
        )}
        <DashboardHubTabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(tab) => onTabChange(tab as TerritorioCampoTab)}
          actions={tabActions}
        />
      </DashboardPageChrome>
      <DashboardPageContent
        className={cn(typographyContentRootClass, isBaseTab && territorioBaseTextClass)}
      >
        {children}
      </DashboardPageContent>
    </DashboardPageShell>
  )
}

export type { TerritorioCampoTab }
