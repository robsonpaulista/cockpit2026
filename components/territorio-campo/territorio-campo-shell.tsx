'use client'

import { LayoutGrid, MapPin, Route } from 'lucide-react'
import {
  DashboardHubTabBar,
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { typographyContentRootClass } from '@/lib/typography-chrome'
import type { TerritorioCampoTab } from '@/lib/territorio-campo-route'

const TABS: { id: TerritorioCampoTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'panorama', label: 'Panorama', icon: LayoutGrid },
  { id: 'base', label: 'Base', icon: MapPin },
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
  return (
    <DashboardPageShell>
      <DashboardPageChrome>
        <DashboardPageHeader
          title="Território & Campo"
          description="Base de lideranças, expectativa territorial e visitas de campo (Campo & Agenda)."
        />
        <DashboardHubTabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(tab) => onTabChange(tab as TerritorioCampoTab)}
          actions={tabActions}
        />
      </DashboardPageChrome>
      <DashboardPageContent className={typographyContentRootClass}>{children}</DashboardPageContent>
    </DashboardPageShell>
  )
}

export type { TerritorioCampoTab }
