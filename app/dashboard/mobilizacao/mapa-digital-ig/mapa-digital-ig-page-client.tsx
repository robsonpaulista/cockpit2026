'use client'

// This page measures the "digital mobilization army": leaders in our network
// were instructed to comment on the deputy's Instagram posts.
// The goal is to track how many followed through (activation rate),
// creating a perception of organic engagement and relevance on Instagram.
// Target: 70%+ activation rate per municipality.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ExercitoDigitalAlertPosts } from '@/components/mapa-exercito-digital/exercito-digital-alert-posts'
import { ExercitoDigitalCityPanel } from '@/components/mapa-exercito-digital/exercito-digital-city-panel'
import { ExercitoDigitalBanner, ExercitoDigitalHeader } from '@/components/mapa-exercito-digital/exercito-digital-chrome'
import { ExercitoDigitalKpiStrip } from '@/components/mapa-exercito-digital/exercito-digital-kpi-strip'
import { ExercitoDigitalLeaderRanking } from '@/components/mapa-exercito-digital/exercito-digital-leader-ranking'
import { ExercitoDigitalTrendChart } from '@/components/mapa-exercito-digital/exercito-digital-trend-chart'
import { fetchInstagramCommentsGrouped } from '@/lib/instagramApi'
import { INSTAGRAM_COMMENTS_SYNCED_EVENT } from '@/lib/instagram-comments-sync-events'
import {
  getMandatosInstagramEnriquecidos,
  type ExercitoDigitalAudience,
} from '@/lib/mandatos-instagram-piaui'
import {
  aggregateExercitoDigitalViewModel,
  mergeLeadersAcrossTds,
} from '@/lib/mapa-exercito-digital-aggregator'
import type { ExercitoDigitalViewModel } from '@/lib/mapa-exercito-digital-types'
import { fetchMobilizacaoLideresDesempenhoIgPorTd } from '@/lib/mobilizacao-lideres-desempenho-ig-por-td-client'
import {
  fetchMobilizacaoLideresInstagramPorTd,
  type LiderInstagramCoberturaDto,
} from '@/lib/mobilizacao-lideres-instagram-cobertura-client'
import { TERRITORIOS_DESENVOLVIMENTO_PI } from '@/lib/piaui-territorio-desenvolvimento'
import type { RelatorioMapaDigitalIgTdPayload } from '@/lib/relatorio-mapa-digital-ig-td-types'
import {
  exercitoDualPanelGridClass,
  exercitoPageStackClass,
  exercitoSectionCardClass,
} from '@/lib/mapa-exercito-digital-layout'
import { cn } from '@/lib/utils'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

function relatorioUrl(audience: ExercitoDigitalAudience): string {
  const base = audience === 'mandatos' ? '&base=mandatos' : ''
  return `/api/mobilizacao/relatorio-check-mapa-digital-ig?escopo=pi${base}`
}

