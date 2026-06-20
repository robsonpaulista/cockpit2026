'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GoogleNewsRadarPanel } from '@/components/monitoramento/google-news-radar-panel'
import { MetaAdsRadarPanel } from '@/components/monitoramento/meta-ads-radar-panel'
import { MonitoramentoShell, type MonitoramentoTab } from '@/components/monitoramento/monitoramento-shell'
import { PanoramaPanel } from '@/components/monitoramento/panorama-panel'
import { TrendsRadarPanel } from '@/components/monitoramento/trends-radar-panel'
import { YoutubeRadarPanel } from '@/components/monitoramento/youtube-radar-panel'

function parseTab(value: string | null): MonitoramentoTab {
  if (value === 'youtube') return 'youtube'
  if (value === 'trends') return 'trends'
  if (value === 'google-news') return 'google-news'
  if (value === 'meta-ads') return 'meta-ads'
  return 'geral'
}

export default function MonitoramentoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = useMemo(() => parseTab(searchParams.get('tab')), [searchParams])

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
    <MonitoramentoShell activeTab={activeTab} onTabChange={onTabChange}>
      {activeTab === 'geral' ? (
        <PanoramaPanel />
      ) : activeTab === 'trends' ? (
        <TrendsRadarPanel />
      ) : activeTab === 'google-news' ? (
        <GoogleNewsRadarPanel />
      ) : activeTab === 'meta-ads' ? (
        <MetaAdsRadarPanel />
      ) : (
        <YoutubeRadarPanel />
      )}
    </MonitoramentoShell>
  )
}
