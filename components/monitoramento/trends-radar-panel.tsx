'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { TrendsCompareBoard } from '@/components/trends-radar/trends-compare-board'
import { TrendsInterestChart } from '@/components/trends-radar/trends-interest-chart'
import type {
  GoogleTrendsCompareRow,
  GoogleTrendsSeries,
  GoogleTrendsTimeframe,
} from '@/lib/google-trends-types'
import { cn } from '@/lib/utils'

const TIMEFRAME_OPTIONS: { value: GoogleTrendsTimeframe; label: string }[] = [
  { value: 'today 7-d', label: '7 dias' },
  { value: 'today 1-m', label: '1 mês' },
  { value: 'today 3-m', label: '3 meses' },
]

const GEO = 'BR-PI'

export function TrendsRadarPanel() {
  const [timeframe, setTimeframe] = useState<GoogleTrendsTimeframe>('today 3-m')
  const [series, setSeries] = useState<GoogleTrendsSeries[]>([])
  const [compare, setCompare] = useState<GoogleTrendsCompareRow[]>([])
  const [chartData, setChartData] = useState<Array<Record<string, string | number>>>([])
  const [setupRequired, setSetupRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState('')
  const [collectMessage, setCollectMessage] = useState('')
  const [collectedAt, setCollectedAt] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/trends/interest?geo=${encodeURIComponent(GEO)}&timeframe=${encodeURIComponent(timeframe)}`,
        { cache: 'no-store' }
      )
      const j = (await res.json()) as {
        error?: string
        series?: GoogleTrendsSeries[]
        compare?: GoogleTrendsCompareRow[]
        chartData?: Array<Record<string, string | number>>
        setupRequired?: boolean
        collectedAt?: string | null
      }
      if (!res.ok) throw new Error(j.error ?? 'Falha ao carregar Trends.')

      setSetupRequired(Boolean(j.setupRequired))
      setSeries(j.series ?? [])
      setCompare(j.compare ?? [])
      setChartData(j.chartData ?? [])
      setCollectedAt(j.collectedAt ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar Trends.')
    } finally {
      setLoading(false)
    }
  }, [timeframe])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const coletar = useCallback(async () => {
    setCollecting(true)
    setCollectMessage('')
    setError('')
    try {
      const res = await fetch('/api/trends/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geo: GEO, timeframe }),
      })
      const j = (await res.json()) as {
        error?: string
        terms?: number
        termsSucceeded?: number
        rowsUpserted?: number
        errors?: string[]
      }
      if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')

      const ok = j.termsSucceeded ?? 0
      const total = j.terms ?? 0
      setCollectMessage(
        ok === total
          ? `Coleta concluída: ${ok} nomes · ${j.rowsUpserted ?? 0} pontos salvos`
          : `Coleta parcial: ${ok}/${total} nomes · ${j.rowsUpserted ?? 0} pontos salvos${
              j.errors?.length ? `. Falhas: ${j.errors.join('; ')}` : ''
            }`
      )
      await carregar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setCollecting(false)
    }
  }, [timeframe, carregar])

  return (
    <div className="flex flex-col gap-4">
      {setupRequired ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Execute{' '}
          <code className="rounded bg-white/80 px-1">database/create-google-trends-tables.sql</code> no
          Supabase antes da primeira coleta.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-3">
        <span className="text-xs text-text-muted">Janela:</span>
        {TIMEFRAME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTimeframe(opt.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              timeframe === opt.value
                ? 'border-[rgb(var(--color-primary))] bg-[#E6F1FB] text-[rgb(var(--color-primary))]'
                : 'border-[rgb(var(--color-border-secondary)/0.85)] text-text-secondary hover:bg-bg-app'
            )}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-xs text-text-muted">· Piauí ({GEO})</span>
        <button
          type="button"
          disabled={collecting || setupRequired}
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
          Comparando todos os candidatos em uma requisição (escala relativa do Google). Se houver rate
          limit, o servidor aguarda e tenta de novo — pode levar até 2 minutos.
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
        </p>
      ) : null}
      {collectMessage ? <p className="text-sm text-[#3B6D11]">{collectMessage}</p> : null}
      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      <TrendsInterestChart series={series} chartData={chartData} loading={loading} />
      <TrendsCompareBoard rows={compare} loading={loading} />
    </div>
  )
}