export default function MapaDigitalIgMobilizacaoPageClient() {
  const [lookbackDays, setLookbackDays] = useState<number>(15)
  const [audience, setAudience] = useState<ExercitoDigitalAudience>('liderados')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [relatorioLoading, setRelatorioLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [rawPosts, setRawPosts] = useState<Awaited<ReturnType<typeof fetchInstagramCommentsGrouped>>>(null)
  const [lideresCobertura, setLideresCobertura] = useState<LiderInstagramCoberturaDto[]>([])
  const [mergedLeaders, setMergedLeaders] = useState<ReturnType<typeof mergeLeadersAcrossTds>>([])
  const [relatorioPi, setRelatorioPi] = useState<RelatorioMapaDigitalIgTdPayload | null>(null)
  const audienceRef = useRef(audience)
  audienceRef.current = audience

  const mandatos = useMemo(() => getMandatosInstagramEnriquecidos(), [])

  const carregarRelatorio = useCallback(async (aud: ExercitoDigitalAudience) => {
    setRelatorioLoading(true)
    try {
      const relatorioRes = await fetch(relatorioUrl(aud), { cache: 'no-store' })
      if (!relatorioRes.ok) {
        const j = (await relatorioRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? 'Falha ao carregar relatório PI.')
      }
      const relatorio = (await relatorioRes.json()) as RelatorioMapaDigitalIgTdPayload
      setRelatorioPi(relatorio)
    } finally {
      setRelatorioLoading(false)
    }
  }, [])

  const carregar = useCallback(async () => {
    setLoadState('loading')
    setError('')
    try {
      const [grouped, lideresRes, relatorioRes, ...tdResults] = await Promise.all([
        fetchInstagramCommentsGrouped(8000),
        fetchMobilizacaoLideresInstagramPorTd(null),
        fetch(relatorioUrl(audienceRef.current), { cache: 'no-store' }),
        ...TERRITORIOS_DESENVOLVIMENTO_PI.map((td) => fetchMobilizacaoLideresDesempenhoIgPorTd(td)),
      ])

      if (lideresRes.ok === false) {
        if (lideresRes.status === 403) {
          setLoadState('forbidden')
          setError(lideresRes.message ?? 'Sem permissão.')
          return
        }
        throw new Error(lideresRes.message ?? 'Falha ao carregar líderes.')
      }

      if (!relatorioRes.ok) {
        const j = (await relatorioRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? 'Falha ao carregar relatório PI.')
      }

      const relatorio = (await relatorioRes.json()) as RelatorioMapaDigitalIgTdPayload
      const leaderRows = tdResults.flatMap((r) => (r.ok ? r.data.lideres : []))

      setRawPosts(grouped)
      setLideresCobertura(lideresRes.data.lideres)
      setMergedLeaders(mergeLeadersAcrossTds(leaderRows))
      setRelatorioPi(relatorio)
      setLoadState('ready')
    } catch (e) {
      setLoadState('error')
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados.')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const onSync = () => {
      void carregar()
    }
    window.addEventListener(INSTAGRAM_COMMENTS_SYNCED_EVENT, onSync)
    return () => window.removeEventListener(INSTAGRAM_COMMENTS_SYNCED_EVENT, onSync)
  }, [carregar])

  const handleAudienceChange = useCallback(
    (next: ExercitoDigitalAudience) => {
      if (next === audience) return
      setAudience(next)
      if (loadState === 'ready') {
        void carregarRelatorio(next).catch((e) => {
          setError(e instanceof Error ? e.message : 'Erro ao carregar relatório.')
        })
      }
    },
    [audience, carregarRelatorio, loadState]
  )

  const viewModel: ExercitoDigitalViewModel | null = useMemo(() => {
    if (!relatorioPi || loadState !== 'ready') return null
    return aggregateExercitoDigitalViewModel({
      lookbackDays,
      audience,
      posts: rawPosts?.posts ?? [],
      lideresCobertura,
      mergedLeaders,
      mandatos,
      relatorioPi,
    })
  }, [lookbackDays, audience, rawPosts, lideresCobertura, mergedLeaders, mandatos, relatorioPi, loadState])

  return (
    <div className={cn(exercitoPageStackClass, 'min-h-0 flex-1 bg-[rgb(var(--color-background-tertiary))] p-4 text-text-primary')}>
      <ExercitoDigitalHeader
        audience={audience}
        onAudienceChange={handleAudienceChange}
        lookbackDays={lookbackDays}
        onLookbackChange={setLookbackDays}
        onSyncComplete={carregar}
      />
      <ExercitoDigitalBanner audience={audience} />

      {loadState === 'loading' ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando exército digital…
          </p>
        </div>
      ) : null}

      {loadState === 'forbidden' ? (
        <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-8 text-center text-sm text-text-muted">
          {error || 'Sem permissão para visualizar mobilização digital.'}
        </div>
      ) : null}

      {loadState === 'error' ? (
        <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-8 text-center">
          <p className="text-sm text-status-danger">{error}</p>
          <button
            type="button"
            onClick={() => void carregar()}
            className="mt-3 text-[12px] font-medium text-[rgb(var(--color-primary))]"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {relatorioLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-3 py-2 text-[11.5px] text-text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Atualizando recorte {audience === 'mandatos' ? 'Prefeitos/Vereadores' : 'Liderados'}…
        </div>
      ) : null}

      {viewModel ? (
        <>
          <ExercitoDigitalKpiStrip kpis={viewModel.kpis} lookbackDays={viewModel.lookbackDays} audience={viewModel.audience} />
          <ExercitoDigitalAlertPosts posts={viewModel.alertPosts} audience={viewModel.audience} />
          <div className={exercitoDualPanelGridClass}>
            <ExercitoDigitalLeaderRanking leaders={viewModel.leaders} audience={viewModel.audience} lookbackDays={viewModel.lookbackDays} />
            <ExercitoDigitalCityPanel cities={viewModel.cities} organicTail={viewModel.organicTail} audience={viewModel.audience} lookbackDays={viewModel.lookbackDays} />
          </div>
          <ExercitoDigitalTrendChart points={viewModel.trend} audience={viewModel.audience} />
        </>
      ) : null}
    </div>
  )
}
