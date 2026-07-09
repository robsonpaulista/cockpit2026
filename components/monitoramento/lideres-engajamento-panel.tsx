'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Loader2, MapPin, Users } from 'lucide-react'
import { ExercitoDigitalCityPanel } from '@/components/mapa-exercito-digital/exercito-digital-city-panel'
import { ExercitoDigitalHeader } from '@/components/mapa-exercito-digital/exercito-digital-chrome'
import { ExercitoDigitalLeaderRanking } from '@/components/mapa-exercito-digital/exercito-digital-leader-ranking'
import { ExercitoDigitalTrendChart } from '@/components/mapa-exercito-digital/exercito-digital-trend-chart'
import { LideresEngajamentoKpis } from '@/components/monitoramento/lideres-engajamento-kpis'
import { buildLeaderCityCorrelation } from '@/lib/mapa-exercito-digital-gamification'
import { getCurrentReferenceMonth } from '@/lib/mapa-exercito-digital-month'
import { fetchInstagramCommentsGrouped } from '@/lib/instagramApi'
import { INSTAGRAM_COMMENTS_SYNCED_EVENT } from '@/lib/instagram-comments-sync-events'
import { getMandatosInstagramEnriquecidos } from '@/lib/mandatos-instagram-piaui'
import {
  aggregateExercitoDigitalViewModel,
  mergeLeadersAcrossTds,
} from '@/lib/mapa-exercito-digital-aggregator'
import type { ExercitoDigitalViewModel } from '@/lib/mapa-exercito-digital-types'
import { exercitoPageStackClass } from '@/lib/mapa-exercito-digital-layout'
import { fetchMobilizacaoLideresDesempenhoIgPorTd } from '@/lib/mobilizacao-lideres-desempenho-ig-por-td-client'
import {
  fetchMobilizacaoLideresInstagramPorTd,
  type LiderInstagramCoberturaDto,
} from '@/lib/mobilizacao-lideres-instagram-cobertura-client'
import { pillFilterActiveClass, pillFilterIdleClass } from '@/lib/premium-ui-classes'
import { TERRITORIOS_DESENVOLVIMENTO_PI } from '@/lib/piaui-territorio-desenvolvimento'
import type { RelatorioMapaDigitalIgTdPayload } from '@/lib/relatorio-mapa-digital-ig-td-types'
import { cn } from '@/lib/utils'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'
type SectionTab = 'lideres' | 'municipios' | 'evolucao'

const RELATORIO_URL = '/api/mobilizacao/relatorio-check-mapa-digital-ig?escopo=pi'

const SECTION_TABS: { id: SectionTab; label: string; icon: typeof Users }[] = [
  { id: 'lideres', label: 'Ranking', icon: Users },
  { id: 'municipios', label: 'Municípios', icon: MapPin },
  { id: 'evolucao', label: 'Evolução', icon: BarChart3 },
]

export function LideresEngajamentoPanel() {
  const [lookbackDays, setLookbackDays] = useState<number>(15)
  const [referenceMonth, setReferenceMonth] = useState<string>(() => getCurrentReferenceMonth())
  const [sectionTab, setSectionTab] = useState<SectionTab>('lideres')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string>('')
  const [rawPosts, setRawPosts] = useState<Awaited<ReturnType<typeof fetchInstagramCommentsGrouped>>>(null)
  const [lideresCobertura, setLideresCobertura] = useState<LiderInstagramCoberturaDto[]>([])
  const [mergedLeaders, setMergedLeaders] = useState<ReturnType<typeof mergeLeadersAcrossTds>>([])
  const [relatorioPi, setRelatorioPi] = useState<RelatorioMapaDigitalIgTdPayload | null>(null)

  const mandatos = useMemo(() => getMandatosInstagramEnriquecidos(), [])

  const carregar = useCallback(async () => {
    setLoadState('loading')
    setError('')
    try {
      const [grouped, lideresRes, relatorioRes, ...tdResults] = await Promise.all([
        fetchInstagramCommentsGrouped(8000),
        fetchMobilizacaoLideresInstagramPorTd(null),
        fetch(RELATORIO_URL, { cache: 'no-store' }),
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

  const viewModel: ExercitoDigitalViewModel | null = useMemo(() => {
    if (!relatorioPi || loadState !== 'ready') return null
    return aggregateExercitoDigitalViewModel({
      lookbackDays,
      referenceMonth,
      audience: 'unificado',
      posts: rawPosts?.posts ?? [],
      lideresCobertura,
      mergedLeaders,
      mandatos,
      relatorioPi,
    })
  }, [lookbackDays, referenceMonth, rawPosts, lideresCobertura, mergedLeaders, mandatos, relatorioPi, loadState])

  const correlationNote = useMemo(() => {
    if (!viewModel) return null
    const topLeader = viewModel.leaders[0]
    const topCity = viewModel.cities.find((c) => c.comentarios > 0)
    return buildLeaderCityCorrelation(topLeader, topCity)
  }, [viewModel])

  return (
    <div className={cn(exercitoPageStackClass, 'min-h-0 flex-1 text-text-primary')}>
      <ExercitoDigitalHeader
        variant="compact"
        lookbackDays={lookbackDays}
        onLookbackChange={setLookbackDays}
        onSyncComplete={carregar}
        referenceMonth={referenceMonth}
        referenceMonthLabel={viewModel?.referenceMonthLabel}
        onReferenceMonthChange={setReferenceMonth}
      />

      {loadState === 'loading' ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando engajamento dos líderes…
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

      {viewModel ? (
        <>
          <LideresEngajamentoKpis
            kpis={viewModel.kpis}
            audience={viewModel.audience}
            referenceMonthLabel={viewModel.referenceMonthLabel}
          />

          {correlationNote ? (
            <p className="px-0.5 text-[11px] leading-relaxed text-text-muted">
              <span className="font-medium text-text-secondary">Destaque:</span> {correlationNote}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {SECTION_TABS.map((tab) => {
              const Icon = tab.icon
              const active = sectionTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSectionTab(tab.id)}
                  className={cn(
                    active ? pillFilterActiveClass : pillFilterIdleClass,
                    'text-[12px]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {sectionTab === 'lideres' ? (
            <ExercitoDigitalLeaderRanking
              leaders={viewModel.leaders}
              accumulatedLeaders={viewModel.accumulatedLeaders}
              accumulatedWindowDays={viewModel.accumulatedWindowDays}
              audience={viewModel.audience}
              referenceMonthLabel={viewModel.referenceMonthLabel}
            />
          ) : null}

          {sectionTab === 'municipios' ? (
            <ExercitoDigitalCityPanel
              cities={viewModel.cities}
              organicTail={viewModel.organicTail}
              audience={viewModel.audience}
              referenceMonth={viewModel.referenceMonth}
              referenceMonthLabel={viewModel.referenceMonthLabel}
            />
          ) : null}

          {sectionTab === 'evolucao' ? (
            <ExercitoDigitalTrendChart points={viewModel.trend} audience={viewModel.audience} />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
