'use client'

import { useEffect } from 'react'
import { HardHat } from 'lucide-react'
import {
  DashboardHubTabBar,
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
  DashboardPageMetaStrip,
  DashboardPageShell,
  type DashboardHubTab,
} from '@/components/dashboard/dashboard-page-chrome'
import { typographyContentRootClass, typographyPageLeadClass } from '@/lib/typography-chrome'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import '@/app/dashboard/shared/ipt-page-palette.css'
import '@/app/dashboard/obras/obras-clean.css'

interface ObrasShellProps {
  tabs: DashboardHubTab[]
  activeTab: string
  onTabChange: (tab: string) => void
  tabActions?: React.ReactNode
  children: React.ReactNode
}

export function ObrasShell({
  tabs,
  activeTab,
  onTabChange,
  tabActions,
  children,
}: ObrasShellProps) {
  const topbarVisible = useDashboardTopbarVisible()
  const pageTitle = 'Obras'
  const descriptionText =
    'Acompanhamento de obras, andamentos SEI e publicações no Diário Oficial — visão operacional limpa do Recap.'

  useEffect(() => {
    document.body.setAttribute('data-ipt-palette', '')
    document.body.setAttribute('data-obras-clean', '')
    return () => {
      document.body.removeAttribute('data-ipt-palette')
      document.body.removeAttribute('data-obras-clean')
    }
  }, [])

  const hubTabs: DashboardHubTab[] =
    tabs.length > 0
      ? tabs
      : [{ id: activeTab || 'Recap', label: activeTab || 'Recap', icon: HardHat }]

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
          tabs={hubTabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          actions={tabActions}
        />
      </DashboardPageChrome>
      <DashboardPageContent className={typographyContentRootClass}>{children}</DashboardPageContent>
    </DashboardPageShell>
  )
}
