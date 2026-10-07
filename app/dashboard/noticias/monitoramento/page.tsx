'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GoogleAlertsPanel } from '@/components/monitoramento/google-alerts-panel'
import { GoogleNewsRadarPanel } from '@/components/monitoramento/google-news-radar-panel'
import { InstagramRadarPanel } from '@/components/monitoramento/instagram-radar-panel'
import { MetaAdsRadarPanel } from '@/components/monitoramento/meta-ads-radar-panel'
import { MonitoramentoShell, type MonitoramentoTab } from '@/components/monitoramento/monitoramento-shell'
import { RadarCandidatosModal } from '@/components/monitoramento/radar-candidatos-modal'
import { RadarPanoramaPanel } from '@/components/monitoramento/radar-panorama-panel'
import { fmtDataHora, type RadarAbaProps } from '@/components/monitoramento/radar-ui'
import { TrendsRadarPanel } from '@/components/monitoramento/trends-radar-panel'
import { usePanoramaPanel } from '@/components/monitoramento/use-panorama-panel'
import { YoutubeRadarPanel } from '@/components/monitoramento/youtube-radar-panel'
import { useRadarAtores } from '@/hooks/use-radar-atores'

const ROTA = '/dashboard/noticias/monitoramento'

function parseTab(value: string | null): MonitoramentoTab {
  switch (value) {
    case 'youtube':
    case 'trends':
    case 'google-alerts':
    case 'google-news':
    case 'meta-ads':
    case 'instagram':
      return value
    case 'google-videos':
      return 'google-news'
    default:
      return 'geral'
  }
}

export default function MonitoramentoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = parseTab(searchParams.get('tab'))
  const candidatoUrl = searchParams.get('candidato')
  const radar = useRadarAtores()
  const [candidatosAbertos, setCandidatosAbertos] = useState<boolean>(false)

  const candidato = useMemo(
    () => (candidatoUrl && radar.ativos.some((a) => a.slug === candidatoUrl) ? candidatoUrl : null),
    [candidatoUrl, radar.ativos],
  )

  const panorama = usePanoramaPanel({ enabled: activeTab === 'geral' })

  const atualizarUrl = useCallback(
    (chave: 'tab' | 'candidato', valor: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (valor) params.set(chave, valor)
      else params.delete(chave)
      const qs = params.toString()
      router.replace(qs ? `${ROTA}?${qs}` : ROTA, { scroll: false })
    },
    [router, searchParams],
  )

  const onTabChange = useCallback(
    (tab: MonitoramentoTab) => atualizarUrl('tab', tab === 'geral' ? null : tab),
    [atualizarUrl],
  )
  const onCandidatoChange = useCallback((slug: string | null) => atualizarUrl('candidato', slug), [atualizarUrl])

  const abaProps: RadarAbaProps = { atores: radar.atores, candidato, onCandidatoChange }

  const painel = (() => {
    switch (activeTab) {
      case 'youtube':
        return <YoutubeRadarPanel {...abaProps} youtubeConfigurado={radar.youtubeConfigurado} />
      case 'trends':
        return <TrendsRadarPanel {...abaProps} />
      case 'google-alerts':
        return <GoogleAlertsPanel {...abaProps} />
      case 'google-news':
        return <GoogleNewsRadarPanel {...abaProps} />
      case 'meta-ads':
        return <MetaAdsRadarPanel {...abaProps} />
      case 'instagram':
        return <InstagramRadarPanel {...abaProps} />
      default:
        return <RadarPanoramaPanel {...abaProps} state={panorama} />
    }
  })()

  const info =
    activeTab === 'geral' && panorama.panorama.lastUpdated
      ? `${panorama.panorama.windowLabel} · atualizado em ${fmtDataHora(panorama.panorama.lastUpdated)}`
      : undefined

  return (
    <MonitoramentoShell
      activeTab={activeTab}
      onTabChange={onTabChange}
      ativos={radar.ativos}
      candidato={candidato}
      onCandidatoChange={onCandidatoChange}
      info={info}
      onAbrirCandidatos={() => setCandidatosAbertos(true)}
    >
      <div key={activeTab}>{painel}</div>
      {candidatosAbertos ? (
        <RadarCandidatosModal
          atores={radar.atores}
          onClose={() => setCandidatosAbertos(false)}
          onAlterado={() => void radar.recarregar()}
        />
      ) : null}
    </MonitoramentoShell>
  )
}
