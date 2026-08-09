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
import { WarRoomFontBootstrap } from '@/components/war-room/war-room-font-bootstrap'
import { typographyContentRootClass, typographyPageLeadClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import '@/app/dashboard/war-room/war-room-fonts.css'
import '@/app/dashboard/war-room/war-room-clean.css'

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
    document.body.setAttribute('data-war-room-clean', '')
    document.body.setAttribute('data-wr-copiloto', '')
    return () => {
      document.body.removeAttribute('data-war-room-clean')
      document.body.removeAttribute('data-wr-copiloto')
    }
  }, [])

  return (
    <DashboardPageShell>
      <WarRoomFontBootstrap />
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
      <DashboardPageContent
        className={cn(typographyContentRootClass, 'wr-page-canvas--scroll')}
      >
        {children}
      </DashboardPageContent>
    </DashboardPageShell>
  )
}
