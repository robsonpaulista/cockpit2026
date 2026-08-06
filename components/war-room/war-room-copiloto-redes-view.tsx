'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import {
  IconHeart,
  IconLoader2,
  IconRefresh,
  IconTrophy,
  IconX,
} from '@tabler/icons-react'
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
import { WarRoomCopilotoRedesDesempenho } from '@/components/war-room/war-room-copiloto-redes-desempenho'
import {
  COMPARISON_METRICS,
  formatMetricValue,
} from '@/lib/instagram-metric-comparison'
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

const CANDIDATOS_ENGAJAMENTO_TOP_N = 5
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

const POSTS_VISIBLE = 8
const THEMES_PAGE_SIZE = 5

const THEME_METRICS = COMPARISON_METRICS.filter(
  (metric) =>
    metric.key !== 'avgSaves' &&
    metric.key !== 'avgLikes' &&
    metric.key !== 'avgComments' &&
    metric.key !== 'avgShares',
)

const THEME_METRIC_SHORT: Partial<Record<(typeof COMPARISON_METRICS)[number]['key'], string>> = {
  avgViews: 'Views',
  avgEngagement: 'Eng.',
}

function engajamentoHint(stats: {
  avgLikes: number
  avgComments: number
  avgShares: number
}): string {
  return [
    `Curt. ${formatMetricValue('avgLikes', stats.avgLikes)}`,
    `Com. ${formatMetricValue('avgComments', stats.avgComments)}`,
    `Comp. ${formatMetricValue('avgShares', stats.avgShares)}`,
  ].join(' · ')
}

