'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { TrendsCompareBoard } from '@/components/trends-radar/trends-compare-board'
import { TrendsInterestChart } from '@/components/trends-radar/trends-interest-chart'
import {
  CAMPAIGN_TRENDS_CIDADES,
  CAMPAIGN_TRENDS_DEPUTADO,
  CAMPAIGN_TRENDS_PAUTAS,
  getAllCampaignTrendsKeywords,
  labelCampaignTrendsGroup,
  type CampaignTrendsKeyword,
  type CampaignTrendsKeywordGroup,
} from '@/lib/campaign-trends-keywords'
import type {
  GoogleTrendsCompareRow,
  GoogleTrendsSeries,
} from '@/lib/google-trends-types'
import { buildTrendsChartData } from '@/lib/google-trends-aggregate'
import {
  DEFAULT_GOOGLE_TRENDS_TIMEFRAME,
  GOOGLE_TRENDS_WINDOW_LABEL,
} from '@/lib/google-trends-timeframe'
import { chromeButtonClass, chromeFilterChipClass, chromePanelToolbarClass } from '@/lib/button-chrome'
import { readResponseJson } from '@/lib/parse-response-json'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

const GEO = 'BR-PI'
const TIMEFRAME = DEFAULT_GOOGLE_TRENDS_TIMEFRAME
const MAX_COMPARE = 5

function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

function defaultSelectedTerms(keywords: CampaignTrendsKeyword[]): string[] {
  return keywords.filter((k) => k.group === 'pauta').slice(0, MAX_COMPARE).map((k) => k.term)
}

