'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GoogleNewsRadarPanel } from '@/components/monitoramento/google-news-radar-panel'
import { MonitoramentoShell, type MonitoramentoTab } from '@/components/monitoramento/monitoramento-shell'
import { TrendsRadarPanel } from '@/components/monitoramento/trends-radar-panel'
import { YoutubeRadarPanel } from '@/components/monitoramento/youtube-radar-panel'

function parseTab(value: string | null): MonitoramentoTab {
  if (value === 'trends') return 'trends'
  if (value === 'google-news') return 'google-news'
  return 'youtube'
}

export default function MonitoramentoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = useMemo(() => parseTab(searchParams.get('tab')), [searchParams])

  const onTabChange = useCallback(
    (tab: MonitoramentoTab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'youtube') {
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
      {activeTab === 'trends' ? (
        <TrendsRadarPanel />
      ) : activeTab === 'google-news' ? (
        <GoogleNewsRadarPanel />
      ) : (
        <YoutubeRadarPanel />
      )}
    </MonitoramentoShell>
  )
}
