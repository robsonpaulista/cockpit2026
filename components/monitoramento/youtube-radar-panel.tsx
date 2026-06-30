'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { YoutubeActorsManager } from '@/components/youtube-radar/youtube-actors-manager'
import { YoutubeCompareBoard } from '@/components/youtube-radar/youtube-compare-board'
import type { PoliticalActorWithTerms, YoutubeMentionWithActor } from '@/lib/youtube-radar-types'
import { chromeButtonClass, chromePanelToolbarClass } from '@/lib/button-chrome'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

const LOOKBACK_DAYS = 30

export function YoutubeRadarPanel() {
  const lookbackDays = LOOKBACK_DAYS
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
    <div className="flex flex-col gap-4">
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

      <div className={chromePanelToolbarClass}>
        <span className={typographyBodyMutedClass}>Janela: {lookbackDays} dias</span>
        <button
          type="button"
          disabled={collecting || apiConfigured === false || setupRequired}
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
