'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { RadarCompetitivoBoard } from '@/components/war-room/radar-competitivo-board'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import {
  COPILOTO_REDES_PERIOD_OPTIONS,
  copilotoRedesDays,
  type CopilotoRedesPeriod,
} from '@/lib/war-room/redes-copiloto'
import { cn } from '@/lib/utils'

const FETCH_LIMIT = 400

type RadarBootstrapPayload = {
  error?: string
  actors?: PoliticalActorWithTerms[]
  posts?: InstagramRadarPostWithActor[]
  commenterStats?: Array<{
    politicoId: string
    uniqueCommenters: number
    commentsSampled: number
    postsWithComments: number
  }>
}

function formatLastUpdateLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Copiloto · Comparativo — Radar Competitivo iOS light. */
export function WarRoomCopilotoComparativoView() {
  const [period, setPeriod] = useState<CopilotoRedesPeriod>('7d')
  const days = copilotoRedesDays(period)
  const periodLabel =
    COPILOTO_REDES_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? `${days} dias`

  const [actors, setActors] = useState<PoliticalActorWithTerms[]>([])
  const [posts, setPosts] = useState<InstagramRadarPostWithActor[]>([])
  const [commenterStats, setCommenterStats] = useState<
    NonNullable<RadarBootstrapPayload['commenterStats']>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/instagram-radar/bootstrap?days=${days}&limit=${FETCH_LIMIT}`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as RadarBootstrapPayload
      if (!res.ok) {
        throw new Error(json.error || 'Falha ao carregar comparativo')
      }
      setActors(json.actors ?? [])
      setPosts(json.posts ?? [])
      setCommenterStats(json.commenterStats ?? [])
      setLastUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar comparativo')
      setActors([])
      setPosts([])
      setCommenterStats([])
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="wr-copiloto-comparativo wr-copiloto-reveal">
      <header
        className="wr-copiloto-comparativo__toolbar wr-copiloto-reveal__card"
        style={{ ['--wr-reveal-i' as string]: 0 }}
      >
        <nav className="wr-copiloto-redes__period-tabs" aria-label="Período">
          {COPILOTO_REDES_PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                'wr-copiloto-redes__period-tab',
                period === opt.value && 'wr-copiloto-redes__period-tab--active',
              )}
              aria-pressed={period === opt.value}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </nav>

        <div className="wr-copiloto-comparativo__toolbar-actions">
          <p className="wr-copiloto-redes__last-update">
            <span className="wr-copiloto-redes__last-update-label">Última atualização:</span>{' '}
            <span className="wr-copiloto-redes__last-update-value">
              {lastUpdatedAt ? formatLastUpdateLabel(lastUpdatedAt) : '—'}
            </span>
          </p>
          <button
            type="button"
            className="wr-copiloto-redes__ghost-btn"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
              strokeWidth={1.5}
              aria-hidden
            />
            Atualizar
          </button>
        </div>
      </header>

      <div className="wr-copiloto-comparativo__body">
        {error ? <p className="wr-copiloto-comparativo__error">{error}</p> : null}
        {loading && actors.length === 0 ? (
          <div className="wr-copiloto-comparativo__state">
            <Loader2
              className="h-5 w-5 animate-spin text-[var(--wr-accent,#F04B23)]"
              strokeWidth={1.5}
            />
            <span>Carregando Comparativo…</span>
          </div>
        ) : (
          <RadarCompetitivoBoard
            actors={actors}
            posts={posts}
            commenterStats={commenterStats}
            days={days}
            periodLabel={periodLabel}
            loading={loading}
          />
        )}
      </div>
    </div>
  )
}
