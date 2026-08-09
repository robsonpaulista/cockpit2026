'use client'

import { ChevronRight, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PanoramaMentionHeatmap } from '@/components/monitoramento/panorama-mention-heatmap'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import { WarRoomNoticiasDesempenhoView } from '@/components/war-room/war-room-noticias-desempenho-view'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { useWarRoomViewMode } from '@/components/war-room/war-room-view-mode-context'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import type { HeatmapScaleMode } from '@/lib/monitoramento-heatmap-colors'
import { buildGoogleNewsRelatedHeatmap } from '@/lib/monitoramento-panorama-charts'
import { buildPanoramaHeatmapActorColumns } from '@/lib/monitoramento-panorama'
import { buildNoticiasDesempenhoRows } from '@/lib/war-room/noticias-desempenho'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

/** Radar Eleitoral usa 30 dias; na War Room limitamos a 7. */
const LOOKBACK_DAYS = 7
const FETCH_LIMIT = 500
/** Perfil temático — fora do comparativo de candidatos na War Room. */
const HIDDEN_ACTOR_SLUGS = new Set(['instagram-causa-animal'])

const ESCALA_OPCOES: Array<{
  id: HeatmapScaleMode
  label: string
  title: string
}> = [
  {
    id: 'comparative',
    label: 'Todos',
    title: 'Mesma escala entre candidatos',
  },
  {
    id: 'individual',
    label: 'Por candidato',
    title: 'Escala relativa ao pico de cada candidato',
  },
]

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
 * Mesmo heatmap de “Notícias relacionadas” do Radar Eleitoral / IPT,
 * com shell clean da War Room e janela de 7 dias.
 */
export function WarRoomNoticiasCard({ className }: Props) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('noticias')
  const { isDesempenho } = useWarRoomViewMode()
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

  const actorsVisiveis = useMemo(
    () => actors.filter((a) => !HIDDEN_ACTOR_SLUGS.has(a.slug)),
    [actors],
  )

  const columns = useMemo(
    () => buildPanoramaHeatmapActorColumns(actorsVisiveis),
    [actorsVisiveis],
  )

  const heatmap = useMemo(
    () => buildGoogleNewsRelatedHeatmap(columns, mentions, LOOKBACK_DAYS),
    [columns, mentions],
  )

  const desempenhoRows = useMemo(
    () => buildNoticiasDesempenhoRows(actorsVisiveis, mentions),
    [actorsVisiveis, mentions],
  )

  const snapshotLines = useMemo(() => {
    if (isDesempenho) {
      return desempenhoRows.map(
        (row) => `${row.slug}\t${row.qtde}\t${row.portal}`,
      )
    }
    return heatmap.rows.flatMap((row) =>
      row.values.map((value, i) => `${row.slug}|${heatmap.dates[i]}\t${value}`),
    )
  }, [desempenhoRows, heatmap, isDesempenho])

  useWarRoomSnapshot({
    cardId: 'noticias',
    lines: loading && mentions.length === 0 && actors.length === 0 ? null : snapshotLines,
    noun: 'menção',
    ready: !loading || actors.length > 0 || mentions.length > 0,
  })

  const initialLoading = loading && actors.length === 0 && mentions.length === 0
  const showHeatmap =
    !isDesempenho && !initialLoading && !erro && columns.length > 0 && !heatmap.empty

  return (
    <section
      id="wr-noticias"
      className={cn('wr-noticias-clean', 'wr-cell--noticias', className)}
      aria-label="Notícias relacionadas"
    >
      <header className="wr-noticias-clean__header wr-noticias-clean__header--filtros">
        <div className="wr-noticias-clean__title-row">
          <div>
            <h2 className="wr-noticias-clean__heading">Notícias relacionadas</h2>
            <p className="wr-noticias-clean__sub">
              {isDesempenho
                ? `Nome · qtde · portal · ${LOOKBACK_DAYS} dias`
                : `Menções por dia · ${LOOKBACK_DAYS} dias`}
            </p>
          </div>
          {change ? (
            <WarRoomChangeBadge change={change} className="wr-noticias-clean__badge" />
          ) : null}
        </div>
        {showHeatmap ? (
          <div
            className="wr-noticias-clean__filtros"
            role="group"
            aria-label="Escala do heatmap"
          >
            {ESCALA_OPCOES.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                title={opcao.title}
                aria-pressed={scaleMode === opcao.id}
                className={cn(
                  'wr-noticias-clean__filtro',
                  scaleMode === opcao.id && 'wr-noticias-clean__filtro--ativo',
                )}
                onClick={() => setScaleMode(opcao.id)}
              >
                {opcao.label}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {initialLoading ? (
        <div className="wr-noticias-clean__state">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          Carregando notícias…
        </div>
      ) : erro ? (
        <p className="wr-noticias-clean__state wr-noticias-clean__state--erro">{erro}</p>
      ) : columns.length === 0 ? (
        <p className="wr-noticias-clean__state">
          Cadastre candidatos no Radar Eleitoral para ver o comparativo.
        </p>
      ) : isDesempenho ? (
        <div className="wr-noticias-clean__body">
          <WarRoomNoticiasDesempenhoView rows={desempenhoRows} />
        </div>
      ) : heatmap.empty ? (
        <p className="wr-noticias-clean__state">
          Nenhuma menção nos últimos {LOOKBACK_DAYS} dias.
        </p>
      ) : (
        <div className="wr-noticias-clean__body">
          <PanoramaMentionHeatmap
            dates={heatmap.dates}
            rows={heatmap.rows}
            metricLabel="Matérias"
            enableNewsModal
            scaleMode={scaleMode}
            onScaleModeChange={setScaleMode}
            hideScaleControls
            compact
            className="wr-noticias-clean__heatmap"
          />
        </div>
      )}

      <Link
        href="/dashboard/noticias/monitoramento?tab=google-news"
        className="wr-noticias-clean__footer"
      >
        <span>Abrir radar</span>
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      </Link>
    </section>
  )
}
