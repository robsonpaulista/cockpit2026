'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { GoogleNewsCompareBoard } from '@/components/google-news-radar/google-news-compare-board'
import { YoutubeActorsManager } from '@/components/youtube-radar/youtube-actors-manager'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

const LOOKBACK_OPTIONS = [1, 7, 30] as const

export function GoogleNewsRadarPanel() {
  const [lookbackDays, setLookbackDays] = useState<number>(7)
  const [actors, setActors] = useState<PoliticalActorWithTerms[]>([])
  const [setupRequired, setSetupRequired] = useState(false)
  const [mentions, setMentions] = useState<GoogleNewsMentionWithActor[]>([])
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState('')
  const [collectMessage, setCollectMessage] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [actorsRes, mentionsRes] = await Promise.all([
        fetch('/api/youtube/actors', { cache: 'no-store' }),
        fetch(`/api/google-news/mentions?politico=all&days=${lookbackDays}&limit=500`, {
          cache: 'no-store',
        }),
      ])

      const actorsJson = (await actorsRes.json()) as {
        setupRequired?: boolean
        actors?: PoliticalActorWithTerms[]
      }
      setSetupRequired(Boolean(actorsJson.setupRequired))
      setActors(actorsJson.actors ?? [])

      const mentionsJson = (await mentionsRes.json()) as {
        error?: string
        setupRequired?: boolean
        mentions?: GoogleNewsMentionWithActor[]
      }

      if (!mentionsRes.ok) {
        if (mentionsJson.setupRequired) {
          setSetupRequired(true)
          setMentions([])
          return
        }
        throw new Error(mentionsJson.error ?? 'Falha ao carregar notícias.')
      }

      setSetupRequired(Boolean(mentionsJson.setupRequired))
      setMentions(mentionsJson.mentions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar Google News.')
    } finally {
      setLoading(false)
    }
  }, [lookbackDays])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const coletar = useCallback(async () => {
    setCollecting(true)
    setCollectMessage('')
    setError('')
    try {
      const res = await fetch('/api/google-news/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const j = (await res.json()) as {
        error?: string
        totals?: {
          articlesFound: number
          articlesInserted: number
          articlesUpdated: number
        }
      }
      if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')

      const t = j.totals
      setCollectMessage(
        t
          ? `Coleta concluída: ${t.articlesFound} notícias encontradas · ${t.articlesInserted} novas · ${t.articlesUpdated} atualizadas`
          : 'Coleta concluída.'
      )
      await carregar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setCollecting(false)
    }
  }, [carregar])

  return (
    <div className="flex flex-col gap-4">
      {setupRequired ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Execute{' '}
          <code className="rounded bg-white/80 px-1">database/create-google-news-radar-tables.sql</code> no
          Supabase antes da primeira coleta.
        </div>
      ) : null}

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
            {days} dia{days === 1 ? '' : 's'}
          </button>
        ))}
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
          Buscar todos no Google News
        </button>
      </div>

      {collectMessage ? <p className="text-sm text-[#3B6D11]">{collectMessage}</p> : null}
      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      <GoogleNewsCompareBoard
        actors={actors}
        mentions={mentions}
        lookbackDays={lookbackDays}
        loading={loading}
      />

      {!setupRequired ? (
        <YoutubeActorsManager actors={actors} onChanged={carregar} disabled={loading || collecting} />
      ) : null}
    </div>
  )
}
