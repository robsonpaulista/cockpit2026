'use client'

import { useEffect } from 'react'
import { ClipboardList, LayoutGrid, LineChart, UsersRound } from 'lucide-react'
import {
  DashboardHubTabBar,
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
  DashboardPageMetaStrip,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { typographyContentRootClass, typographyPageLeadClass } from '@/lib/typography-chrome'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import '@/app/dashboard/shared/ipt-page-palette.css'

export type PesquisaTab = 'panorama' | 'tendencia' | 'cadastradas' | 'gerar-publico'

const TABS: { id: PesquisaTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'panorama', label: 'Panorama', icon: LayoutGrid },
  { id: 'tendencia', label: 'Tendência temporal', icon: LineChart },
  { id: 'cadastradas', label: 'Pesquisas cadastradas', icon: ClipboardList },
  { id: 'gerar-publico', label: 'Gerar público pesquisa', icon: UsersRound },
]

interface PesquisaShellProps {
  activeTab: PesquisaTab
  onTabChange: (tab: PesquisaTab) => void
  tabActions?: React.ReactNode
  children: React.ReactNode
}

export function PesquisaShell({
  activeTab,
  onTabChange,
  tabActions,
  children,
}: PesquisaShellProps) {
  const topbarVisible = useDashboardTopbarVisible()
  const pageTitle = 'Pesquisa & Relato'
  const descriptionText =
    'Competitividade eleitoral por município. Os rankings mostram os candidatos mais bem posicionados em cada cidade e são consolidados pelo eleitorado local para formar uma visão territorial da disputa.'

  useEffect(() => {
    document.body.setAttribute('data-ipt-palette', '')
    return () => {
      document.body.removeAttribute('data-ipt-palette')
    }
  }, [])

  return (
    <DashboardPageShell>
      <DashboardPageChrome>
        {topbarVisible ? (
          <DashboardPageMetaStrip>
            <span className={typographyPageLeadClass}>{descriptionText}</span>
          </DashboardPageMetaStrip>
        ) : (
          <DashboardPageHeader title={pageTitle} description={descriptionText} />
        )}
        <DashboardHubTabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(tab) => onTabChange(tab as PesquisaTab)}
          actions={tabActions}
        />
      </DashboardPageChrome>
      <DashboardPageContent className={typographyContentRootClass}>{children}</DashboardPageContent>
    </DashboardPageShell>
  )
}
