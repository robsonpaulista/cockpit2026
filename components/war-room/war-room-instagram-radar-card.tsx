'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  IconAd2,
  IconBrandInstagram,
  IconChevronRight,
  IconExternalLink,
  IconLoader2,
  IconUser,
} from '@tabler/icons-react'
import { buildInstagramRadarCompareRows } from '@/lib/instagram-radar-aggregate'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import {
  buildMetaAdsCompareRows,
  buildMetaAdsPeriodTotals,
  type MetaAdsCompareActorRow,
} from '@/lib/meta-ads-aggregate'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import { cn } from '@/lib/utils'

const IG_LOOKBACK_DAYS = 7
const ADS_LOOKBACK_DAYS = 30
const IG_FETCH_LIMIT = 400
const ADS_FETCH_LIMIT = 500
const LIST_VISIBLE = 9
const HIDDEN_ACTOR_SLUGS = new Set(['instagram-causa-animal'])

type FiltroId = 'engajamento' | 'anuncios'

const FILTRO_OPCOES: Array<{ id: FiltroId; label: string }> = [
  { id: 'engajamento', label: 'Engajamento' },
  { id: 'anuncios', label: 'Anúncios' },
]

type Highlight = 'best' | 'worst' | 'none'

type BootstrapPayload = {
  error?: string
  actors?: PoliticalActorWithTerms[]
  posts?: InstagramRadarPostWithActor[]
}

type MentionsApiPayload = {
  error?: string
  ads?: MetaAdsMentionWithActor[]
}

type ActorsApiPayload = {
  error?: string
  actors?: PoliticalActorWithTerms[]
}

type EngajamentoRow = {
  slug: string
  name: string
  username: string | null
  avgEngagement: number
  topEngagement: number | null
  topUrl: string | null
  topCaption: string | null
  avgHighlight: Highlight
}

type AnuncioRow = {
  slug: string
  name: string
  activeCount: number
  spendLabel: string
  pctOfActive: number
}

type Props = {
  className?: string
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function rankHighlights(values: number[]): Highlight[] {
  if (values.length < 2) return values.map(() => 'none')
  const max = Math.max(...values)
  const min = Math.min(...values)
  if (max === min) return values.map(() => 'none')
  return values.map((v) => {
    if (v === max) return 'best'
    if (v === min) return 'worst'
    return 'none'
  })
}

function buildActiveAdsRows(compare: MetaAdsCompareActorRow[]): AnuncioRow[] {
  const withActive = compare
    .filter((row) => row.activeCount > 0)
    .map((row) => {
      const activeAds = row.ads.filter((ad) => ad.is_active === true)
      const totals = buildMetaAdsPeriodTotals(activeAds)
      return {
        slug: row.actor.slug,
        name: row.actor.name,
        activeCount: row.activeCount,
        spendLabel: totals.spendLabel,
        pctOfActive: 0,
      }
    })
    .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name, 'pt-BR'))

  const totalActive = withActive.reduce((sum, row) => sum + row.activeCount, 0)
  return withActive.map((row) => ({
    ...row,
    pctOfActive:
      totalActive > 0 ? Math.round((row.activeCount / totalActive) * 100) : 0,
  }))
}

/**
 * Comparativo Candidatos — filtros Engajamento (IG 7d) | Anúncios (Meta ativos).
 */
