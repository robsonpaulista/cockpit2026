'use client'

import { ChevronDown, Instagram, Loader2, RefreshCw, Trophy, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import {
  fetchInstagramData,
  fetchInstagramHistory,
  loadInstagramConfig,
  loadInstagramConfigAsync,
  type InstagramHistoryResponse,
  type InstagramMetrics,
} from '@/lib/instagramApi'
import {
  fetchInstagramProfileVisitsManual,
} from '@/lib/instagram-profile-visits-manual'
import { WarRoomCopilotoCandidatosEngajamentoChart } from '@/components/war-room/war-room-copiloto-candidatos-engajamento-chart'
import { WarRoomCopilotoJadyelAnuncios } from '@/components/war-room/war-room-copiloto-jadyel-anuncios'
import { WarRoomCopilotoRedesDesempenho } from '@/components/war-room/war-room-copiloto-redes-desempenho'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import { computeThemeComparison } from '@/lib/instagram-theme-comparison'
import { instagramCaptionHeader } from '@/lib/instagram-caption-municipio'
import {
  buildTopCandidatosEngajamentoDiario,
  type CandidatosEngajamentoChartModel,
} from '@/lib/war-room/instagram-candidatos-engajamento'
import {
  buildWarRoomRedesDesempenhoKpis,
  buildWarRoomRedesTopPosts,
  copilotoRedesApiTimeRange,
  copilotoRedesDays,
  COPILOTO_REDES_PERIOD_OPTIONS,
  getInstagramPostIdentifier,
  type CopilotoRedesPeriod,
} from '@/lib/war-room/redes-copiloto'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

const CANDIDATOS_FETCH_LIMIT = 400

type RadarBootstrapPayload = {
  error?: string
  actors?: PoliticalActorWithTerms[]
  posts?: InstagramRadarPostWithActor[]
}

type PostClassification = {
  theme?: string
  isBoosted?: boolean
}

type ThemeSortKey = 'engagement' | 'views'
type FeedViewId = 'feed' | 'comparativo'

const FEED_PREVIEW = 5
const THEMES_PREVIEW = 5

const FEED_VIEW_OPTIONS: Array<{ id: FeedViewId; label: string }> = [
  { id: 'feed', label: 'Feed' },
  { id: 'comparativo', label: 'Comparativo' },
]

function formatLastUpdateLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function ThemeRankTrophy({ rank }: { rank: number }) {
  // Sempre renderiza o slot: se null, o grid perde a coluna e o texto “corta” (ex. item 04).
  if (rank < 1 || rank > 3) {
    return <span className="wr-copiloto-list-card__theme-icon" aria-hidden />
  }
  const lugarClass =
    rank === 1
      ? 'wr-expectativa-ranking-modal__pesquisa-trophy--ouro'
      : rank === 2
        ? 'wr-expectativa-ranking-modal__pesquisa-trophy--prata'
        : 'wr-expectativa-ranking-modal__pesquisa-trophy--bronze'
  return (
    <span className="wr-copiloto-list-card__theme-icon" aria-label={`${rank}º lugar`}>
      <Trophy
        className={cn('wr-expectativa-ranking-modal__pesquisa-trophy', lugarClass)}
        strokeWidth={1.5}
        aria-hidden
      />
    </span>
  )
}

type BestPostByTheme = {
  theme: string
  header: string
  engagement: number
  url: string
}

type ThemeStatsRow = {
  posts: number
  likes: number
  comments: number
  views: number
  shares: number
  saves: number
  engagement: number
  avgLikes: number
  avgComments: number
  avgViews: number
  avgShares: number
  avgSaves: number
  avgEngagement: number
}

export function WarRoomCopilotoRedesView() {
  const [period, setPeriod] = useState<CopilotoRedesPeriod>('7d')
  const days = copilotoRedesDays(period)
  const periodLabel =
    COPILOTO_REDES_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? `${days} dias`
  const [metrics, setMetrics] = useState<InstagramMetrics | null>(null)
  const [history, setHistory] = useState<InstagramHistoryResponse | null>(null)
  const [manualVisitsByDate, setManualVisitsByDate] = useState<Record<string, number>>({})
  const [classifications, setClassifications] = useState<Record<string, PostClassification>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(false)
  const [topPostModalTheme, setTopPostModalTheme] = useState<string | null>(null)
  const [themeSort, setThemeSort] = useState<ThemeSortKey>('engagement')
  const [feedExpanded, setFeedExpanded] = useState(false)
  const [themesExpanded, setThemesExpanded] = useState(false)
  const [feedView, setFeedView] = useState<FeedViewId>('feed')
  const [radarActors, setRadarActors] = useState<PoliticalActorWithTerms[]>([])
  const [radarPosts, setRadarPosts] = useState<InstagramRadarPostWithActor[]>([])
  const [radarLoading, setRadarLoading] = useState(true)
  const [radarError, setRadarError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const topPostModalTitleId = useId()

  const loadClassifications = async () => {
    try {
      const response = await fetch('/api/instagram/classifications', { cache: 'no-store' })
      if (!response.ok) return
      const data = (await response.json()) as {
        success?: boolean
        classifications?: Record<string, PostClassification>
      }
      if (data.success && data.classifications) {
        setClassifications(data.classifications)
        return
      }
    } catch {
      // fallback
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('instagram_post_classifications')
      if (saved) {
        try {
          setClassifications(JSON.parse(saved) as Record<string, PostClassification>)
        } catch {
          // ignore
        }
      }
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let cfg = loadInstagramConfig()
      if (!cfg.token || !cfg.businessAccountId) {
        cfg = await loadInstagramConfigAsync()
      }
      if (!cfg.token || !cfg.businessAccountId) {
        setConfigured(false)
        setMetrics(null)
        setHistory(null)
        setManualVisitsByDate({})
        setError('Instagram Pessoal não configurado')
        return
      }
      setConfigured(true)
      const apiRange = copilotoRedesApiTimeRange(period)
      const [data, hist, visitsManual] = await Promise.all([
        fetchInstagramData(cfg.token, cfg.businessAccountId, apiRange, false),
        fetchInstagramHistory(days),
        fetchInstagramProfileVisitsManual(days),
      ])
      if (!data) {
        setError('Não foi possível carregar o Instagram')
        setMetrics(null)
        return
      }
      setMetrics(data)
      setHistory(hist)
      setManualVisitsByDate(visitsManual.byDate)
      setLastUpdatedAt(new Date())
      await loadClassifications()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar Instagram')
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [period, days])

  const loadRadarCandidatos = useCallback(async () => {
    setRadarLoading(true)
    setRadarError(null)
    try {
      const res = await fetch(
        `/api/instagram-radar/bootstrap?days=${days}&limit=${CANDIDATOS_FETCH_LIMIT}`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as RadarBootstrapPayload
      if (!res.ok) {
        throw new Error(json.error || 'Falha ao carregar comparativo de candidatos')
      }
      setRadarActors(json.actors ?? [])
      setRadarPosts(json.posts ?? [])
      setLastUpdatedAt(new Date())
    } catch (err) {
      setRadarError(
        err instanceof Error ? err.message : 'Erro ao carregar comparativo de candidatos',
      )
      setRadarActors([])
      setRadarPosts([])
    } finally {
      setRadarLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadRadarCandidatos()
  }, [loadRadarCandidatos])

  useEffect(() => {
    if (!topPostModalTheme) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTopPostModalTheme(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [topPostModalTheme])

  const topPosts = useMemo(
    () => buildWarRoomRedesTopPosts(metrics?.posts ?? [], days),
    [metrics, days],
  )

  const candidatosEngajamento = useMemo<CandidatosEngajamentoChartModel>(
    () =>
      buildTopCandidatosEngajamentoDiario({
        actors: radarActors,
        posts: radarPosts,
        days,
      }),
    [radarActors, radarPosts, days],
  )

  const postsInPeriod = useMemo(() => {
    const ids = new Set(topPosts.map((p) => p.id))
    return (metrics?.posts ?? []).filter((p) => ids.has(getInstagramPostIdentifier(p)))
  }, [metrics, topPosts])

  const feedVisible = useMemo(
    () => (feedExpanded ? topPosts : topPosts.slice(0, FEED_PREVIEW)),
    [feedExpanded, topPosts],
  )

  const themeStats = useMemo(() => {
    if (postsInPeriod.length === 0 || Object.keys(classifications).length === 0) return null
    const stats: Record<string, ThemeStatsRow> = {}

    for (const post of postsInPeriod) {
      const theme = classifications[getInstagramPostIdentifier(post)]?.theme
      if (!theme) continue
      if (!stats[theme]) {
        stats[theme] = {
          posts: 0,
          likes: 0,
          comments: 0,
          views: 0,
          shares: 0,
          saves: 0,
          engagement: 0,
          avgLikes: 0,
          avgComments: 0,
          avgViews: 0,
          avgShares: 0,
          avgSaves: 0,
          avgEngagement: 0,
        }
      }
      const s = stats[theme]
      s.posts += 1
      s.likes += post.metrics.likes || 0
      s.comments += post.metrics.comments || 0
      s.views += post.metrics.views || 0
      s.shares += post.metrics.shares || 0
      s.saves += post.metrics.saves || 0
      s.engagement += post.metrics.engagement || 0
    }

    for (const theme of Object.keys(stats)) {
      const s = stats[theme]
      s.avgLikes = s.posts > 0 ? Math.round(s.likes / s.posts) : 0
      s.avgComments = s.posts > 0 ? Math.round(s.comments / s.posts) : 0
      s.avgViews = s.posts > 0 ? Math.round(s.views / s.posts) : 0
      s.avgShares = s.posts > 0 ? Math.round(s.shares / s.posts) : 0
      s.avgSaves = s.posts > 0 ? Math.round(s.saves / s.posts) : 0
      s.avgEngagement = s.posts > 0 ? Math.round(s.engagement / s.posts) : 0
    }

    return Object.keys(stats).length > 0 ? stats : null
  }, [postsInPeriod, classifications])

  const themeRows = useMemo(() => {
    if (!themeStats) return []
    const comparison = computeThemeComparison(themeStats)
    return Object.entries(themeStats)
      .sort(([, a], [, b]) => {
        if (themeSort === 'views') {
          if (b.views !== a.views) return b.views - a.views
          return b.engagement - a.engagement
        }
        if (b.engagement !== a.engagement) return b.engagement - a.engagement
        return b.views - a.views
      })
      .map(([theme, stats]) => ({
        theme,
        stats,
        isLeader: comparison.overallLeader === theme,
      }))
  }, [themeStats, themeSort])

  const themeMetricMax = useMemo(() => {
    if (themeRows.length === 0) return 1
    return Math.max(
      1,
      ...themeRows.map((row) =>
        themeSort === 'views' ? row.stats.views : row.stats.engagement,
      ),
    )
  }, [themeRows, themeSort])

  const themeRowsVisible = useMemo(
    () => (themesExpanded ? themeRows : themeRows.slice(0, THEMES_PREVIEW)),
    [themesExpanded, themeRows],
  )

  useEffect(() => {
    setThemesExpanded(false)
    setFeedExpanded(false)
  }, [period])

  const bestPostByTheme = useMemo(() => {
    const best = new Map<string, BestPostByTheme>()
    for (const post of postsInPeriod) {
      const theme = classifications[getInstagramPostIdentifier(post)]?.theme
      if (!theme) continue
      const engagement = post.metrics.engagement || 0
      const current = best.get(theme)
      if (!current || engagement > current.engagement) {
        best.set(theme, {
          theme,
          header: instagramCaptionHeader(post.caption) || 'Sem legenda',
          engagement,
          url: post.url,
        })
      }
    }
    return best
  }, [postsInPeriod, classifications])

  const topPostModal = topPostModalTheme
    ? bestPostByTheme.get(topPostModalTheme) ?? null
    : null

  const desempenhoKpis = useMemo(
    () =>
      buildWarRoomRedesDesempenhoKpis({
        history,
        metrics,
        manualVisitsByDate,
        days,
      }),
    [history, metrics, manualVisitsByDate, days],
  )

  if (loading && !metrics) {
    return (
      <div className="wr-copiloto-view__state">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--wr-accent,#F04B23)]" strokeWidth={1.5} />
        <span>Carregando Redes Sociais…</span>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="wr-copiloto-view__state">
        <p>{error || 'Instagram Pessoal não configurado'}</p>
        <Link href="/dashboard/conteudo/redes" className="wr-copiloto-view__retry">
          Configurar em Redes
        </Link>
      </div>
    )
  }

  if (error && !metrics) {
    return (
      <div className="wr-copiloto-view__state">
        <p>{error}</p>
        <button type="button" className="wr-copiloto-view__retry" onClick={() => void load()}>
          Tentar de novo
        </button>
      </div>
    )
  }

  return (
    <div className="wr-copiloto-redes wr-copiloto-redes--page wr-copiloto-reveal">
      <header
        className="wr-copiloto-redes__toolbar wr-copiloto-reveal__card"
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
              onClick={() => setPeriod(opt.value)}
              aria-pressed={period === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </nav>

        <div className="wr-copiloto-redes__toolbar-actions">
          <p className="wr-copiloto-redes__last-update">
            <span className="wr-copiloto-redes__last-update-label">Última atualização:</span>{' '}
            <span className="wr-copiloto-redes__last-update-value">
              {lastUpdatedAt ? formatLastUpdateLabel(lastUpdatedAt) : '—'}
            </span>
          </p>

          <Link href="/dashboard/conteudo/redes" className="wr-copiloto-redes__ghost-btn">
            <Instagram className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            Instagram
          </Link>

          <button
            type="button"
            className="wr-copiloto-redes__ghost-btn"
            onClick={() => {
              void load()
              void loadRadarCandidatos()
            }}
            disabled={loading || radarLoading}
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', (loading || radarLoading) && 'animate-spin')}
              strokeWidth={1.5}
              aria-hidden
            />
            Atualizar
          </button>
        </div>
      </header>

      <div className="wr-copiloto-redes__cols wr-copiloto-redes__cols--split">
        <div className="wr-copiloto-redes__main">
          <section
            className={cn(
              'wr-copiloto-redes__band wr-copiloto-redes__band--feed wr-copiloto-reveal__card',
              feedView === 'comparativo' && 'wr-copiloto-redes__band--feed-comparativo',
            )}
            style={{ ['--wr-reveal-i' as string]: 1 }}
            aria-label="Feed do período"
          >
            <div className="wr-copiloto-redes__group-th wr-copiloto-redes__group-th--posts wr-copiloto-redes__group-th--split">
              <span className="wr-copiloto-redes__group-th-title">
                Feed do período
                {feedView === 'feed' ? (
                  <span className="wr-copiloto-redes__group-th-badge tabular-nums">
                    {topPosts.length} posts
                  </span>
                ) : (
                  <span className="wr-copiloto-redes__group-th-badge tabular-nums">
                    {candidatosEngajamento.lines.length} candidatos · {periodLabel}
                  </span>
                )}
              </span>
              <div className="wr-copiloto-redes__view-tabs" role="tablist" aria-label="Visão do feed">
                {FEED_VIEW_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={feedView === opt.id}
                    className={cn(
                      'wr-copiloto-redes__view-tab',
                      feedView === opt.id && 'wr-copiloto-redes__view-tab--active',
                    )}
                    onClick={() => setFeedView(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {feedView === 'feed' ? (
                <Link href="/dashboard/conteudo/redes" className="wr-copiloto-redes__group-th-link">
                  Ver tudo →
                </Link>
              ) : null}
            </div>
            <div className="wr-copiloto-redes__band-body">
              {feedView === 'comparativo' ? (
                radarLoading && candidatosEngajamento.empty ? (
                  <p className="wr-copiloto-redes__empty wr-copiloto-redes__empty--inline">
                    <Loader2
                      className="h-4 w-4 animate-spin text-[var(--wr-accent,#F04B23)]"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    Carregando candidatos…
                  </p>
                ) : radarError ? (
                  <p className="wr-copiloto-redes__empty">{radarError}</p>
                ) : (
                  <WarRoomCopilotoCandidatosEngajamentoChart model={candidatosEngajamento} />
                )
              ) : topPosts.length === 0 ? (
                <p className="wr-copiloto-redes__empty">
                  Nenhuma postagem nos últimos {periodLabel}.
                </p>
              ) : (
                <div className="wr-copiloto-list-card">
                  <ul className="wr-copiloto-list-card__list" aria-label="Posts do período">
                    {feedVisible.map((post) => {
                      const rowInner = (
                        <>
                          <span className="wr-copiloto-list-card__time-chip tabular-nums">
                            {post.dateLabel}
                          </span>
                          <span className="wr-copiloto-list-card__main">
                            <span className="wr-copiloto-list-card__title" title={post.header}>
                              {post.header}
                            </span>
                          </span>
                          <span className="wr-copiloto-list-card__metrics wr-copiloto-list-card__metrics--feed">
                            <span className="wr-copiloto-list-card__metric-primary tabular-nums">
                              {formatWarRoomNumber(post.engagement)}
                            </span>
                            <span className="wr-copiloto-list-card__metric-secondary">
                              engajamento
                            </span>
                          </span>
                        </>
                      )
                      return (
                        <li key={post.id} className="wr-copiloto-list-card__row">
                          {post.url ? (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="wr-copiloto-list-card__row-inner wr-copiloto-list-card__row-inner--link wr-copiloto-list-card__row-inner--feed"
                            >
                              {rowInner}
                            </a>
                          ) : (
                            <div className="wr-copiloto-list-card__row-inner wr-copiloto-list-card__row-inner--feed">
                              {rowInner}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {topPosts.length > FEED_PREVIEW ? (
                    <button
                      type="button"
                      className="wr-copiloto-list-card__more"
                      onClick={() => setFeedExpanded((v) => !v)}
                    >
                      {feedExpanded ? (
                        'Ver menos'
                      ) : (
                        <>
                          Ver mais publicações
                          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          <div className="wr-copiloto-redes__temas-anuncios">
            <section
              className="wr-copiloto-redes__band wr-copiloto-redes__band--temas wr-copiloto-reveal__card"
              style={{ ['--wr-reveal-i' as string]: 2 }}
              aria-label="Desempenho por tema"
            >
              <div className="wr-copiloto-redes__group-th wr-copiloto-redes__group-th--temas wr-copiloto-redes__group-th--split">
                <span className="wr-copiloto-redes__group-th-title">Desempenho por tema</span>
                <label className="wr-copiloto-redes__sort">
                  <span className="sr-only">Ordenar temas por</span>
                  <select
                    className="wr-copiloto-redes__sort-select"
                    value={themeSort}
                    onChange={(e) => setThemeSort(e.target.value as ThemeSortKey)}
                  >
                    <option value="engagement">Engajamento</option>
                    <option value="views">Views</option>
                  </select>
                </label>
              </div>
              <div className="wr-copiloto-redes__band-body">
                {themeRows.length === 0 ? (
                  <p className="wr-copiloto-redes__empty">
                    Sem temas classificados nos últimos {periodLabel}.
                  </p>
                ) : (
                  <div className="wr-copiloto-list-card wr-copiloto-list-card--dense">
                    <ol className="wr-copiloto-list-card__list" aria-label="Ranking de temas">
                      {themeRowsVisible.map(({ theme, stats }, index) => {
                        const rank = index + 1
                        const metricValue =
                          themeSort === 'views' ? stats.views : stats.engagement
                        const barPct = Math.round((metricValue / themeMetricMax) * 100)
                        const rankLabel = String(rank).padStart(2, '0')
                        return (
                          <li key={theme} className="wr-copiloto-list-card__row">
                            <button
                              type="button"
                              className="wr-copiloto-list-card__row-inner wr-copiloto-list-card__row-inner--btn"
                              title="Ver top postagem deste tema"
                              onClick={() => setTopPostModalTheme(theme)}
                            >
                              <span className="wr-copiloto-list-card__rank tabular-nums">
                                {rankLabel}
                              </span>
                              <ThemeRankTrophy rank={rank} />
                              <span className="wr-copiloto-list-card__main">
                                <span className="wr-copiloto-list-card__title" title={theme}>
                                  {theme}
                                </span>
                                <span className="wr-copiloto-list-card__sub">
                                  {stats.posts} post{stats.posts === 1 ? '' : 's'}
                                  {' · '}
                                  {formatWarRoomNumber(stats.views)} views
                                </span>
                              </span>
                              <span className="wr-copiloto-list-card__metrics">
                                <span className="wr-copiloto-list-card__metric-primary tabular-nums">
                                  {formatWarRoomNumber(stats.engagement)}
                                </span>
                                <span
                                  className="wr-copiloto-list-card__bar"
                                  role="presentation"
                                  aria-hidden
                                >
                                  <span
                                    className="wr-copiloto-list-card__bar-fill"
                                    style={{ width: `${barPct}%` }}
                                  />
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ol>
                    {themeRows.length > THEMES_PREVIEW ? (
                      <button
                        type="button"
                        className="wr-copiloto-list-card__more"
                        onClick={() => setThemesExpanded((v) => !v)}
                      >
                        {themesExpanded
                          ? 'Ver menos'
                          : `Ver todos os temas →`}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            <section
              className="wr-copiloto-redes__band wr-copiloto-redes__band--anuncios wr-copiloto-reveal__card"
              style={{ ['--wr-reveal-i' as string]: 3 }}
              aria-label="Anúncios ativos Jadyel Alencar"
            >
              <div className="wr-copiloto-redes__group-th wr-copiloto-redes__group-th--anuncios wr-copiloto-redes__group-th--split">
                <span className="wr-copiloto-redes__group-th-title">
                  Anúncios ativos · Jadyel Alencar
                </span>
              </div>
              <div className="wr-copiloto-redes__band-body">
                <WarRoomCopilotoJadyelAnuncios />
              </div>
            </section>
          </div>
        </div>

        <section className="wr-copiloto-redes__side" aria-label="Indicadores">
          <div
            className="wr-copiloto-redes__band wr-copiloto-redes__band--indicadores wr-copiloto-reveal__card"
            style={{ ['--wr-reveal-i' as string]: 4 }}
          >
            <div className="wr-copiloto-redes__group-th wr-copiloto-redes__group-th--indicadores">
              Indicadores
            </div>
            <div className="wr-copiloto-redes__side-body">
              <WarRoomCopilotoRedesDesempenho kpis={desempenhoKpis} compact />
            </div>
          </div>
        </section>
      </div>

      {topPostModalTheme && typeof document !== 'undefined'
        ? createPortal(
            <div className="wr-visita-modal" role="presentation">
              <button
                type="button"
                className="wr-visita-modal__backdrop"
                aria-label="Fechar"
                onClick={() => setTopPostModalTheme(null)}
              />
              <div
                className="wr-visita-modal__panel wr-copiloto-redes__top-post-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={topPostModalTitleId}
              >
                <header className="wr-visita-modal__head">
                  <div className="wr-visita-modal__head-main min-w-0">
                    <p className="wr-visita-modal__eyebrow">Top postagem por tema</p>
                    <h2 id={topPostModalTitleId} className="wr-visita-modal__title truncate">
                      {topPostModalTheme}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="wr-visita-modal__close"
                    aria-label="Fechar"
                    onClick={() => setTopPostModalTheme(null)}
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </button>
                </header>

                {topPostModal ? (
                  <div className="wr-copiloto-redes__top-post-body">
                    <p className="wr-copiloto-redes__top-post-header" title={topPostModal.header}>
                      {topPostModal.header}
                    </p>
                    <dl className="wr-copiloto-redes__top-post-meta">
                      <div>
                        <dt>Engajamento</dt>
                        <dd className="tabular-nums">
                          {formatWarRoomNumber(topPostModal.engagement)}
                        </dd>
                      </div>
                      <div>
                        <dt>Período</dt>
                        <dd>Últimos {periodLabel}</dd>
                      </div>
                    </dl>
                    {topPostModal.url ? (
                      <a
                        href={topPostModal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wr-copiloto-redes__top-post-link"
                      >
                        Abrir no Instagram
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <p className="wr-visita-modal__state">
                    Sem top postagem classificada para este tema.
                  </p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
