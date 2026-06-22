'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GoogleAlertsPanel } from '@/components/monitoramento/google-alerts-panel'
import { GoogleNewsRadarPanel } from '@/components/monitoramento/google-news-radar-panel'
import { InstagramRadarPanel } from '@/components/monitoramento/instagram-radar-panel'
import { MetaAdsRadarPanel } from '@/components/monitoramento/meta-ads-radar-panel'
import {
  MonitoramentoShell,
  type MonitoramentoPanoramaMeta,
  type MonitoramentoTab,
} from '@/components/monitoramento/monitoramento-shell'
import { PanoramaPanel } from '@/components/monitoramento/panorama-panel'
import { TrendsRadarPanel } from '@/components/monitoramento/trends-radar-panel'
import { YoutubeRadarPanel } from '@/components/monitoramento/youtube-radar-panel'

function parseTab(value: string | null): MonitoramentoTab {
  if (value === 'google-alerts') return 'google-alerts'
  if (value === 'youtube') return 'youtube'
  if (value === 'trends') return 'trends'
  if (value === 'google-news') return 'google-news'
  if (value === 'meta-ads') return 'meta-ads'
  if (value === 'instagram') return 'instagram'
  return 'geral'
}

export default function MonitoramentoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = useMemo(() => parseTab(searchParams.get('tab')), [searchParams])
  const [panoramaMeta, setPanoramaMeta] = useState<MonitoramentoPanoramaMeta | null>(null)

  const onPanoramaMetaChange = useCallback((meta: MonitoramentoPanoramaMeta) => {
    setPanoramaMeta(meta)
  }, [])

  const onTabChange = useCallback(
    (tab: MonitoramentoTab) => {
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

  return (
    <MonitoramentoShell
      activeTab={activeTab}
      onTabChange={onTabChange}
      panoramaMeta={panoramaMeta}
    >
      {activeTab === 'geral' ? (
        <PanoramaPanel onMetaChange={onPanoramaMetaChange} />
      ) : activeTab === 'google-alerts' ? (
        <GoogleAlertsPanel />
      ) : activeTab === 'trends' ? (
        <TrendsRadarPanel />
      ) : activeTab === 'google-news' ? (
        <GoogleNewsRadarPanel />
      ) : activeTab === 'meta-ads' ? (
        <MetaAdsRadarPanel />
      ) : activeTab === 'instagram' ? (
        <InstagramRadarPanel />
      ) : (
        <YoutubeRadarPanel />
      )}
    </MonitoramentoShell>
  )
}