export function ViralTrendsPanel() {
  const allKeywords = useMemo(() => getAllCampaignTrendsKeywords(), [])
  const [selectedTerms, setSelectedTerms] = useState<string[]>(() => defaultSelectedTerms(allKeywords))
  const [groupFilter, setGroupFilter] = useState<CampaignTrendsKeywordGroup | 'todos'>('todos')
  const [series, setSeries] = useState<GoogleTrendsSeries[]>([])
  const [compare, setCompare] = useState<GoogleTrendsCompareRow[]>([])
  const [setupRequired, setSetupRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState('')
  const [collectMessage, setCollectMessage] = useState('')
  const [collectedAt, setCollectedAt] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)
  const [seriesStale, setSeriesStale] = useState(false)
  const [runnerAvailable, setRunnerAvailable] = useState(true)
  const [runnerMessage, setRunnerMessage] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/trends/interest?geo=${encodeURIComponent(GEO)}&timeframe=${encodeURIComponent(TIMEFRAME)}&base=campanha`,
        { cache: 'no-store' }
      )
      const j = await readResponseJson<{
        error?: string
        series?: GoogleTrendsSeries[]
        compare?: GoogleTrendsCompareRow[]
        setupRequired?: boolean
        collectedAt?: string | null
        dateFrom?: string | null
        dateTo?: string | null
        seriesStale?: boolean
      }>(res)
      if (!res.ok) throw new Error(j.error ?? 'Falha ao carregar pautas da campanha.')

      setSetupRequired(Boolean(j.setupRequired))
      setSeries(j.series ?? [])
      setCompare(j.compare ?? [])
      setCollectedAt(j.collectedAt ?? null)
      setDateFrom(j.dateFrom ?? null)
      setDateTo(j.dateTo ?? null)
      setSeriesStale(Boolean(j.seriesStale))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar pautas da campanha.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const pollCollectUntilDone = useCallback(async () => {
    const maxMs = 360_000
    const started = Date.now()

    while (Date.now() - started < maxMs) {
      const res = await fetch('/api/trends/status', { cache: 'no-store' })
      const j = await readResponseJson<{
        collectInProgress?: boolean
        lastCollectResult?: {
          terms?: number
          termsSucceeded?: number
          rowsUpserted?: number
          relatedRowsUpserted?: number
          errors?: string[]
        } | null
        lastCollectError?: string | null
      }>(res)

      if (!j.collectInProgress) {
        if (j.lastCollectError) throw new Error(j.lastCollectError)
        const r = j.lastCollectResult
        if (r) {
          const ok = r.termsSucceeded ?? 0
          const total = r.terms ?? 0
          const related = r.relatedRowsUpserted ?? 0
          setCollectMessage(
            ok === total
              ? `Coleta concluída: ${ok} pautas · ${r.rowsUpserted ?? 0} pontos${
                  related > 0 ? ` · ${related} relacionados/em ascensão` : ''
                }`
              : `Coleta parcial: ${ok}/${total} pautas · ${r.rowsUpserted ?? 0} pontos${
                  related > 0 ? ` · ${related} relacionados` : ''
                }${r.errors?.length ? `. Falhas: ${r.errors.join('; ')}` : ''}`
          )
        }
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 2_000))
    }

    throw new Error('Tempo esgotado na coleta das pautas da campanha.')
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/trends/status', { cache: 'no-store' })
        const j = await readResponseJson<{
          runnerAvailable?: boolean
          runnerMessage?: string | null
          setupRequired?: boolean
          collectInProgress?: boolean
        }>(res)
        if (!res.ok) return

        setRunnerAvailable(j.runnerAvailable !== false)
        setRunnerMessage(j.runnerMessage ?? null)
        if (j.setupRequired) setSetupRequired(true)

        if (j.collectInProgress) {
          setCollecting(true)
          try {
            await pollCollectUntilDone()
            await carregar()
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro na coleta.')
          } finally {
            setCollecting(false)
          }
        }
      } catch {
        /* ignore */
      }
    })()
  }, [carregar, pollCollectUntilDone])

  const coletar = useCallback(async () => {
    setCollecting(true)
    setCollectMessage('')
    setError('')
    try {
      const res = await fetch('/api/trends/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geo: GEO,
          timeframe: TIMEFRAME,
          skipRelated: false,
          base: 'campanha',
        }),
      })
      const j = await readResponseJson<{
        error?: string
        runnerAvailable?: boolean
      }>(res)
      if (res.status === 503) {
        throw new Error(j.error ?? 'Coleta indisponível neste servidor.')
      }
      if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')

      await pollCollectUntilDone()
      await carregar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setCollecting(false)
    }
  }, [carregar, pollCollectUntilDone])

  const toggleTerm = useCallback((term: string) => {
    setSelectedTerms((prev) => {
      if (prev.includes(term)) return prev.filter((t) => t !== term)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, term]
    })
  }, [])

  const visibleKeywords = useMemo(() => {
    if (groupFilter === 'todos') return allKeywords
    return allKeywords.filter((k) => k.group === groupFilter)
  }, [allKeywords, groupFilter])

  const selectedSeries = useMemo(
    () => series.filter((s) => selectedTerms.includes(s.searchTerm)),
    [series, selectedTerms]
  )

  const selectedChartData = useMemo(
    () => buildTrendsChartData(selectedSeries),
    [selectedSeries]
  )

  const selectedCompare = useMemo(() => {
    const selected = compare.filter((r) => selectedTerms.includes(r.searchTerm))
    const rest = compare.filter((r) => !selectedTerms.includes(r.searchTerm))
    if (groupFilter === 'todos') return [...selected, ...rest]
    const allowed = new Set(visibleKeywords.map((k) => k.term))
    return [...selected, ...rest].filter((r) => allowed.has(r.searchTerm))
  }, [compare, selectedTerms, groupFilter, visibleKeywords])

  const groups: { id: CampaignTrendsKeywordGroup | 'todos'; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'pauta', label: labelCampaignTrendsGroup('pauta') },
    { id: 'deputado', label: labelCampaignTrendsGroup('deputado') },
    { id: 'cidade', label: labelCampaignTrendsGroup('cidade') },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app/60 px-4 py-3">
        <p className={cn(typographyBodyMutedClass, 'text-sm leading-relaxed')}>
          Virais das <strong>pautas da campanha</strong> no Piauí (BR-PI): Hospital de Amor, ECA Digital,
          Atalaia, Jadyel e cidades-foco. O índice <strong>0–100</strong> é popularidade relativa no período —
          não é quantidade de buscas. Selecione até {MAX_COMPARE} assuntos para comparar no gráfico. Expanda a
          linha para ver consultas relacionadas e termos em ascensão.
        </p>
        <p className="mt-2 text-[11px] text-text-muted">
          Mapa por cidade (onde o assunto aparece mais) ainda não está disponível nesta versão do Trends.
        </p>
      </div>

      {setupRequired ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Execute{' '}
          <code className="rounded bg-white/80 px-1">database/create-google-trends-tables.sql</code> e{' '}
          <code className="rounded bg-white/80 px-1">database/create-google-trends-related.sql</code> no
          Supabase antes da primeira coleta.
        </div>
      ) : null}

      {!runnerAvailable && runnerMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Coleta indisponível em produção</p>
          <p className="mt-1">{runnerMessage}</p>
        </div>
      ) : null}

      <div className={chromePanelToolbarClass}>
        <span className={chromeFilterChipClass(true)}>{GOOGLE_TRENDS_WINDOW_LABEL}</span>
        <span className={typographyBodyMutedClass}>· Piauí ({GEO})</span>
        <button
          type="button"
          disabled={collecting || setupRequired || !runnerAvailable}
          onClick={() => void coletar()}
          className={cn(chromeButtonClass, 'ml-auto')}
        >
          {collecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Atualizar pautas
        </button>
      </div>

      {collecting ? (
        <p className="text-xs text-text-muted">
          Coletando interesse e consultas relacionadas das pautas da campanha (pode levar alguns minutos).
        </p>
      ) : null}

      {seriesStale ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Série desatualizada</p>
          <p className="mt-1">
            Clique em <strong>Atualizar pautas</strong> para recarregar os {GOOGLE_TRENDS_WINDOW_LABEL} mais
            recentes do Google Trends no Piauí.
          </p>
        </div>
      ) : null}

      {collectedAt ? (
        <p className="text-xs text-text-muted">
          Última coleta:{' '}
          {new Date(collectedAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {dateFrom && dateTo ? (
            <>
              {' '}
              · Período: {formatShortDate(dateFrom)} – {formatShortDate(dateTo)}
            </>
          ) : null}
        </p>
      ) : null}
      {collectMessage ? <p className="text-sm text-[#3B6D11]">{collectMessage}</p> : null}
      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-medium text-text-primary">Assuntos da campanha</h2>
            <p className="text-xs text-text-muted">
              Marque até {MAX_COMPARE} para o gráfico ({selectedTerms.length}/{MAX_COMPARE})
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupFilter(g.id)}
                className={chromeFilterChipClass(groupFilter === g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {visibleKeywords.map((k) => {
            const selected = selectedTerms.includes(k.term)
            const hasSeries = series.some((s) => s.searchTerm === k.term)
            return (
              <button
                key={k.term}
                type="button"
                onClick={() => toggleTerm(k.term)}
                disabled={!selected && selectedTerms.length >= MAX_COMPARE}
                title={hasSeries ? k.term : `${k.term} (sem série — rode Atualizar pautas)`}
                className={cn(
                  chromeFilterChipClass(selected),
                  !hasSeries && 'opacity-70',
                  !selected && selectedTerms.length >= MAX_COMPARE && 'cursor-not-allowed opacity-40'
                )}
              >
                {k.label ?? k.term}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-text-muted">
          Coleta padrão: {CAMPAIGN_TRENDS_PAUTAS.length} pautas + {CAMPAIGN_TRENDS_DEPUTADO.length} variações do
          deputado. Cidades-foco ({CAMPAIGN_TRENDS_CIDADES.length}) aparecem no filtro para comparação quando
          houver dados.
        </p>
      </div>

      <TrendsInterestChart
        series={selectedSeries}
        chartData={selectedChartData}
        loading={loading}
        description={`Índice relativo 0–100 (não é volume de buscas) · Google Trends · Piauí · ${GOOGLE_TRENDS_WINDOW_LABEL}`}
        emptyMessage="Selecione até 5 pautas e rode Atualizar pautas para ver o interesse ao longo do tempo."
      />
      <TrendsCompareBoard
        rows={selectedCompare}
        loading={loading}
        emptyMessage="Sem séries das pautas ainda. Clique em Atualizar pautas (interesse + consultas em ascensão)."
      />
    </div>
  )
}
