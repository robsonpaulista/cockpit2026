'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw, Youtube } from 'lucide-react'
import { YoutubeActorsManager } from '@/components/youtube-radar/youtube-actors-manager'
import { YoutubeCompareBoard } from '@/components/youtube-radar/youtube-compare-board'
import type { PoliticalActorWithTerms, YoutubeMentionWithActor } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

const LOOKBACK_OPTIONS = [1, 7, 30] as const

export default function YoutubeRadarPage() {
  const [lookbackDays, setLookbackDays] = useState<number>(7)
  const [actors, setActors] = useState<PoliticalActorWithTerms[]>([])
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [mentions, setMentions] = useState<YoutubeMentionWithActor[]>([])
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
        fetch(`/api/youtube/mentions?politico=all&days=${lookbackDays}&limit=500`, {
          cache: 'no-store',
        }),
      ])

      const actorsJson = (await actorsRes.json()) as {
        configured?: boolean
        setupRequired?: boolean
        actors?: PoliticalActorWithTerms[]
        error?: string
      }
      setApiConfigured(Boolean(actorsJson.configured))
      setSetupRequired(Boolean(actorsJson.setupRequired))
      setActors(actorsJson.actors ?? [])

      if (!mentionsRes.ok) {
        const j = (await mentionsRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? 'Falha ao carregar menções.')
      }

      const mentionsJson = (await mentionsRes.json()) as {
        mentions: YoutubeMentionWithActor[]
      }
      setMentions(mentionsJson.mentions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar radar.')
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
      const res = await fetch('/api/youtube/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookbackDays }),
      })
      const j = (await res.json()) as {
        error?: string
        totals?: { videosFound: number; videosInserted: number; videosUpdated: number; quotaEstimate: number }
      }
      if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')

      const t = j.totals
      setCollectMessage(
        t
          ? `Coleta concluída: ${t.videosFound} vídeos encontrados · ${t.videosInserted} novos · ${t.videosUpdated} atualizados · ~${t.quotaEstimate} un. de quota`
          : 'Coleta concluída.'
      )
      await carregar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setCollecting(false)
    }
  }, [lookbackDays, carregar])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[rgb(var(--color-primary))]">
            <Youtube className="h-5 w-5" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wide">Radar eleitoral</span>
          </div>
          <h1 className="text-lg font-semibold text-text-primary">YouTube · menções</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Monitoramento por termos de busca em vídeos públicos — portais, TVs, podcasts e canais
            políticos.
          </p>
        </div>
        <Link
          href="/dashboard/noticias"
          className="text-sm text-[rgb(var(--color-primary))] hover:underline"
        >
          ← Voltar ao Radar de notícias
        </Link>
      </div>

      {setupRequired ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Execute o script{' '}
          <code className="rounded bg-white/80 px-1">database/create-youtube-radar-tables.sql</code> no
          Supabase antes da primeira coleta.
        </div>
      ) : null}

      {apiConfigured === false ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Configure <code className="rounded bg-white/80 px-1">YOUTUBE_DATA_API_KEY</code> em{' '}
          <code className="rounded bg-white/80 px-1">.env.local</code> e reinicie o servidor.
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
          disabled={collecting || apiConfigured === false || setupRequired}
          onClick={() => void coletar()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-primary))] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {collecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Buscar todos no YouTube
        </button>
      </div>

      {collectMessage ? <p className="text-sm text-[#3B6D11]">{collectMessage}</p> : null}
      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      <YoutubeCompareBoard
        actors={actors}
        mentions={mentions}
        lookbackDays={lookbackDays}
        loading={loading}
      />

      {!setupRequired ? (
        <YoutubeActorsManager
          actors={actors}
          onChanged={carregar}
          disabled={loading || collecting}
        />
      ) : null}
    </div>
  )
}
