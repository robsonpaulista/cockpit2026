'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { TrendsCompareBoard } from '@/components/trends-radar/trends-compare-board'
import { TrendsInterestChart } from '@/components/trends-radar/trends-interest-chart'
import type {
  GoogleTrendsCompareRow,
  GoogleTrendsSeries,
} from '@/lib/google-trends-types'
import {
  DEFAULT_GOOGLE_TRENDS_TIMEFRAME,
  GOOGLE_TRENDS_WINDOW_LABEL,
} from '@/lib/google-trends-timeframe'
import { readResponseJson } from '@/lib/parse-response-json'

const GEO = 'BR-PI'
const TIMEFRAME = DEFAULT_GOOGLE_TRENDS_TIMEFRAME

function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

export function TrendsRadarPanel() {
  const [series, setSeries] = useState<GoogleTrendsSeries[]>([])
  const [compare, setCompare] = useState<GoogleTrendsCompareRow[]>([])
  const [chartData, setChartData] = useState<Array<Record<string, string | number>>>([])
  const [setupRequired, setSetupRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState('')
  const [collectMessage, setCollectMessage] = useState('')
  const [collectedAt, setCollectedAt] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)
  const [runnerAvailable, setRunnerAvailable] = useState(true)
  const [runnerMessage, setRunnerMessage] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/trends/interest?geo=${encodeURIComponent(GEO)}&timeframe=${encodeURIComponent(TIMEFRAME)}`,
        { cache: 'no-store' }
      )
      const j = await readResponseJson<{
        error?: string
        series?: GoogleTrendsSeries[]
        compare?: GoogleTrendsCompareRow[]
        chartData?: Array<Record<string, string | number>>
        setupRequired?: boolean
        collectedAt?: string | null
        dateFrom?: string | null
        dateTo?: string | null
      }>(res)
      if (!res.ok) throw new Error(j.error ?? 'Falha ao carregar Trends.')

      setSetupRequired(Boolean(j.setupRequired))
      setSeries(j.series ?? [])
      setCompare(j.compare ?? [])
      setChartData(j.chartData ?? [])
      setCollectedAt(j.collectedAt ?? null)
      setDateFrom(j.dateFrom ?? null)
      setDateTo(j.dateTo ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar Trends.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const pollCollectUntilDone = useCallback(async () => {
    const maxMs = 180_000
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
              ? `Coleta concluída: ${ok} nomes · ${r.rowsUpserted ?? 0} pontos${
                  related > 0 ? ` · ${related} itens relacionados` : ''
                }`
              : `Coleta parcial: ${ok}/${total} nomes · ${r.rowsUpserted ?? 0} pontos${
                  related > 0 ? ` · ${related} relacionados` : ''
                }${r.errors?.length ? `. Falhas: ${r.errors.join('; ')}` : ''}`
          )
        }
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 2_000))
    }

    throw new Error('Tempo esgotado na coleta do Google Trends.')
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
        body: JSON.stringify({ geo: GEO, timeframe: TIMEFRAME, skipRelated: true }),
      })
      const j = await readResponseJson<{
        error?: string
        started?: boolean
        collectInProgress?: boolean
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

  return (
    <div className="flex flex-col gap-4">
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

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-3">
        <span className="rounded-full border border-[rgb(var(--color-primary))] bg-[#E6F1FB] px-3 py-1 text-xs font-medium text-[rgb(var(--color-primary))]">
          {GOOGLE_TRENDS_WINDOW_LABEL}
        </span>
        <span className="text-xs text-text-muted">· Piauí ({GEO})</span>
        <button
          type="button"
          disabled={collecting || setupRequired || !runnerAvailable}
          onClick={() => void coletar()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-primary))] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {collecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Atualizar Trends
        </button>
      </div>

      {collecting ? (
        <p className="text-xs text-text-muted">
          Comparando interesse de busca dos candidatos (~1 min). Se houver rate limit, o servidor aguarda e
          tenta de novo.
        </p>
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
              · Período exibido: {formatShortDate(dateFrom)} – {formatShortDate(dateTo)}
            </>
          ) : null}
        </p>
      ) : null}
      {collectMessage ? <p className="text-sm text-[#3B6D11]">{collectMessage}</p> : null}
      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      <TrendsInterestChart series={series} chartData={chartData} loading={loading} />
      <TrendsCompareBoard rows={compare} loading={loading} />
    </div>
  )
}
