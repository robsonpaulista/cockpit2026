'use client'

import { useCallback, useEffect, useState } from 'react'
import { Flame, Loader2, RefreshCw } from 'lucide-react'
import { chromeButtonClass, chromeFilterChipClass, chromePanelToolbarClass } from '@/lib/button-chrome'
import {
  DEFAULT_GOOGLE_TRENDING_GEO,
  DEFAULT_GOOGLE_TRENDING_HOURS,
  GOOGLE_TRENDING_HOURS,
  formatTrendingTraffic,
  googleTrendingHoursLabel,
  type GoogleTrendingHours,
  type GoogleTrendingTopicRow,
} from '@/lib/google-trending-topics-types'
import { readResponseJson } from '@/lib/parse-response-json'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

const GEO = DEFAULT_GOOGLE_TRENDING_GEO

function formatCollectedAt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function growthLabel(rate: number | null): string | null {
  if (rate == null || !Number.isFinite(rate)) return null
  const pct = Math.round(rate * 100)
  if (pct === 0) return null
  return pct > 0 ? `+${pct}%` : `${pct}%`
}

export function ViralTrendsPanel() {
  const [hours, setHours] = useState<GoogleTrendingHours>(DEFAULT_GOOGLE_TRENDING_HOURS)
  const [items, setItems] = useState<GoogleTrendingTopicRow[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [collectedAt, setCollectedAt] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState('')
  const [collectMessage, setCollectMessage] = useState('')
  const [runnerAvailable, setRunnerAvailable] = useState(true)
  const [runnerMessage, setRunnerMessage] = useState<string | null>(null)

  const carregar = useCallback(async (selectedHours: GoogleTrendingHours) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/viral-trends/topics?geo=${encodeURIComponent(GEO)}&hours=${selectedHours}`,
        { cache: 'no-store' }
      )
      const j = await readResponseJson<{
        error?: string
        setupRequired?: boolean
        collectedAt?: string | null
        items?: GoogleTrendingTopicRow[]
        history?: string[]
      }>(res)
      if (!res.ok) throw new Error(j.error ?? 'Falha ao carregar temas em alta.')

      setSetupRequired(Boolean(j.setupRequired))
      setCollectedAt(j.collectedAt ?? null)
      setItems(j.items ?? [])
      setHistory(j.history ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar temas em alta.')
    } finally {
      setLoading(false)
    }
  }, [])

  const pollCollectUntilDone = useCallback(async () => {
    const maxMs = 90_000
    const started = Date.now()

    while (Date.now() - started < maxMs) {
      const res = await fetch('/api/viral-trends/status', { cache: 'no-store' })
      const j = await readResponseJson<{
        collectInProgress?: boolean
        lastCollectResult?: {
          itemsUpserted?: number
          keywords?: string[]
        } | null
        lastCollectError?: string | null
      }>(res)

      if (!j.collectInProgress) {
        if (j.lastCollectError) throw new Error(j.lastCollectError)
        const r = j.lastCollectResult
        if (r) {
          setCollectMessage(
            `Coleta concluída: ${r.itemsUpserted ?? 0} temas em alta no Brasil.`
          )
        }
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 1_500))
    }

    throw new Error('Tempo esgotado na coleta de temas em alta.')
  }, [])

  useEffect(() => {
    void carregar(hours)
  }, [carregar, hours])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/viral-trends/status', { cache: 'no-store' })
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
            await carregar(hours)
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
  }, [carregar, hours, pollCollectUntilDone])

  const coletar = useCallback(async () => {
    setCollecting(true)
    setCollectMessage('')
    setError('')
    try {
      const res = await fetch('/api/viral-trends/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geo: GEO, hours }),
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
      await carregar(hours)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setCollecting(false)
    }
  }, [carregar, hours, pollCollectUntilDone])

  return (
    <div className="flex flex-col gap-4">
      {setupRequired ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Execute{' '}
          <code className="rounded bg-white/80 px-1">database/create-google-trending-topics.sql</code> no
          Supabase antes da primeira coleta.
        </div>
      ) : null}

      {!runnerAvailable && runnerMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Coleta indisponível em produção</p>
          <p className="mt-1">{runnerMessage}</p>
          <p className="mt-1 text-amber-800/80">
            Localmente: <code className="rounded bg-white/80 px-1">node scripts/collect-google-trending-topics.mjs</code>
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app/60 px-4 py-3">
        <div className="flex items-start gap-2">
          <Flame className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <p className={cn(typographyBodyMutedClass, 'text-sm leading-relaxed')}>
            Temas mais buscados no Google no Brasil agora — sinal de pauta que pode alimentar Reels,
            TikTok e posts. Não cobre áudio/dança (isso fica para a fase TikTok).
          </p>
        </div>
      </div>

      <div className={chromePanelToolbarClass}>
        <div className="flex flex-wrap items-center gap-1.5">
          {GOOGLE_TRENDING_HOURS.map((option) => (
            <button
              key={option}
              type="button"
              disabled={collecting}
              onClick={() => setHours(option)}
              className={chromeFilterChipClass(hours === option)}
            >
              {googleTrendingHoursLabel(option)}
            </button>
          ))}
        </div>
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
          Atualizar
        </button>
      </div>

      {collecting ? (
        <p className="text-xs text-text-muted">Consultando temas em alta no Google Trends…</p>
      ) : null}

      {collectedAt ? (
        <p className="text-xs text-text-muted">
          Última coleta: {formatCollectedAt(collectedAt)}
          {history.length > 1 ? ` · ${history.length} snapshots recentes` : null}
        </p>
      ) : null}
      {collectMessage ? <p className="text-sm text-[#3B6D11]">{collectMessage}</p> : null}
      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando temas…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-text-muted">
          Nenhum snapshot ainda. Clique em <strong>Atualizar</strong> para puxar os temas do momento.
        </div>
      ) : (
        <ol className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-white">
          {items.map((item) => {
            const growth = growthLabel(item.traffic_growth_rate)
            return (
              <li key={item.id} className="flex gap-3 px-4 py-3">
                <span className="w-7 shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums text-text-muted">
                  {item.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium text-text-primary">{item.keyword}</p>
                    <span className="text-xs text-text-muted">
                      ~{formatTrendingTraffic(item.traffic)} buscas
                    </span>
                    {growth ? (
                      <span
                        className={cn(
                          'text-xs font-medium',
                          growth.startsWith('+') ? 'text-[#3B6D11]' : 'text-status-danger'
                        )}
                      >
                        {growth}
                      </span>
                    ) : null}
                  </div>
                  {item.related_keywords?.length ? (
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">
                      {item.related_keywords.slice(0, 6).join(' · ')}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
