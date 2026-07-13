'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GoogleAlertsPanel } from '@/components/monitoramento/google-alerts-panel'
import { GoogleNewsRadarPanel } from '@/components/monitoramento/google-news-radar-panel'
import { GoogleVideosRadarPanel } from '@/components/monitoramento/google-videos-radar-panel'
import { InstagramRadarPanel } from '@/components/monitoramento/instagram-radar-panel'
import { MetaAdsRadarPanel } from '@/components/monitoramento/meta-ads-radar-panel'
import { PanoramaPanel } from '@/components/monitoramento/panorama-panel'
import { PanoramaTabActions } from '@/components/monitoramento/panorama-tab-actions'
import {
  MonitoramentoShell,
  type MonitoramentoPanoramaMeta,
  type MonitoramentoTab,
} from '@/components/monitoramento/monitoramento-shell'
import { usePanoramaPanel } from '@/components/monitoramento/use-panorama-panel'
import { TrendsRadarPanel } from '@/components/monitoramento/trends-radar-panel'
import { ViralTrendsPanel } from '@/components/monitoramento/viral-trends-panel'
import { YoutubeRadarPanel } from '@/components/monitoramento/youtube-radar-panel'
import { MONITORAMENTO_TAB_LIDERES } from '@/lib/monitoramento-lideres-route'

const LideresEngajamentoPanel = dynamic(
  () =>
    import('@/components/monitoramento/lideres-engajamento-panel').then((mod) => mod.LideresEngajamentoPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando engajamento dos líderes…
      </div>
    ),
  }
)

function parseTab(value: string | null): MonitoramentoTab {
  if (value === 'google-alerts') return 'google-alerts'
  if (value === 'youtube') return 'youtube'
  if (value === 'trends') return 'trends'
  if (value === 'viral') return 'viral'
  if (value === 'google-news') return 'google-news'
  if (value === 'google-videos') return 'google-videos'
  if (value === 'meta-ads') return 'meta-ads'
  if (value === 'instagram') return 'instagram'
  if (value === MONITORAMENTO_TAB_LIDERES) return 'lideres'
  return 'geral'
}

export default function MonitoramentoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlTab = useMemo(() => parseTab(searchParams.get('tab')), [searchParams])
  const [activeTab, setActiveTab] = useState<MonitoramentoTab>(urlTab)

  useEffect(() => {
    setActiveTab(urlTab)
  }, [urlTab])

  const [panoramaMeta, setPanoramaMeta] = useState<MonitoramentoPanoramaMeta | null>(null)

  const onPanoramaMetaChange = useCallback((meta: MonitoramentoPanoramaMeta) => {
    setPanoramaMeta(meta)
  }, [])

  const panorama = usePanoramaPanel({
    enabled: activeTab === 'geral',
    onMetaChange: onPanoramaMetaChange,
  })

  const onTabChange = useCallback(
    (tab: MonitoramentoTab) => {
      setActiveTab(tab)
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'geral') {
        params.delete('tab')
      } else {
        params.set('tab', tab)
      }
      const qs = params.toString()
      router.replace(qs ? `/dashboard/noticias/monitoramento?${qs}` : '/dashboard/noticias/monitoramento')
    },
    [router, searchParams]
  )

  const tabPanel = (() => {
    switch (activeTab) {
      case 'geral':
        return <PanoramaPanel state={panorama} />
      case 'google-alerts':
        return <GoogleAlertsPanel />
      case 'youtube':
        return <YoutubeRadarPanel />
      case 'trends':
        return <TrendsRadarPanel />
      case 'viral':
        return <ViralTrendsPanel />
      case 'google-news':
        return <GoogleNewsRadarPanel />
      case 'google-videos':
        return <GoogleVideosRadarPanel />
      case 'meta-ads':
        return <MetaAdsRadarPanel />
      case 'instagram':
        return <InstagramRadarPanel />
      case 'lideres':
        return <LideresEngajamentoPanel />
      default:
        return <PanoramaPanel state={panorama} />
    }
  })()

  return (
    <MonitoramentoShell
      activeTab={activeTab}
      onTabChange={onTabChange}
      panoramaMeta={panoramaMeta}
      tabActions={
        activeTab === 'geral' ? (
          <PanoramaTabActions
            busy={panorama.busy}
            refreshing={panorama.refreshing}
            onReload={() => void panorama.carregar(true)}
          />
        ) : null
      }
    >
      <div key={activeTab}>{tabPanel}</div>
    </MonitoramentoShell>
  )
}
