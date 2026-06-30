'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { GoogleNewsCompareBoard } from '@/components/google-news-radar/google-news-compare-board'
import { YoutubeActorsManager } from '@/components/youtube-radar/youtube-actors-manager'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { chromeButtonClass, chromePanelToolbarClass } from '@/lib/button-chrome'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

const LOOKBACK_DAYS = 30

export function GoogleNewsRadarPanel() {
  const lookbackDays = LOOKBACK_DAYS
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
        fetch('/api/monitoramento/actors', { cache: 'no-store' }),
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

      <div className={chromePanelToolbarClass}>
        <span className={typographyBodyMutedClass}>Janela: {lookbackDays} dias</span>
        <button
          type="button"
          disabled={collecting || setupRequired}
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
