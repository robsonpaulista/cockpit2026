'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2, RefreshCw } from 'lucide-react'
import { MetaAdsCollectProgressBar } from '@/components/meta-ads-radar/meta-ads-collect-progress-bar'
import { MetaAdsCompareBoard } from '@/components/meta-ads-radar/meta-ads-compare-board'
import { YoutubeActorsManager } from '@/components/youtube-radar/youtube-actors-manager'
import { useMetaAdsCollectPolling } from '@/hooks/use-meta-ads-collect-polling'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

const LOOKBACK_OPTIONS = [30, 60, 90] as const

function formatNextCollect(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MetaAdsRadarPanel() {
  const [lookbackDays, setLookbackDays] = useState<number>(30)
  const [actors, setActors] = useState<PoliticalActorWithTerms[]>([])
  const [setupRequired, setSetupRequired] = useState(false)
  const [ads, setAds] = useState<MetaAdsMentionWithActor[]>([])
  const [statusMessage, setStatusMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState('')
  const [collectMessage, setCollectMessage] = useState('')
  const [collectWarnings, setCollectWarnings] = useState<string[]>([])
  const [pollCollect, setPollCollect] = useState(false)

  const { progress, status, refresh: refreshStatus } = useMetaAdsCollectPolling(
    collecting || pollCollect
  )

  useEffect(() => {
    if (status?.collectInProgress) setPollCollect(true)
    else if (!collecting) setPollCollect(false)
  }, [status?.collectInProgress, collecting])

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [actorsRes, adsRes, statusJson] = await Promise.all([
        fetch('/api/youtube/actors', { cache: 'no-store' }),
        fetch(`/api/meta-ads/mentions?politico=all&days=${lookbackDays}&limit=500`, {
          cache: 'no-store',
        }),
        refreshStatus(),
      ])

      const actorsJson = (await actorsRes.json()) as {
        setupRequired?: boolean
        actors?: PoliticalActorWithTerms[]
      }
      setSetupRequired(Boolean(actorsJson.setupRequired))
      setActors(actorsJson.actors ?? [])

      const adsJson = (await adsRes.json()) as {
        error?: string
        setupRequired?: boolean
        ads?: MetaAdsMentionWithActor[]
      }

      if (!adsRes.ok) {
        if (adsJson.setupRequired) {
          setSetupRequired(true)
          setAds([])
        } else {
          throw new Error(adsJson.error ?? 'Falha ao carregar anúncios Meta.')
        }
      } else {
        setSetupRequired(Boolean(adsJson.setupRequired))
        setAds(adsJson.ads ?? [])
      }

      if (statusJson?.setupRequired) setSetupRequired(true)
      if (statusJson?.message) setStatusMessage(statusJson.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar Meta Ads.')
    } finally {
      setLoading(false)
    }
  }, [lookbackDays, refreshStatus])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const coletar = useCallback(async () => {
    setCollecting(true)
    setCollectMessage('')
    setCollectWarnings([])
    setError('')
    try {
      const res = await fetch('/api/meta-ads/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const j = (await res.json()) as {
        error?: string
        totals?: {
          adsFound: number
          adsInserted: number
          adsUpdated: number
          errors?: string[]
        }
      }
      if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')

      const t = j.totals
      const warnings = (t?.errors ?? []).filter(Boolean)
      setCollectWarnings(warnings)
      setCollectMessage(
        t
          ? `Coleta concluída: ${t.adsFound} anúncios encontrados · ${t.adsInserted} novos · ${t.adsUpdated} atualizados`
          : 'Coleta concluída.'
      )
      await carregar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setCollecting(false)
      await refreshStatus()
    }
  }, [carregar, refreshStatus])

  const canCollect = status?.canCollect ?? true
  const dailyLimitEnabled = status?.dailyLimitEnabled ?? true
  const collectInProgress = collecting || Boolean(status?.collectInProgress)
  const collectDisabled =
    collectInProgress || setupRequired || (dailyLimitEnabled && !canCollect && !collecting)

  return (
    <div className="flex flex-col gap-4">
      {setupRequired ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Execute{' '}
          <code className="rounded bg-white/80 px-1">database/create-meta-ads-radar-tables.sql</code> no
          Supabase antes da primeira coleta. Se a tabela já existia, rode também{' '}
          <code className="rounded bg-white/80 px-1">database/alter-meta-ads-mentions-spend.sql</code> para
          habilitar gasto e impressões. Opcional:{' '}
          <code className="rounded bg-white/80 px-1">database/alter-meta-ads-collect-log-progress.sql</code>{' '}
          para barra de progresso. Em seguida rode{' '}
          <code className="rounded bg-white/80 px-1">npx playwright install chromium</code> no servidor.
        </div>
      ) : null}

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="font-medium">
          {dailyLimitEnabled
            ? 'Limite de coleta: 1 vez a cada 24 horas'
            : 'Coleta liberada (sem limite de 24h)'}
        </p>
        <p className="mt-1 text-blue-800/90">
          {statusMessage ||
            (dailyLimitEnabled
              ? 'Coleta rápida: listagem na biblioteca da Meta (gasto, impressões, páginas). Limite de 1 busca completa por dia.'
              : 'Modo desenvolvimento: META_ADS_SKIP_DAILY_LIMIT está ativo. Coleta rápida sem localização geográfica.')}
        </p>
        {dailyLimitEnabled && status && !status.canCollect && status.nextCollectAt && !collectInProgress ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-900">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Próxima coleta disponível: {formatNextCollect(status.nextCollectAt)}
            {status.hoursUntilNextCollect !== null && status.hoursUntilNextCollect > 0
              ? ` (≈ ${status.hoursUntilNextCollect}h)`
              : ''}
          </p>
        ) : null}
      </div>

      <MetaAdsCollectProgressBar progress={progress} collecting={collectInProgress} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-3">
        <span className="text-xs text-text-muted">Janela:</span>
        {LOOKBACK_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => setLookbackDays(days)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              lookbackDays === days
                ? 'border-[rgb(var(--color-primary))] bg-[#E6F1FB] text-[rgb(var(--color-primary))]'
                : 'border-[rgb(var(--color-border-secondary)/0.85)] text-text-secondary hover:bg-bg-app'
            )}
          >
            {days} dias
          </button>
        ))}
        <button
          type="button"
          disabled={collectDisabled}
          onClick={() => void coletar()}
          title={
            dailyLimitEnabled && !canCollect && status?.nextCollectAt
              ? `Próxima coleta: ${formatNextCollect(status.nextCollectAt)}`
              : undefined
          }
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-primary))] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {collectInProgress ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Buscar na Meta Ads Library
        </button>
      </div>

      {collectMessage ? <p className="text-sm text-[#3B6D11]">{collectMessage}</p> : null}
      {collectWarnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p className="font-medium">Avisos da coleta</p>
          <ul className="mt-1 list-disc pl-4">
            {collectWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      <MetaAdsCompareBoard
        actors={actors}
        ads={ads}
        lookbackDays={lookbackDays}
        loading={loading}
      />

      {!setupRequired ? (
        <YoutubeActorsManager actors={actors} onChanged={carregar} disabled={loading || collectInProgress} />
      ) : null}
    </div>
  )
}
