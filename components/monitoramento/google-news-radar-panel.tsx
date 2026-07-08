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
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean | null>(null)
  const [mentions, setMentions] = useState<GoogleNewsMentionWithActor[]>([])
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState('')
  const [collectMessage, setCollectMessage] = useState('')
  const [conexaoInstavel, setConexaoInstavel] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    let instavel = false
    try {
      const [actorsRes, mentionsRes, configRes] = await Promise.all([
        fetch('/api/monitoramento/actors', { cache: 'no-store' }),
        fetch(`/api/google-news/mentions?politico=all&days=${lookbackDays}&limit=500&channel=news`, {
          cache: 'no-store',
        }),
        fetch('/api/google-news/collect', { cache: 'no-store' }),
      ])

      const configJson = (await configRes.json()) as { webSearchEnabled?: boolean }
      setWebSearchEnabled(Boolean(configJson.webSearchEnabled))

      const actorsJson = (await actorsRes.json()) as {
        error?: string
        retryable?: boolean
        setupRequired?: boolean
        actors?: PoliticalActorWithTerms[]
      }
      if (actorsRes.ok) {
        setSetupRequired(Boolean(actorsJson.setupRequired))
        setActors(actorsJson.actors ?? [])
      } else if (actorsJson.retryable) {
        instavel = true
      } else if (actorsJson.setupRequired) {
        setSetupRequired(true)
      }

      const mentionsJson = (await mentionsRes.json()) as {
        error?: string
        retryable?: boolean
        setupRequired?: boolean
        mentions?: GoogleNewsMentionWithActor[]
      }

      if (!mentionsRes.ok) {
        if (mentionsJson.setupRequired) {
          setSetupRequired(true)
          setMentions([])
        } else if (mentionsJson.retryable) {
          instavel = true
        } else {
          throw new Error(mentionsJson.error ?? 'Falha ao carregar notícias.')
        }
      } else {
        setSetupRequired(Boolean(mentionsJson.setupRequired))
        setMentions(mentionsJson.mentions ?? [])
      }

      setConexaoInstavel(instavel)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar Google News.')
    } finally {
      setLoading(false)
    }
  }, [lookbackDays])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (!conexaoInstavel) return
    const id = window.setTimeout(() => void carregar(), 5000)
    return () => window.clearTimeout(id)
  }, [conexaoInstavel, carregar])

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
        webSearchEnabled?: boolean
        totals?: {
          articlesFound: number
          articlesInserted: number
          articlesUpdated: number
          webArticlesFound?: number
        }
      }
      if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')

      const t = j.totals
      setCollectMessage(
        t
          ? `Coleta concluída: ${t.articlesFound} no Google Notícias${
              j.webSearchEnabled && t.webArticlesFound != null && t.webArticlesFound > 0
                ? ` · ${t.webArticlesFound} na busca web`
                : ''
            } · ${t.articlesInserted} novas · ${t.articlesUpdated} atualizadas`
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

      {webSearchEnabled === false ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          Busca web (Google.com + Instagram indexado) desativada. Configure{' '}
          <code className="rounded bg-white/80 px-1">GOOGLE_CSE_API_KEY</code> e{' '}
          <code className="rounded bg-white/80 px-1">GOOGLE_CSE_ID</code> no ambiente. Vídeos (Playwright) estão
          na aba <strong>Google Vídeos</strong>.
        </div>
      ) : null}

      <div className={chromePanelToolbarClass}>
        <span className={typographyBodyMutedClass}>Janela: {lookbackDays} dias · Google Notícias RSS</span>
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
          Atualizar notícias
        </button>
      </div>

      {collectMessage ? <p className="text-sm text-[#3B6D11]">{collectMessage}</p> : null}
      {conexaoInstavel && !error ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Conexão com o Supabase instável. Tentando novamente…
        </div>
      ) : null}
      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      <GoogleNewsCompareBoard
        actors={actors}
        mentions={mentions}
        lookbackDays={lookbackDays}
        loading={loading}
        variant="news"
      />

      {!setupRequired ? (
        <YoutubeActorsManager actors={actors} onChanged={carregar} disabled={loading || collecting} />
      ) : null}
    </div>
  )
}
