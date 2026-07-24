'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconLoader2, IconNews } from '@tabler/icons-react'
import {
  PanoramaHeatmapScaleToggle,
  PanoramaMentionHeatmap,
} from '@/components/monitoramento/panorama-mention-heatmap'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import type { HeatmapScaleMode } from '@/lib/monitoramento-heatmap-colors'
import { buildGoogleNewsRelatedHeatmap } from '@/lib/monitoramento-panorama-charts'
import { buildPanoramaHeatmapActorColumns } from '@/lib/monitoramento-panorama'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

/** Radar Eleitoral usa 30 dias; na War Room limitamos a 7. */
const LOOKBACK_DAYS = 7
const FETCH_LIMIT = 500
/** Perfil temático — fora do comparativo de candidatos na War Room. */
const HIDDEN_ACTOR_SLUGS = new Set(['instagram-causa-animal'])

type MentionsApiPayload = {
  ok?: boolean
  error?: string
  mentions?: GoogleNewsMentionWithActor[]
}

type ActorsApiPayload = {
  error?: string
  actors?: PoliticalActorWithTerms[]
}

type Props = {
  className?: string
}

/**
 * Card 3 do bloco pesquisas — mesmo heatmap de “Notícias relacionadas”
 * do Radar Eleitoral, com janela de 7 dias.
 */
export function WarRoomNoticiasCard({ className }: Props) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('noticias')
  const [actors, setActors] = useState<PoliticalActorWithTerms[]>([])
  const [mentions, setMentions] = useState<GoogleNewsMentionWithActor[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [scaleMode, setScaleMode] = useState<HeatmapScaleMode>('comparative')

  const carregar = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
      setErro(null)
    }
    try {
      const [actorsRes, mentionsRes] = await Promise.all([
        fetch('/api/monitoramento/actors', { cache: 'no-store' }),
        fetch(
          `/api/google-news/mentions?politico=all&days=${LOOKBACK_DAYS}&limit=${FETCH_LIMIT}&channel=news`,
          { cache: 'no-store' },
        ),
      ])

      const actorsJson = (await actorsRes.json()) as ActorsApiPayload
      const mentionsJson = (await mentionsRes.json()) as MentionsApiPayload

      if (!actorsRes.ok) {
        throw new Error(actorsJson.error || 'Falha ao carregar candidatos')
      }
      if (!mentionsRes.ok) {
        throw new Error(mentionsJson.error || 'Falha ao carregar notícias')
      }

      setActors(actorsJson.actors ?? [])
      setMentions(mentionsJson.mentions ?? [])
    } catch (e) {
      if (!silent) {
        setErro(e instanceof Error ? e.message : 'Erro na busca')
        setActors([])
        setMentions([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar({ silent: false })
  }, [carregar])

  useEffect(() => {
    return register('noticias', async ({ silent }) => {
      await carregar({ silent })
    })
  }, [register, carregar])

  const columns = useMemo(
    () =>
      buildPanoramaHeatmapActorColumns(
        actors.filter((a) => !HIDDEN_ACTOR_SLUGS.has(a.slug)),
      ),
    [actors],
  )

  const heatmap = useMemo(
    () => buildGoogleNewsRelatedHeatmap(columns, mentions, LOOKBACK_DAYS),
    [columns, mentions],
  )

  const snapshotLines = useMemo(
    () =>
      heatmap.rows.flatMap((row) =>
        row.values.map((value, i) => `${row.slug}|${heatmap.dates[i]}\t${value}`),
      ),
    [heatmap],
  )

  useWarRoomSnapshot({
    cardId: 'noticias',
    lines: loading && mentions.length === 0 && actors.length === 0 ? null : snapshotLines,
    noun: 'menção',
    ready: !loading || actors.length > 0 || mentions.length > 0,
  })

  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-[#ebe8e4] bg-white p-3.5 shadow-[0_1px_2px_rgba(28,25,23,0.03)] md:p-4',
        className,
      )}
      aria-label="Notícias relacionadas aos candidatos"
    >
      <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#57534e]">
            <IconNews
              className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--color-primary))]"
              stroke={1.5}
              aria-hidden
            />
            <span className="truncate">Notícias relacionadas</span>
            <WarRoomChangeBadge change={change} />
          </h2>
          <p className="mt-0.5 text-[10px] text-[#a8a29e]">
            Menções por dia · {LOOKBACK_DAYS} dias
          </p>
        </div>
        {!loading && !erro && !heatmap.empty ? (
          <PanoramaHeatmapScaleToggle
            className="wr-noticias-scale"
            scaleMode={scaleMode}
            onScaleModeChange={setScaleMode}
          />
        ) : null}
      </div>

      {loading && actors.length === 0 && mentions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-4 text-[12px] text-[#78716c]">
          <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
          Carregando notícias…
        </div>
      ) : erro ? (
        <p className="py-4 text-center text-[12px] text-[#dc2626]">{erro}</p>
      ) : columns.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-[#78716c]">
          Cadastre candidatos no Radar Eleitoral para ver o comparativo.
        </p>
      ) : heatmap.empty ? (
        <p className="py-4 text-center text-[12px] text-[#78716c]">
          Nenhuma menção nos últimos {LOOKBACK_DAYS} dias.
        </p>
      ) : (
        <PanoramaMentionHeatmap
          dates={heatmap.dates}
          rows={heatmap.rows}
          metricLabel="Matérias"
          enableNewsModal
          scaleMode={scaleMode}
          onScaleModeChange={setScaleMode}
          hideScaleControls
          compact
          className="wr-noticias-heatmap min-h-0 flex-1"
        />
      )}
    </section>
  )
}