export function WarRoomInstagramRadarCard({ className }: Props) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('instagram-radar')
  const [filtro, setFiltro] = useState<FiltroId>('engajamento')

  const [igActors, setIgActors] = useState<PoliticalActorWithTerms[]>([])
  const [igPosts, setIgPosts] = useState<InstagramRadarPostWithActor[]>([])
  const [igLoading, setIgLoading] = useState(true)
  const [igErro, setIgErro] = useState<string | null>(null)

  const [adsActors, setAdsActors] = useState<PoliticalActorWithTerms[]>([])
  const [ads, setAds] = useState<MetaAdsMentionWithActor[]>([])
  const [adsLoading, setAdsLoading] = useState(true)
  const [adsErro, setAdsErro] = useState<string | null>(null)

  const carregarEngajamento = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setIgLoading(true)
      setIgErro(null)
    }
    try {
      const res = await fetch(
        `/api/instagram-radar/bootstrap?days=${IG_LOOKBACK_DAYS}&limit=${IG_FETCH_LIMIT}`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as BootstrapPayload
      if (!res.ok) {
        throw new Error(json.error || 'Falha ao carregar Instagram do Radar')
      }
      setIgActors(json.actors ?? [])
      setIgPosts(json.posts ?? [])
    } catch (e) {
      if (!silent) {
        setIgErro(e instanceof Error ? e.message : 'Erro na busca')
        setIgActors([])
        setIgPosts([])
      }
    } finally {
      setIgLoading(false)
    }
  }, [])

  const carregarAnuncios = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setAdsLoading(true)
      setAdsErro(null)
    }
    try {
      const [actorsRes, adsRes] = await Promise.all([
        fetch('/api/monitoramento/actors', { cache: 'no-store' }),
        fetch(
          `/api/meta-ads/mentions?politico=all&days=${ADS_LOOKBACK_DAYS}&limit=${ADS_FETCH_LIMIT}`,
          { cache: 'no-store' },
        ),
      ])
      const actorsJson = (await actorsRes.json()) as ActorsApiPayload
      const adsJson = (await adsRes.json()) as MentionsApiPayload
      if (!actorsRes.ok) {
        throw new Error(actorsJson.error || 'Falha ao carregar candidatos')
      }
      if (!adsRes.ok) {
        throw new Error(adsJson.error || 'Falha ao carregar anúncios Meta')
      }
      setAdsActors(actorsJson.actors ?? [])
      setAds(adsJson.ads ?? [])
    } catch (e) {
      if (!silent) {
        setAdsErro(e instanceof Error ? e.message : 'Erro na busca')
        setAdsActors([])
        setAds([])
      }
    } finally {
      setAdsLoading(false)
    }
  }, [])

  const carregarTudo = useCallback(
    async (opts?: { silent?: boolean }) => {
      await Promise.all([
        carregarEngajamento(opts),
        carregarAnuncios(opts),
      ])
    },
    [carregarEngajamento, carregarAnuncios],
  )

  useEffect(() => {
    void carregarTudo({ silent: false })
  }, [carregarTudo])

  /**
   * Engajamento (Apify/IG) NÃO entra no refresh da War Room —
   * coleta só no Radar Eleitoral (limite free do Apify).
   * Aqui só reatualiza a aba Anúncios.
   */
  useEffect(() => {
    return register('instagram-radar', async ({ silent }) => {
      await carregarAnuncios({ silent })
    })
  }, [register, carregarAnuncios])

  const engajamentoRows = useMemo((): EngajamentoRow[] => {
    const visibleActors = igActors.filter((a) => !HIDDEN_ACTOR_SLUGS.has(a.slug))
    const compare = buildInstagramRadarCompareRows(
      visibleActors,
      igPosts,
      IG_LOOKBACK_DAYS,
    )
    const withActivity = compare
      .filter((row) => row.postCount > 0)
      .map((row) => ({
        slug: row.actor.slug,
        name: row.actor.name,
        username: row.instagramUsername,
        avgEngagement: row.avgEngagement,
        topEngagement: row.topPost?.engagement ?? null,
        topUrl: row.topPost?.post_url?.trim() || null,
        topCaption: row.topPost?.caption?.trim() || null,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)

    const highlights = rankHighlights(withActivity.map((r) => r.avgEngagement))
    return withActivity.map((row, i) => ({
      ...row,
      avgHighlight: highlights[i] ?? 'none',
    }))
  }, [igActors, igPosts])

  const anuncioRows = useMemo(() => {
    const visibleActors = adsActors.filter((a) => !HIDDEN_ACTOR_SLUGS.has(a.slug))
    return buildActiveAdsRows(buildMetaAdsCompareRows(visibleActors, ads))
  }, [adsActors, ads])

  const adsKpis = useMemo(() => {
    const candidatos = anuncioRows.length
    const anuncios = anuncioRows.reduce((sum, row) => sum + row.activeCount, 0)
    const activeAds = ads.filter(
      (ad) =>
        ad.is_active === true &&
        ad.political_actors?.slug &&
        !HIDDEN_ACTOR_SLUGS.has(ad.political_actors.slug),
    )
    const spend = buildMetaAdsPeriodTotals(activeAds)
    return { candidatos, anuncios, spendLabel: spend.spendLabel }
  }, [anuncioRows, ads])

  const snapshotLines = useMemo(
    () => [
      ...engajamentoRows.map(
        (r) =>
          `ig\t${r.slug}\t${r.avgEngagement}\t${r.topEngagement ?? ''}`,
      ),
      ...anuncioRows.map(
        (r) => `ads\t${r.slug}\t${r.activeCount}\t${r.spendLabel}`,
      ),
    ],
    [engajamentoRows, anuncioRows],
  )

  useWarRoomSnapshot({
    cardId: 'instagram-radar',
    lines:
      igLoading && adsLoading && igPosts.length === 0 && ads.length === 0
        ? null
        : snapshotLines,
    noun: 'candidato',
    ready: !igLoading || !adsLoading || igActors.length > 0 || adsActors.length > 0,
  })

  const showEngajamento = filtro === 'engajamento'
  const igInitial = igLoading && igActors.length === 0 && igPosts.length === 0
  const adsInitial = adsLoading && adsActors.length === 0 && ads.length === 0

  return (
    <section
      id="wr-instagram-radar"
      className={cn('wr-ig-radar', 'wr-cell--instagram-radar', className)}
      aria-label="Comparativo candidatos"
    >
      <header className="wr-ig-radar__header wr-ig-radar__header--filtros">
        <div className="wr-ig-radar__title-row">
          <div>
            <h2 className="wr-ig-radar__heading">Comparativo Candidatos</h2>
            <p className="wr-ig-radar__sub">
              {showEngajamento
                ? `Instagram · últimos ${IG_LOOKBACK_DAYS} dias`
                : `Meta Ads · anúncios ativos · ${ADS_LOOKBACK_DAYS} dias`}
            </p>
          </div>
          {change ? (
            <WarRoomChangeBadge change={change} className="wr-ig-radar__badge" />
          ) : null}
        </div>
        <div
          className="wr-ig-radar__filtros"
          role="group"
          aria-label="Filtrar comparativo"
        >
          {FILTRO_OPCOES.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              aria-pressed={filtro === opcao.id}
              className={cn(
                'wr-ig-radar__filtro',
                filtro === opcao.id && 'wr-ig-radar__filtro--ativo',
              )}
              onClick={() => setFiltro(opcao.id)}
            >
              {opcao.label}
            </button>
          ))}
        </div>
      </header>

      {showEngajamento ? (
        igInitial ? (
          <div className="wr-ig-radar__state">
            <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
            Carregando engajamento…
          </div>
        ) : igErro ? (
          <p className="wr-ig-radar__state wr-ig-radar__state--erro">{igErro}</p>
        ) : igActors.length === 0 ? (
          <p className="wr-ig-radar__state">
            Cadastre candidatos no Radar Eleitoral para ver o comparativo.
          </p>
        ) : engajamentoRows.length === 0 ? (
          <p className="wr-ig-radar__state">
            Sem publicações monitoradas nos últimos {IG_LOOKBACK_DAYS} dias.
          </p>
        ) : (
          <div className="wr-ig-radar__body">
            <ul className="wr-ig-radar__list" aria-label="Comparativo de engajamento">
              <li className="wr-ig-radar__row wr-ig-radar__row--head" aria-hidden>
                <span>@</span>
                <span className="text-right">Eng. médio</span>
                <span className="text-right">Top 1</span>
              </li>
              {engajamentoRows.slice(0, LIST_VISIBLE).map((row) => {
                const label = row.username ? `@${row.username}` : row.name
                const topHint = row.topCaption
                  ? `${formatWarRoomNumber(row.topEngagement ?? 0)} eng. — ${row.topCaption}`
                  : row.topEngagement != null
                    ? `${formatWarRoomNumber(row.topEngagement)} eng.`
                    : undefined
                return (
                  <li
                    key={row.slug}
                    className="wr-ig-radar__row"
                    title={`${row.name}${row.username ? ` · @${row.username}` : ''}`}
                  >
                    <span
                      className={cn(
                        'wr-ig-radar__handle truncate',
                        !row.username && 'wr-ig-radar__handle--warn',
                      )}
                    >
                      {label}
                    </span>
                    <span
                      className={cn(
                        'wr-ig-radar__avg tabular-nums',
                        row.avgHighlight === 'best' && 'wr-ig-radar__avg--best',
                        row.avgHighlight === 'worst' && 'wr-ig-radar__avg--worst',
                      )}
                    >
                      {formatWarRoomNumber(row.avgEngagement)}
                    </span>
                    <span className="wr-ig-radar__top">
                      {row.topEngagement != null ? (
                        row.topUrl ? (
                          <a
                            href={row.topUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={topHint}
                            className="wr-ig-radar__top-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="tabular-nums">
                              {formatWarRoomNumber(row.topEngagement)}
                            </span>
                            <IconExternalLink
                              className="h-3 w-3 shrink-0 opacity-70"
                              aria-hidden
                            />
                            <span className="sr-only">Abrir postagem no Instagram</span>
                          </a>
                        ) : (
                          <span className="tabular-nums" title={topHint}>
                            {formatWarRoomNumber(row.topEngagement)}
                          </span>
                        )
                      ) : (
                        <span className="wr-ig-radar__empty">—</span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
            {engajamentoRows.length > LIST_VISIBLE ? (
              <p className="wr-ig-radar__more">
                +{engajamentoRows.length - LIST_VISIBLE} candidato
                {engajamentoRows.length - LIST_VISIBLE === 1 ? '' : 's'}
              </p>
            ) : null}
          </div>
        )
      ) : adsInitial ? (
        <div className="wr-ig-radar__state">
          <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
          Carregando anúncios…
        </div>
      ) : adsErro ? (
        <p className="wr-ig-radar__state wr-ig-radar__state--erro">{adsErro}</p>
      ) : adsActors.length === 0 ? (
        <p className="wr-ig-radar__state">
          Cadastre candidatos no Radar Eleitoral para ver anúncios.
        </p>
      ) : anuncioRows.length === 0 ? (
        <p className="wr-ig-radar__state">
          Nenhum candidato com anúncio ativo na janela.
        </p>
      ) : (
        <div className="wr-ig-radar__body">
          <div className="wr-meta-ads-clean__kpis" aria-label="Indicadores de anúncios ativos">
            <div className="wr-meta-ads-clean__kpi wr-meta-ads-clean__kpi--gold">
              <span className="wr-meta-ads-clean__kpi-value tabular-nums">
                {formatInt(adsKpis.candidatos)}
              </span>
              <span className="wr-meta-ads-clean__kpi-label">Candidatos</span>
            </div>
            <div className="wr-meta-ads-clean__kpi wr-meta-ads-clean__kpi--slate">
              <span className="wr-meta-ads-clean__kpi-value tabular-nums">
                {formatInt(adsKpis.anuncios)}
              </span>
              <span className="wr-meta-ads-clean__kpi-label">Ativos</span>
            </div>
            <div className="wr-meta-ads-clean__kpi wr-meta-ads-clean__kpi--mist">
              <span className="wr-meta-ads-clean__kpi-value wr-meta-ads-clean__kpi-value--spend">
                {adsKpis.spendLabel}
              </span>
              <span className="wr-meta-ads-clean__kpi-label">Investimento</span>
            </div>
          </div>

          <ul className="wr-meta-ads-clean__list" aria-label="Candidatos com anúncios ativos">
            {anuncioRows.slice(0, LIST_VISIBLE).map((row) => (
              <li key={row.slug} className="wr-meta-ads-clean__row">
                <span className="wr-meta-ads-clean__icon" aria-hidden>
                  <IconUser className="h-3.5 w-3.5" stroke={1.6} />
                </span>
                <span className="wr-meta-ads-clean__label truncate" title={row.name}>
                  {row.name}
                </span>
                <span className="wr-meta-ads-clean__value tabular-nums">
                  {formatInt(row.activeCount)}
                </span>
                <div
                  className="wr-meta-ads-clean__bar"
                  role="progressbar"
                  aria-valuenow={row.pctOfActive}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${row.name}: ${formatInt(row.activeCount)} ativos`}
                >
                  <span
                    className="wr-meta-ads-clean__bar-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, row.pctOfActive))}%`,
                    }}
                  />
                </div>
                <span
                  className="wr-meta-ads-clean__spend truncate"
                  title={row.spendLabel}
                >
                  {row.spendLabel}
                </span>
              </li>
            ))}
          </ul>

          {anuncioRows.length > LIST_VISIBLE ? (
            <p className="wr-meta-ads-clean__more">
              +{anuncioRows.length - LIST_VISIBLE} candidato
              {anuncioRows.length - LIST_VISIBLE === 1 ? '' : 's'} com anúncios ativos
            </p>
          ) : null}
        </div>
      )}

      {showEngajamento ? (
        <Link
          href="/dashboard/noticias/monitoramento?tab=instagram"
          className="wr-ig-radar__footer"
        >
          <span className="inline-flex items-center gap-1.5">
            <IconBrandInstagram className="h-3.5 w-3.5" stroke={1.6} aria-hidden />
            Abrir Instagram
          </span>
          <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
        </Link>
      ) : (
        <Link
          href="/dashboard/noticias/monitoramento?tab=meta-ads"
          className="wr-ig-radar__footer"
        >
          <span className="inline-flex items-center gap-1.5">
            <IconAd2 className="h-3.5 w-3.5" stroke={1.6} aria-hidden />
            Abrir Anúncios
          </span>
          <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
        </Link>
      )}
    </section>
  )
}
