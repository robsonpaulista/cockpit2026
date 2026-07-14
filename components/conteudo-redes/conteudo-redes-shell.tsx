'use client'

import { useEffect } from 'react'
import { BarChart3, MapPin, Users } from 'lucide-react'
import {
  DashboardHubTabBar,
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
  DashboardPageMetaStrip,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { typographyContentRootClass, typographyPageLeadClass } from '@/lib/typography-chrome'
import { conteudoRedesTextClass } from '@/lib/conteudo-redes-styles'
import { cn } from '@/lib/utils'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import '@/app/dashboard/shared/ipt-page-palette.css'

export type ConteudoRedesTab = 'posts' | 'audience' | 'locations'

const TABS: { id: ConteudoRedesTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'posts', label: 'Posts & Insights', icon: BarChart3 },
  { id: 'audience', label: 'Audiência', icon: Users },
  { id: 'locations', label: 'Por Cidade', icon: MapPin },
]

const TAB_DESCRIPTIONS: Record<ConteudoRedesTab, string> = {
  posts: 'Histórico de seguidores, comparativos por tipo e tema, e posts campeões por indicador.',
  audience: 'Evolução da audiência, métricas do perfil e publicações classificadas por tema.',
  locations: 'Top cidades de seguidores e de engajamento com publicações (Instagram Insights).',
}

interface ConteudoRedesShellProps {
  activeTab: ConteudoRedesTab
  onTabChange: (tab: ConteudoRedesTab) => void
  metaLine?: string
  tabActions?: React.ReactNode
  children: React.ReactNode
}

export function ConteudoRedesShell({
  activeTab,
  onTabChange,
  metaLine,
  tabActions,
  children,
}: ConteudoRedesShellProps) {
  const topbarVisible = useDashboardTopbarVisible()
  const pageTitle = 'Instagram Pessoal'
  const tabDescription = TAB_DESCRIPTIONS[activeTab]
  const description = metaLine ? (
    <span className={typographyPageLeadClass}>
      {metaLine}
      <span className="mx-1.5 text-text-muted" aria-hidden>
        ·
      </span>
      {tabDescription}
    </span>
  ) : (
    tabDescription
  )

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
          <DashboardPageMetaStrip>{description}</DashboardPageMetaStrip>
        ) : (
          <DashboardPageHeader title={pageTitle} description={description} />
        )}
        <DashboardHubTabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(tab) => onTabChange(tab as ConteudoRedesTab)}
          actions={tabActions}
        />
      </DashboardPageChrome>
      <DashboardPageContent
        className={cn(typographyContentRootClass, conteudoRedesTextClass, 'pt-2 md:pt-3')}
      >
        {children}
      </DashboardPageContent>
    </DashboardPageShell>
  )
}
