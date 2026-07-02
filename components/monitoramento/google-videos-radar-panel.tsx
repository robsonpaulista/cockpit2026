'use client'



import { useCallback, useEffect, useState } from 'react'

import { Loader2, RefreshCw } from 'lucide-react'

import { GoogleNewsCompareBoard } from '@/components/google-news-radar/google-news-compare-board'

import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'

import type { GoogleVideosCollectStatus } from '@/lib/google-videos-collect'

import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

import {

  GOOGLE_VIDEOS_CAUSA_ANIMAL_QUERIES,

  resolveGoogleVideosSearchQueriesForActor,

} from '@/lib/google-news-search-term'

import { chromeButtonClass, chromePanelToolbarClass } from '@/lib/button-chrome'

import { typographyBodyMutedClass } from '@/lib/typography-chrome'

import { cn } from '@/lib/utils'



const LOOKBACK_DAYS = 30



function formatNextCollect(iso: string | null): string {

  if (!iso) return ''

  return new Date(iso).toLocaleString('pt-BR', {

    day: '2-digit',

    month: 'short',

    hour: '2-digit',

    minute: '2-digit',

  })

}



export function GoogleVideosRadarPanel() {

  const lookbackDays = LOOKBACK_DAYS

  const [actors, setActors] = useState<PoliticalActorWithTerms[]>([])

  const [setupRequired, setSetupRequired] = useState(false)

  const [logSetupRequired, setLogSetupRequired] = useState(false)

  const [status, setStatus] = useState<

    (GoogleVideosCollectStatus & { message?: string; pilot?: { terms: string[] } }) | null

  >(null)

  const [mentions, setMentions] = useState<GoogleNewsMentionWithActor[]>([])

  const [loading, setLoading] = useState(true)

  const [collecting, setCollecting] = useState(false)

  const [error, setError] = useState('')

  const [collectMessage, setCollectMessage] = useState('')



  const refreshStatus = useCallback(async () => {

    const res = await fetch('/api/google-videos/status', { cache: 'no-store' })

    const j = (await res.json()) as GoogleVideosCollectStatus & {

      setupRequired?: boolean

      message?: string

      pilot?: { terms: string[] }

      error?: string

    }

    if (j.setupRequired) {

      setLogSetupRequired(true)

      setStatus(j)

      return j

    }

    if (!res.ok) {

      setError(j.error ?? 'Falha ao carregar status do Google Vídeos.')

      return null

    }

    setLogSetupRequired(false)

    setStatus(j)

    return j

  }, [])



  const carregar = useCallback(async () => {

    setLoading(true)

    setError('')

    try {

      const [actorsRes, mentionsRes] = await Promise.all([

        fetch('/api/monitoramento/actors', { cache: 'no-store' }),

        fetch(

          `/api/google-news/mentions?politico=all&days=${lookbackDays}&limit=500&channel=google_videos`,

          { cache: 'no-store' }

        ),

        refreshStatus(),

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

        throw new Error(mentionsJson.error ?? 'Falha ao carregar vídeos.')

      }



      setSetupRequired(Boolean(mentionsJson.setupRequired))

      setMentions(mentionsJson.mentions ?? [])

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Erro ao carregar Google Vídeos.')

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

    setError('')

    try {

      const res = await fetch('/api/google-videos/collect', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({}),

      })

      const j = (await res.json()) as {

        error?: string

        runnerAvailable?: boolean

        totals?: {

          videosFound: number

          videosInserted: number

          videosUpdated: number

          collectSkipped?: boolean

          skipReason?: string | null

          errors?: string[]

        }

      }

      if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')



      const t = j.totals

      setCollectMessage(

        t

          ? t.collectSkipped && t.skipReason

            ? t.skipReason

            : t.videosFound === 0 && t.errors?.length

              ? t.errors.join(' · ')

            : `Coleta concluída: ${t.videosFound} vídeos · ${t.videosInserted} novos · ${t.videosUpdated} atualizados`

          : 'Coleta concluída.'

      )

      await carregar()

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Erro na coleta.')

    } finally {

      setCollecting(false)

    }

  }, [carregar])



  const runnerAvailable = status?.runnerAvailable ?? false

  const videoInCooldown =

    Boolean(status?.cooldownEnabled) && !status?.canCollect && Boolean(status?.nextCollectAt)

  const pilotTerms = status?.pilot?.terms ?? [...GOOGLE_VIDEOS_CAUSA_ANIMAL_QUERIES]

  const videoActors = actors.filter((a) => resolveGoogleVideosSearchQueriesForActor(a).length > 0)



  return (

    <div className="flex flex-col gap-4">

      {setupRequired ? (

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">

          Execute{' '}

          <code className="rounded bg-white/80 px-1">database/create-google-news-radar-tables.sql</code> no

          Supabase antes da primeira coleta.

        </div>

      ) : null}



      {logSetupRequired ? (

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">

          Execute{' '}

          <code className="rounded bg-white/80 px-1">database/create-google-videos-collect-log.sql</code> no

          Supabase para habilitar cooldown e log de coletas.

        </div>

      ) : null}



      {!runnerAvailable ? (

        <div className="rounded-xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-sm text-sky-950">

          Google Vídeos usa <strong>Playwright + Chromium</strong> — indisponível na Vercel. Rode localmente

          com <code className="rounded bg-white/80 px-1">npm run dev</code> ou{' '}

          <code className="rounded bg-white/80 px-1">node scripts/collect-google-videos.mjs</code>. Instale o

          browser: <code className="rounded bg-white/80 px-1">npx playwright install chromium</code>

        </div>

      ) : videoInCooldown ? (

        <div className="rounded-xl border border-sky-200/60 bg-sky-50/60 px-4 py-3 text-sm text-sky-950">

          <strong>Em cooldown</strong> ({status?.cooldownDays} dias) — dados anteriores mantidos no Supabase.

          Próxima coleta:{' '}

          <strong>{formatNextCollect(status?.nextCollectAt ?? null)}</strong>

        </div>

      ) : (

        <div className="rounded-xl border border-sky-200/60 bg-sky-50/60 px-4 py-3 text-sm text-sky-950">

          <strong>Piloto castração:</strong> aba Vídeos do Google (Playwright · Instagram, YouTube, Facebook…) ·{' '}

          {pilotTerms.length} termos · cooldown {status?.cooldownDays ?? 7} dias

        </div>

      )}



      <div className={chromePanelToolbarClass}>

        <span className={typographyBodyMutedClass}>Janela: {lookbackDays} dias · Playwright Google Vídeos</span>

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

          Atualizar vídeos

        </button>

      </div>



      {collectMessage ? <p className="text-sm text-[#3B6D11]">{collectMessage}</p> : null}

      {error ? <p className="text-sm text-status-danger">{error}</p> : null}



      <GoogleNewsCompareBoard

        actors={videoActors}

        mentions={mentions}

        lookbackDays={lookbackDays}

        loading={loading}

        variant="videos"

      />

    </div>

  )

}