function ThemeRankTrophy({ rank }: { rank: number }) {
  if (rank < 1 || rank > 3) return null
  const lugarClass =
    rank === 1
      ? 'wr-expectativa-ranking-modal__pesquisa-trophy--ouro'
      : rank === 2
        ? 'wr-expectativa-ranking-modal__pesquisa-trophy--prata'
        : 'wr-expectativa-ranking-modal__pesquisa-trophy--bronze'
  return (
    <span
      className="wr-copiloto-redes__theme-rank"
      aria-label={`${rank}º lugar`}
    >
      <IconTrophy
        className={cn('wr-expectativa-ranking-modal__pesquisa-trophy', lugarClass)}
        stroke={1.75}
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
  const [themesPage, setThemesPage] = useState(0)
  const [radarActors, setRadarActors] = useState<PoliticalActorWithTerms[]>([])
  const [radarPosts, setRadarPosts] = useState<InstagramRadarPostWithActor[]>([])
  const [radarLoading, setRadarLoading] = useState(true)
  const [radarError, setRadarError] = useState<string | null>(null)
  const topPostModalTitleId = useId()
  const candidatosBandRef = useRef<HTMLElement | null>(null)
  const colsRef = useRef<HTMLDivElement | null>(null)

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
        topN: CANDIDATOS_ENGAJAMENTO_TOP_N,
      }),
    [radarActors, radarPosts, days],
  )

  const postsHoje = useMemo(
    () => topPosts.filter((p) => p.isToday).slice(0, POSTS_VISIBLE),
    [topPosts],
  )

  const postsInPeriod = useMemo(() => {
    const ids = new Set(topPosts.map((p) => p.id))
    return (metrics?.posts ?? []).filter((p) => ids.has(getInstagramPostIdentifier(p)))
  }, [metrics, topPosts])

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
      .sort(([keyA, a], [keyB, b]) => {
        const winsA = comparison.highlightsByKey[keyA]?.length ?? 0
        const winsB = comparison.highlightsByKey[keyB]?.length ?? 0
        if (winsB !== winsA) return winsB - winsA
        return b.avgEngagement - a.avgEngagement
      })
      .map(([theme, stats]) => ({
        theme,
        stats,
        isLeader: comparison.overallLeader === theme,
      }))
  }, [themeStats])

  const themesPageCount = Math.max(1, Math.ceil(themeRows.length / THEMES_PAGE_SIZE))
  const themesPageSafe = Math.min(themesPage, themesPageCount - 1)
  const themeRowsPage = useMemo(
    () =>
      themeRows.slice(
        themesPageSafe * THEMES_PAGE_SIZE,
        themesPageSafe * THEMES_PAGE_SIZE + THEMES_PAGE_SIZE,
      ),
    [themeRows, themesPageSafe],
  )

  useEffect(() => {
    setThemesPage(0)
  }, [period, themeRows.length])

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

  /** Limita a base do Comparativo exatamente na borda inferior do card Seguidores. */
  useLayoutEffect(() => {
    const band = candidatosBandRef.current
    const cols = colsRef.current
    if (!band || !cols) return

    const syncBottomToSeguidores = () => {
      const seguidores = cols.querySelector<HTMLElement>('[data-wr-kpi="followers"]')
      if (!seguidores) {
        band.style.maxHeight = ''
        return
      }
      const bandTop = band.getBoundingClientRect().top
      const seguidoresBottom = seguidores.getBoundingClientRect().bottom
      const maxHeight = Math.floor(seguidoresBottom - bandTop)
      if (maxHeight > 0) {
        band.style.maxHeight = `${maxHeight}px`
      } else {
        band.style.maxHeight = ''
      }
    }

    syncBottomToSeguidores()
    const raf = window.requestAnimationFrame(syncBottomToSeguidores)
    const observer = new ResizeObserver(() => {
      syncBottomToSeguidores()
    })
    observer.observe(cols)
    observer.observe(band)
    const seguidores = cols.querySelector('[data-wr-kpi="followers"]')
    if (seguidores) observer.observe(seguidores)
    window.addEventListener('resize', syncBottomToSeguidores)

    return () => {
      window.cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', syncBottomToSeguidores)
      band.style.maxHeight = ''
    }
  }, [desempenhoKpis, candidatosEngajamento, themesPage, loading, radarLoading])

  if (loading && !metrics) {
    return (
      <div className="wr-copiloto-view__state">
        <IconLoader2 className="h-5 w-5 animate-spin text-[var(--wr-accent,#F04B23)]" />
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
    <div className="wr-copiloto-redes wr-copiloto-redes--page">
      <header className="wr-copiloto-redes__toolbar">
        <h2 className="wr-copiloto-redes__title">Redes Sociais</h2>
        <div className="wr-copiloto-redes__period" role="group" aria-label="Período">
          {COPILOTO_REDES_PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                'wr-copiloto-redes__period-btn',
                period === opt.value && 'wr-copiloto-redes__period-btn--active',
              )}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Link href="/dashboard/conteudo/redes" className="wr-copiloto-redes__section-link">
          Abrir Instagram
        </Link>
        <button
          type="button"
          className="wr-copiloto-redes__refresh"
          onClick={() => {
            void load()
            void loadRadarCandidatos()
          }}
          disabled={loading || radarLoading}
        >
          <IconRefresh
            className={cn('h-4 w-4', (loading || radarLoading) && 'animate-spin')}
            stroke={1.75}
            aria-hidden
          />
          Atualizar
        </button>
      </header>

      <div
        ref={colsRef}
        className="wr-copiloto-redes__cols wr-copiloto-redes__cols--split"
      >
        <div className="wr-copiloto-redes__main">
          <section className="wr-copiloto-redes__band" aria-label="Análise Feed">
            <div className="wr-copiloto-redes__group-th wr-copiloto-redes__group-th--posts">
              Análise Feed
            </div>
            <div className="wr-copiloto-redes__band-body">
              <table className="wr-copiloto-redes__table">
                <thead>
                  <tr>
                    <th className="wr-copiloto-redes__th-time">Hora</th>
                    <th>Header</th>
                    <th className="wr-copiloto-redes__num">
                      <span className="wr-copiloto-redes__eng-head">
                        Eng. <IconHeart className="h-3 w-3" stroke={1.75} aria-hidden />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="wr-copiloto-redes__section-row">
                    <td colSpan={3}>Hoje</td>
                  </tr>
                  {postsHoje.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="wr-copiloto-redes__empty-cell">
                        Nenhuma postagem hoje.
                      </td>
                    </tr>
                  ) : (
                    postsHoje.map((post) => (
                      <tr key={post.id}>
                        <td className="wr-copiloto-redes__th-time tabular-nums">{post.dateLabel}</td>
                        <td className="wr-copiloto-redes__cell-truncate" title={post.header}>
                          {post.header}
                        </td>
                        <td className="wr-copiloto-redes__num tabular-nums">
                          {formatWarRoomNumber(post.engagement)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>{postsHoje.length} hoje</td>
                    <td className="wr-copiloto-redes__num">{topPosts.length} no período</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="wr-copiloto-redes__band" aria-label="Desempenho por tema">
            <div className="wr-copiloto-redes__group-th wr-copiloto-redes__group-th--temas">
              Desempenho por tema
            </div>
            <div className="wr-copiloto-redes__band-body">
              {themeRows.length === 0 ? (
                <p className="wr-copiloto-redes__empty">
                  Sem temas classificados nos últimos {periodLabel}.
                </p>
              ) : (
                <div className="wr-copiloto-redes__themes-panel">
                  <div className="wr-copiloto-redes__table-scroll">
                    <table className="wr-copiloto-redes__table">
                      <thead>
                        <tr>
                          <th>Tema</th>
                          <th className="wr-copiloto-redes__num">Posts</th>
                          {THEME_METRICS.map((metric) => (
                            <th key={metric.key} className="wr-copiloto-redes__num">
                              {THEME_METRIC_SHORT[metric.key]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {themeRowsPage.map(({ theme, stats }, pageIndex) => {
                          const rank = themesPageSafe * THEMES_PAGE_SIZE + pageIndex + 1
                          const hasTopPost = bestPostByTheme.has(theme)
                          return (
                            <tr key={theme}>
                              <td
                                className="wr-copiloto-redes__cell-tema"
                                title={theme}
                              >
                                <ThemeRankTrophy rank={rank} />
                                <span className="wr-copiloto-redes__cell-truncate">{theme}</span>
                              </td>
                              <td className="wr-copiloto-redes__num">
                                {hasTopPost ? (
                                  <button
                                    type="button"
                                    className="wr-copiloto-redes__posts-btn tabular-nums"
                                    title="Ver top postagem deste tema"
                                    onClick={() => setTopPostModalTheme(theme)}
                                  >
                                    {stats.posts}
                                  </button>
                                ) : (
                                  <span className="tabular-nums">{stats.posts}</span>
                                )}
                              </td>
                              {THEME_METRICS.map((metric) => (
                                <td
                                  key={metric.key}
                                  className="wr-copiloto-redes__num tabular-nums"
                                  title={
                                    metric.key === 'avgEngagement'
                                      ? engajamentoHint(stats)
                                      : undefined
                                  }
                                >
                                  {formatMetricValue(metric.key, stats[metric.key])}
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {themesPageCount > 1 ? (
                    <div className="wr-copiloto-redes__pager" role="navigation" aria-label="Páginas de temas">
                      <button
                        type="button"
                        className="wr-copiloto-redes__pager-btn"
                        disabled={themesPageSafe <= 0}
                        onClick={() => setThemesPage((p) => Math.max(0, p - 1))}
                      >
                        Anterior
                      </button>
                      <span className="wr-copiloto-redes__pager-status tabular-nums">
                        {themesPageSafe + 1} / {themesPageCount}
                        <span className="wr-copiloto-redes__pager-count">
                          · {themeRows.length} temas
                        </span>
                      </span>
                      <button
                        type="button"
                        className="wr-copiloto-redes__pager-btn"
                        disabled={themesPageSafe >= themesPageCount - 1}
                        onClick={() =>
                          setThemesPage((p) => Math.min(themesPageCount - 1, p + 1))
                        }
                      >
                        Próxima
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          <section
            ref={candidatosBandRef}
            className="wr-copiloto-redes__band wr-copiloto-redes__band--candidatos"
            aria-label="Comparativo candidatos engajamento diário"
          >
            <div className="wr-copiloto-redes__group-th wr-copiloto-redes__group-th--candidatos">
              Comparativo candidatos · engajamento diário · últimos {periodLabel}
            </div>
            <div className="wr-copiloto-redes__band-body">
              {radarLoading && candidatosEngajamento.empty ? (
                <p className="wr-copiloto-redes__empty wr-copiloto-redes__empty--inline">
                  <IconLoader2
                    className="h-4 w-4 animate-spin text-[var(--wr-accent,#F04B23)]"
                    aria-hidden
                  />
                  Carregando top {CANDIDATOS_ENGAJAMENTO_TOP_N} candidatos…
                </p>
              ) : radarError ? (
                <p className="wr-copiloto-redes__empty">{radarError}</p>
              ) : (
                <WarRoomCopilotoCandidatosEngajamentoChart model={candidatosEngajamento} />
              )}
            </div>
          </section>
        </div>

        <section className="wr-copiloto-redes__side" aria-label="Indicadores">
          <div className="wr-copiloto-redes__group-th wr-copiloto-redes__group-th--indicadores">
            Indicadores
          </div>
          <div className="wr-copiloto-redes__side-body">
            <WarRoomCopilotoRedesDesempenho kpis={desempenhoKpis} compact />
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
                    <IconX className="h-4 w-4" stroke={1.75} aria-hidden />
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
