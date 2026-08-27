'use client'

import { Instagram, Loader2, RefreshCw, X } from 'lucide-react'
import '@/app/dashboard/war-room/radar-competitivo-ios.css'
import '@/app/dashboard/war-room/war-room-redes-hud.css'
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
  type InstagramProfileVisitManual,
} from '@/lib/instagram-profile-visits-manual'
import { WarRoomRedesHud } from '@/components/war-room/war-room-redes-hud'
import { WarRoomRedesVisitasManualForm } from '@/components/war-room/war-room-redes-visitas-manual'
import { computeThemeComparison } from '@/lib/instagram-theme-comparison'
import { instagramCaptionHeader } from '@/lib/instagram-caption-municipio'
import {
  buildWarRoomRedesDesempenhoKpis,
  buildWarRoomRedesTopPosts,
  copilotoRedesApiTimeRange,
  copilotoRedesDays,
  COPILOTO_REDES_PERIOD_OPTIONS,
  formatDataCurta,
  getInstagramPostIdentifier,
  listDayKeys,
  type CopilotoRedesPeriod,
} from '@/lib/war-room/redes-copiloto'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import { cn } from '@/lib/utils'

type PostClassification = {
  theme?: string
  isBoosted?: boolean
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

function igHandle(username: string | null | undefined): string | null {
  if (!username) return null
  const u = username.replace(/^@/, '').trim()
  return u ? `@${u}` : null
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [visitasManualOpen, setVisitasManualOpen] = useState(false)
  const topPostModalTitleId = useId()
  const visitasManualModalTitleId = useId()

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
      if (!cfg.configured) {
        cfg = await loadInstagramConfigAsync()
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

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!topPostModalTheme && !visitasManualOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTopPostModalTheme(null)
        setVisitasManualOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [topPostModalTheme, visitasManualOpen])

  const topPosts = useMemo(
    () => buildWarRoomRedesTopPosts(metrics?.posts ?? [], days),
    [metrics, days],
  )

  const postsInPeriod = useMemo(() => {
    const ids = new Set(topPosts.map((p) => p.id))
    return (metrics?.posts ?? []).filter((p) => ids.has(getInstagramPostIdentifier(p)))
  }, [metrics, topPosts])

  const profileHandle = igHandle(metrics?.username)

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
        if (b.engagement !== a.engagement) return b.engagement - a.engagement
        return b.views - a.views
      })
      .map(([theme, stats]) => ({
        theme,
        stats,
        isLeader: comparison.overallLeader === theme,
      }))
  }, [themeStats])

  const themeMetricMax = useMemo(() => {
    if (themeRows.length === 0) return 1
    return Math.max(1, ...themeRows.map((row) => row.stats.engagement))
  }, [themeRows])

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

  const visitDayKeys = useMemo(() => listDayKeys(days), [days])

  const formatVisitDayLabel = useCallback(
    (dateKey: string) => formatDataCurta(`${dateKey}T12:00:00`),
    [],
  )

  const handleManualVisitsSaved = useCallback((rows: InstagramProfileVisitManual[]) => {
    setManualVisitsByDate((prev) => {
      const next = { ...prev }
      for (const row of rows) {
        next[row.date] = row.visits
      }
      return next
    })
  }, [])

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
    <div className="wr-copiloto-redes wr-copiloto-redes--page wr-copiloto-reveal rc-ios rc-ios--game wr-redes-game">
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
            }}
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

      <WarRoomRedesHud
        days={days}
        periodLabel={periodLabel}
        handle={profileHandle}
        postsInPeriod={postsInPeriod.map((post) => ({
          id: getInstagramPostIdentifier(post),
          type: post.type,
          metrics: post.metrics,
        }))}
        topPosts={topPosts}
        themeRows={themeRows}
        themeMetricMax={themeMetricMax}
        kpis={desempenhoKpis}
        onThemeClick={setTopPostModalTheme}
        onVisitsDoubleClick={() => setVisitasManualOpen(true)}
      />

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

      {visitasManualOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="wr-visita-modal" role="presentation">
              <button
                type="button"
                className="wr-visita-modal__backdrop"
                aria-label="Fechar"
                onClick={() => setVisitasManualOpen(false)}
              />
              <div
                className="wr-visita-modal__panel wr-copiloto-redes__visitas-manual-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={visitasManualModalTitleId}
              >
                <header className="wr-visita-modal__head">
                  <div className="wr-visita-modal__head-main min-w-0">
                    <p className="wr-visita-modal__eyebrow">Meta Insights · Instagram</p>
                    <h2 id={visitasManualModalTitleId} className="wr-visita-modal__title">
                      Visitas ao perfil
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="wr-visita-modal__close"
                    aria-label="Fechar"
                    onClick={() => setVisitasManualOpen(false)}
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </button>
                </header>

                <div className="wr-copiloto-redes__visitas-manual-body">
                  <p className="wr-copiloto-redes__visitas-manual-hint">
                    Informe um valor por dia (últimos {periodLabel}). Os indicadores atualizam ao
                    salvar.
                  </p>
                  <WarRoomRedesVisitasManualForm
                    embedded
                    dates={visitDayKeys}
                    initialByDate={manualVisitsByDate}
                    formatDateLabel={formatVisitDayLabel}
                    onSaved={handleManualVisitsSaved}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
