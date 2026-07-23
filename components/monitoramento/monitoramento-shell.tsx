'use client'

import { useEffect } from 'react'
import {
  Bell,
  Instagram,
  LayoutGrid,
  LineChart,
  Megaphone,
  Newspaper,
  Flame,
  Users,
  Video,
  Youtube,
} from 'lucide-react'
import {
  DashboardHubTabBar,
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
  DashboardPageMetaStrip,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { DataFreshnessIndicator } from '@/components/monitoramento/data-freshness-indicator'
import { MONITORAMENTO_TAB_LIDERES } from '@/lib/monitoramento-lideres-route'
import { typographyContentRootClass, typographyPageLeadClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import '@/app/dashboard/shared/ipt-page-palette.css'
import '@/app/dashboard/noticias/radar-eleitoral-clean.css'

export type MonitoramentoTab =
  | 'geral'
  | 'google-alerts'
  | 'youtube'
  | 'trends'
  | 'viral'
  | 'google-news'
  | 'google-videos'
  | 'meta-ads'
  | 'instagram'
  | 'lideres'

const TABS: { id: MonitoramentoTab; label: string; icon: typeof Youtube }[] = [
  { id: 'geral', label: 'Panorama', icon: LayoutGrid },
  { id: 'google-alerts', label: 'Alertas', icon: Bell },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'google-news', label: 'Notícias', icon: Newspaper },
  { id: 'google-videos', label: 'Google Vídeos', icon: Video },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'meta-ads', label: 'Anúncios', icon: Megaphone },
  { id: 'trends', label: 'Buscas', icon: LineChart },
  { id: 'viral', label: 'Viral', icon: Flame },
  { id: 'lideres', label: 'Eng. líderes', icon: Users },
]

export type MonitoramentoPanoramaMeta = {
  lastUpdated: string | null
  windowLabel: string
  isLive: boolean
}

interface MonitoramentoShellProps {
  activeTab: MonitoramentoTab
  onTabChange: (tab: MonitoramentoTab) => void
  panoramaMeta?: MonitoramentoPanoramaMeta | null
  tabActions?: React.ReactNode
  children: React.ReactNode
}

function formatPanoramaDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MonitoramentoShell({
  activeTab,
  onTabChange,
  panoramaMeta,
  tabActions,
  children,
}: MonitoramentoShellProps) {
  const topbarVisible = useDashboardTopbarVisible()
  const pageTitle =
    activeTab === MONITORAMENTO_TAB_LIDERES ? 'Radar eleitoral · Eng. líderes' : 'Radar eleitoral'

  useEffect(() => {
    document.body.setAttribute('data-ipt-palette', '')
    document.body.setAttribute('data-radar-clean', '')
    return () => {
      document.body.removeAttribute('data-ipt-palette')
      document.body.removeAttribute('data-radar-clean')
    }
  }, [])

  const description = panoramaMeta ? (
    <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <span className={typographyPageLeadClass}>{panoramaMeta.windowLabel}</span>
      <DataFreshnessIndicator
        lastUpdated={panoramaMeta.lastUpdated}
        isLive={panoramaMeta.isLive}
      />
      {panoramaMeta.lastUpdated ? (
        <span className={cn(typographyPageLeadClass, 'text-text-muted')}>
          {formatPanoramaDateTime(panoramaMeta.lastUpdated)}
        </span>
      ) : null}
    </div>
  ) : (
    'Panorama e coletas de mídia em um só lugar.'
  )

  return (
    <DashboardPageShell>
      <DashboardPageChrome>
        {topbarVisible ? (
          description ? <DashboardPageMetaStrip>{description}</DashboardPageMetaStrip> : null
        ) : (
          <DashboardPageHeader title={pageTitle} description={description} />
        )}
        <DashboardHubTabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(tab) => onTabChange(tab as MonitoramentoTab)}
          actions={tabActions}
        />
      </DashboardPageChrome>
      <DashboardPageContent className={typographyContentRootClass}>{children}</DashboardPageContent>
    </DashboardPageShell>
  )
}
