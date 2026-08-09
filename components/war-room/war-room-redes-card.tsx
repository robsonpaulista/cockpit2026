'use client'

import { ChevronRight, Heart, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  fetchInstagramData,
  fetchInstagramHistory,
  loadInstagramConfig,
  loadInstagramConfigAsync,
  type InstagramHistoryResponse,
  type InstagramMetrics,
} from '@/lib/instagramApi'
import { instagramCaptionHeader } from '@/lib/instagram-caption-municipio'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomViewMode } from '@/components/war-room/war-room-view-mode-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import {
  WarRoomPostagensDiaModal,
  type WarRoomPostagemDiaItem,
} from '@/components/war-room/war-room-postagens-dia-modal'
import {
  WarRoomRedesDesempenhoView,
  type WarRoomDesempenhoKpi,
} from '@/components/war-room/war-room-redes-desempenho-view'
import { WarRoomRedesVisitasManualForm } from '@/components/war-room/war-room-redes-visitas-manual'
import {
  fetchInstagramProfileVisitsManual,
  type InstagramProfileVisitManual,
} from '@/lib/instagram-profile-visits-manual'
import { cn } from '@/lib/utils'

const WAR_ROOM_TZ = 'America/Sao_Paulo'
const LOOKBACK_DAYS = 7
const POSTS_VISIBLE = 5
const THEMES_VISIBLE = 6

type FiltroId = 'postagens' | 'temas' | 'desempenho'

const FILTRO_OPCOES: Array<{ id: FiltroId; label: string }> = [
  { id: 'postagens', label: 'Postagens' },
  { id: 'temas', label: 'Temas' },
  { id: 'desempenho', label: 'Desempenho' },
]

type PostClassification = {
  theme?: string
  isBoosted?: boolean
}

type TopPost = {
  id: string
  dateLabel: string
  header: string
  engagement: number
  isToday: boolean
  dayKey: string
}

type ThemeRow = {
  label: string
  engagement: number
  posts: number
  avgEngagement: number
}

type Props = {
  className?: string
}

function calendarDateInTz(iso: string | Date, timeZone: string = WAR_ROOM_TZ): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function todayKeyInTz(timeZone: string = WAR_ROOM_TZ): string {
  return calendarDateInTz(new Date(), timeZone)
}

function formatDataCurta(iso: string, timeZone: string = WAR_ROOM_TZ): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
  }).format(d)
}

function formatPostTime(iso: string, timeZone: string = WAR_ROOM_TZ): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function cutoffKeyDaysAgo(days: number, timeZone: string = WAR_ROOM_TZ): string {
  const now = new Date()
  const cutoff = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
  return calendarDateInTz(cutoff, timeZone)
}

/** Lista YYYY-MM-DD dos últimos `days` dias (hoje incluso), ordem crescente. */
function listDayKeys(days: number, timeZone: string = WAR_ROOM_TZ): string[] {
  const today = todayKeyInTz(timeZone)
  const [y, m, d] = today.split('-').map((p) => Number.parseInt(p, 10))
  if (!y || !m || !d) return []
  const base = new Date(Date.UTC(y, m - 1, d))
  const out: string[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const dt = new Date(base)
    dt.setUTCDate(base.getUTCDate() - i)
    out.push(dt.toISOString().slice(0, 10))
  }
  return out
}

function getPostIdentifier(post: { id: string; postedAt?: string; caption?: string }): string {
  if (post.id) return post.id
  if (post.postedAt && post.caption) {
    const dateStr = new Date(post.postedAt).toISOString().split('T')[0]
    const captionHash = post.caption.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    return `${dateStr}_${captionHash}`
  }
  return `post_${Date.now()}`
}

function audiencePct(part: number, total: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null
  return (part / total) * 100
}

/** Redes sociais — postagens top engajamento e desempenho por tema (últimos 7 dias). */
export function WarRoomRedesCard({ className }: Props) {
  const { register, reportChange } = useWarRoomRefresh()
  const change = useWarRoomCardChange('redes')
  const { isDesempenho, setViewMode } = useWarRoomViewMode()
  const [localFiltro, setLocalFiltro] = useState<FiltroId>('postagens')
  const filtro: FiltroId = isDesempenho ? 'desempenho' : localFiltro
  const [metrics, setMetrics] = useState<InstagramMetrics | null>(null)
  const [history, setHistory] = useState<InstagramHistoryResponse | null>(null)
  const [manualVisitsByDate, setManualVisitsByDate] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(false)
  const [classifications, setClassifications] = useState<Record<string, PostClassification>>({})
  const [postagensModalAberto, setPostagensModalAberto] = useState(false)

  const selectFiltro = useCallback(
    (id: FiltroId) => {
      if (id === 'desempenho') {
        setViewMode('desempenho')
        return
      }
      setViewMode('padrao')
      setLocalFiltro(id)
    },
    [setViewMode],
  )

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
      // fallback localStorage
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

  const loadInstagram = useCallback(async (opts?: {
    silent?: boolean
    forceRefresh?: boolean
  }) => {
    const silent = opts?.silent === true
    const forceRefresh = opts?.forceRefresh === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      let cfg = loadInstagramConfig()
      if (!cfg.token || !cfg.businessAccountId) {
        cfg = await loadInstagramConfigAsync()
      }
      if (!cfg.token || !cfg.businessAccountId) {
        setConfigured(false)
        if (!silent) {
          setMetrics(null)
          setHistory(null)
          setManualVisitsByDate({})
          setError('Instagram Pessoal não configurado')
        }
        return
      }
      setConfigured(true)
      const [data, hist, visitsManual] = await Promise.all([
        fetchInstagramData(cfg.token, cfg.businessAccountId, '7d', forceRefresh),
        fetchInstagramHistory(LOOKBACK_DAYS),
        fetchInstagramProfileVisitsManual(LOOKBACK_DAYS),
      ])
      if (!data) {
        if (!silent) {
          setError('Não foi possível carregar o Instagram')
          setMetrics(null)
        }
        return
      }
      setMetrics(data)
      setHistory(hist)
      setManualVisitsByDate(visitsManual.byDate)
      await loadClassifications()
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar Instagram')
        setMetrics(null)
        setHistory(null)
        setManualVisitsByDate({})
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInstagram({ silent: false })
  }, [loadInstagram])

  useEffect(() => {
    return register('redes', async ({ silent }) => {
      await loadInstagram({ silent, forceRefresh: false })
    })
  }, [register, loadInstagram])

  const postsInWindow = useMemo(() => {
    const cutoff = cutoffKeyDaysAgo(LOOKBACK_DAYS)
    return [...(metrics?.posts ?? [])].filter((post) => {
      const day = calendarDateInTz(post.postedAt)
      return day !== '' && day >= cutoff
    })
  }, [metrics])

  const topPosts = useMemo((): TopPost[] => {
    const today = todayKeyInTz()
    return postsInWindow
      .map((post) => {
        const dayKey = calendarDateInTz(post.postedAt)
        const isToday = dayKey === today
        return {
          id: getPostIdentifier(post),
          dateLabel: isToday ? formatPostTime(post.postedAt) || 'Hoje' : formatDataCurta(post.postedAt),
          header: instagramCaptionHeader(post.caption) || 'Sem cabeçalho',
          engagement: post.metrics.engagement || 0,
          isToday,
          dayKey,
        }
      })
      .sort((a, b) => {
        if (a.isToday !== b.isToday) return a.isToday ? -1 : 1
        return b.engagement - a.engagement
      })
  }, [postsInWindow])

  const postsHoje = useMemo(
    () => topPosts.filter((p) => p.isToday).slice(0, POSTS_VISIBLE),
    [topPosts],
  )

  const postsAnteriores = useMemo(
    () => topPosts.filter((p) => !p.isToday).slice(0, POSTS_VISIBLE),
    [topPosts],
  )

  const themeRows = useMemo((): ThemeRow[] => {
    const byTheme = new Map<string, { engagement: number; posts: number }>()
    for (const post of postsInWindow) {
      const id = getPostIdentifier(post)
      const theme = classifications[id]?.theme?.trim() || 'Sem tema'
      const prev = byTheme.get(theme) ?? { engagement: 0, posts: 0 }
      byTheme.set(theme, {
        engagement: prev.engagement + (post.metrics.engagement || 0),
        posts: prev.posts + 1,
      })
    }
    return [...byTheme.entries()]
      .map(([label, data]) => ({
        label,
        engagement: data.engagement,
        posts: data.posts,
        avgEngagement:
          data.posts > 0 ? Math.round(data.engagement / data.posts) : 0,
      }))
      .sort(
        (a, b) =>
          b.avgEngagement - a.avgEngagement ||
          b.engagement - a.engagement ||
          a.label.localeCompare(b.label, 'pt-BR'),
      )
      .slice(0, THEMES_VISIBLE)
  }, [postsInWindow, classifications])

  const todayPosts = useMemo(() => {
    const today = todayKeyInTz()
    return postsInWindow.filter((post) => calendarDateInTz(post.postedAt) === today)
  }, [postsInWindow])

  const postagensDia = useMemo((): WarRoomPostagemDiaItem[] => {
    return [...todayPosts]
      .map((post) => {
        const id = getPostIdentifier(post)
        return {
          id,
          header: instagramCaptionHeader(post.caption) || 'Sem cabeçalho na legenda',
          theme: classifications[id]?.theme?.trim() || 'Sem tema',
          timeLabel: formatPostTime(post.postedAt),
          views: post.metrics.views || 0,
          engagement: post.metrics.engagement || 0,
          likes: post.metrics.likes || 0,
          comments: post.metrics.comments || 0,
          shares: post.metrics.shares || 0,
          saves: post.metrics.saves || 0,
        }
      })
      .sort((a, b) => b.engagement - a.engagement)
  }, [todayPosts, classifications])

  const audienceSplit = metrics?.insights?.audienceSplit ?? null

  const desempenhoKpis = useMemo((): WarRoomDesempenhoKpi[] => {
    const rows = [...(history?.history ?? [])].sort((a, b) =>
      a.snapshot_date.localeCompare(b.snapshot_date),
    )
    const seriesOf = (pick: (row: (typeof rows)[number]) => number) =>
      rows.map((row) => ({
        date: row.snapshot_date,
        label: formatDataCurta(`${row.snapshot_date}T12:00:00`),
        value: pick(row),
      }))

    const deltaOf = (series: Array<{ value: number }>): number | null => {
      if (series.length < 2) return null
      const first = series[0]?.value ?? 0
      const last = series[series.length - 1]?.value ?? 0
      if (first === 0) return last === 0 ? 0 : null
      return ((last - first) / Math.abs(first)) * 100
    }

    const first = rows[0]
    const last = rows[rows.length - 1]
    const viewsSeries = seriesOf((r) => r.impressions || 0)
    const reachSeries = seriesOf((r) => r.reach || 0)
    const interactionsSeries = seriesOf((r) => r.total_interactions || 0)
    const historyViewsByDate = new Map(
      rows.map((r) => [r.snapshot_date, r.profile_views || 0] as const),
    )
    const dayKeys = listDayKeys(LOOKBACK_DAYS)
    // Visitas: prioriza lançamento manual (API Meta não entrega mais profile_views).
    const visitsSeries = dayKeys.map((date) => ({
      date,
      label: formatDataCurta(`${date}T12:00:00`),
      value: manualVisitsByDate[date] ?? historyViewsByDate.get(date) ?? 0,
    }))
    const visitsTotal = visitsSeries.reduce((sum, p) => sum + p.value, 0)
    // Ganho líquido diário (estilo Meta Desempenho), não o estoque total.
    const followersSeries = rows.map((row, i) => {
      const prev = i > 0 ? rows[i - 1]?.followers_count || 0 : row.followers_count || 0
      const curr = row.followers_count || 0
      return {
        date: row.snapshot_date,
        label: formatDataCurta(`${row.snapshot_date}T12:00:00`),
        value: i === 0 ? 0 : curr - prev,
      }
    })
    const followersNet =
      first && last ? (last.followers_count || 0) - (first.followers_count || 0) : 0
    let followersDeltaPct: number | null = null
    if (rows.length >= 4 && first && last) {
      const mid = Math.floor(rows.length / 2)
      const midRow = rows[mid]
      const midPrev = rows[mid - 1]
      if (midRow && midPrev) {
        const firstHalf = (midPrev.followers_count || 0) - (first.followers_count || 0)
        const secondHalf = (last.followers_count || 0) - (midRow.followers_count || 0)
        if (firstHalf !== 0) {
          followersDeltaPct = ((secondHalf - firstHalf) / Math.abs(firstHalf)) * 100
        } else if (secondHalf !== 0) {
          followersDeltaPct = null
        } else {
          followersDeltaPct = 0
        }
      }
    }

    const viewsTotal =
      audienceSplit?.views?.total ||
      metrics?.insights?.totalViews ||
      last?.impressions ||
      0
    const reachTotal =
      audienceSplit?.reach?.total ||
      metrics?.insights?.totalReach ||
      last?.reach ||
      0

    const viewsFollowersPct = audiencePct(
      audienceSplit?.views?.followers ?? 0,
      audienceSplit?.views?.total ?? 0,
    )
    const viewsNonPct = audiencePct(
      audienceSplit?.views?.nonFollowers ?? 0,
      audienceSplit?.views?.total ?? 0,
    )
    const reachFollowersPct = audiencePct(
      audienceSplit?.reach?.followers ?? 0,
      audienceSplit?.reach?.total ?? 0,
    )
    const reachNonPct = audiencePct(
      audienceSplit?.reach?.nonFollowers ?? 0,
      audienceSplit?.reach?.total ?? 0,
    )

    return [
      {
        id: 'views',
        label: 'Visualizações',
        total: viewsTotal,
        deltaPct: deltaOf(viewsSeries),
        series: viewsSeries,
        followersPct: viewsFollowersPct,
        nonFollowersPct: viewsNonPct,
        legend: 'Conteúdo Instagram',
      },
      {
        id: 'reach',
        label: 'Alcance',
        total: reachTotal,
        deltaPct: deltaOf(reachSeries),
        series: reachSeries,
        followersPct: reachFollowersPct,
        nonFollowersPct: reachNonPct,
        legend: 'Contas únicas',
      },
      {
        id: 'interactions',
        label: 'Interações',
        total: metrics?.insights?.totalInteractions || last?.total_interactions || 0,
        deltaPct: deltaOf(interactionsSeries),
        series: interactionsSeries,
        legend: 'Com o conteúdo',
      },
      {
        id: 'visits',
        label: 'Visitas',
        total: visitsTotal,
        deltaPct: deltaOf(visitsSeries),
        series: visitsSeries,
        legend: 'Perfil · lançamento manual',
      },
      {
        id: 'followers',
        label: 'Seguidores',
        total: followersNet,
        deltaPct: followersDeltaPct,
        series: followersSeries,
        legend: 'Ganho líquido no período',
      },
      ...(visitsTotal > 0
        ? [
            {
              id: 'conversion',
              label: 'Visita → seguidor',
              total: (followersNet / visitsTotal) * 100,
              deltaPct: null as number | null,
              series: visitsSeries,
              valueLabel: `${((followersNet / visitsTotal) * 100).toLocaleString('pt-BR', {
                maximumFractionDigits: 1,
                minimumFractionDigits: 0,
              })}%`,
              legend: 'Ganho de seguidores ÷ visitas',
            } satisfies WarRoomDesempenhoKpi,
          ]
        : []),
    ].filter((kpi) => kpi.id === 'conversion' || kpi.total !== 0 || kpi.series.some((p) => p.value !== 0))
  }, [history, metrics, audienceSplit, manualVisitsByDate])

  const snapshotLines = useMemo(() => {
    if (!metrics) return null
    return [
      ...desempenhoKpis.map(
        (k) =>
          `desempenho\t${k.id}\t${k.total}\t${k.deltaPct ?? ''}\t${k.followersPct ?? ''}`,
      ),
      ...postsHoje.map((p) => `hoje\t${p.id}\t${p.engagement}\t${p.header}`),
      ...postsAnteriores.map((p) => `post\t${p.id}\t${p.engagement}\t${p.header}`),
      ...themeRows.map((t) => `tema\t${t.label}\t${t.avgEngagement}\t${t.posts}`),
    ]
  }, [metrics, desempenhoKpis, postsHoje, postsAnteriores, themeRows])

  useWarRoomSnapshot({
    cardId: 'redes',
    lines: snapshotLines,
    noun: 'indicador',
    ready: !loading || metrics != null,
  })

  useEffect(() => {
    reportChange('redes', null)
  }, [isDesempenho, reportChange])

  const visitDayKeys = useMemo(() => listDayKeys(LOOKBACK_DAYS), [])

  const handleManualVisitsSaved = useCallback((rows: InstagramProfileVisitManual[]) => {
    setManualVisitsByDate((prev) => {
      const next = { ...prev }
      for (const row of rows) {
        next[row.date] = row.visits
      }
      return next
    })
  }, [])

  const formatVisitDayLabel = useCallback((dateKey: string) => {
    return formatDataCurta(`${dateKey}T12:00:00`)
  }, [])

  const initialLoading = loading && !metrics
  const showPostagens = filtro === 'postagens'
  const showDesempenho = filtro === 'desempenho'

  return (
    <section
      id="wr-redes"
      className={cn('wr-redes-clean', 'wr-cell--redes', className)}
      aria-label="Redes sociais"
    >
      <header className="wr-redes-clean__header wr-redes-clean__header--filtros">
        <div className="wr-redes-clean__title-row">
          <div>
            <h2 className="wr-redes-clean__heading">Redes sociais</h2>
            <p className="wr-redes-clean__sub">
              {showDesempenho
                ? `Indicadores · últimos ${LOOKBACK_DAYS} dias`
                : showPostagens
                  ? `Últimos ${LOOKBACK_DAYS} dias`
                  : `Média por post · últimos ${LOOKBACK_DAYS} dias`}
            </p>
          </div>
          {change ? (
            <WarRoomChangeBadge change={change} className="wr-redes-clean__badge" />
          ) : null}
        </div>
        <div className="wr-redes-clean__filtros" role="group" aria-label="Filtrar redes sociais">
          {FILTRO_OPCOES.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              aria-pressed={filtro === opcao.id}
              className={cn(
                'wr-redes-clean__filtro',
                filtro === opcao.id && 'wr-redes-clean__filtro--ativo',
              )}
              onClick={() => selectFiltro(opcao.id)}
            >
              {opcao.label}
            </button>
          ))}
        </div>
      </header>

      {initialLoading ? (
        <div className="wr-redes-clean__state">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          Carregando Instagram…
        </div>
      ) : !configured ? (
        <p className="wr-redes-clean__state">
          Configure o Instagram Pessoal para ver o desempenho.{' '}
          <Link href="/dashboard/conteudo/redes" className="font-medium text-[var(--wr-gold)]">
            Abrir Instagram
          </Link>
        </p>
      ) : error && topPosts.length === 0 && themeRows.length === 0 && desempenhoKpis.length === 0 ? (
        <p className="wr-redes-clean__state wr-redes-clean__state--erro">{error}</p>
      ) : showDesempenho ? (
        <div className="wr-redes-desempenho-wrap">
          <WarRoomRedesDesempenhoView kpis={desempenhoKpis} />
          <WarRoomRedesVisitasManualForm
            dates={visitDayKeys}
            initialByDate={manualVisitsByDate}
            formatDateLabel={formatVisitDayLabel}
            onSaved={handleManualVisitsSaved}
          />
        </div>
      ) : showPostagens ? (
        topPosts.length === 0 ? (
          <p className="wr-redes-clean__state">
            Nenhuma publicação nos últimos {LOOKBACK_DAYS} dias.
          </p>
        ) : (
          <div className="wr-redes-clean__groups" aria-label="Postagens por período">
            {postsHoje.length > 0 ? (
              <ul className="wr-redes-clean__list" aria-label="Postagens de hoje">
                <li className="wr-redes-clean__section" aria-hidden>
                  <span>Hoje</span>
                  <span className="wr-redes-clean__section-count">{postsHoje.length}</span>
                </li>
                <li className="wr-redes-clean__row wr-redes-clean__row--head wr-redes-clean__row--posts" aria-hidden>
                  <span>Hora</span>
                  <span>Header</span>
                  <span className="text-right">Eng.</span>
                </li>
                {postsHoje.map((post) => (
                  <li
                    key={post.id}
                    className="wr-redes-clean__row wr-redes-clean__row--posts wr-redes-clean__row--hoje"
                    title={`${post.dateLabel} · ${post.header} · ${formatWarRoomNumber(post.engagement)}`}
                  >
                    <span className="wr-redes-clean__date tabular-nums">{post.dateLabel}</span>
                    <span className="wr-redes-clean__header-text truncate">{post.header}</span>
                    <span className="wr-redes-clean__eng tabular-nums">
                      <Heart className="h-3 w-3 shrink-0 opacity-70" strokeWidth={1.5} aria-hidden />
                      {formatWarRoomNumber(post.engagement)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="wr-redes-clean__empty-hoje">Nenhuma postagem hoje.</p>
            )}

            {postsAnteriores.length > 0 ? (
              <ul className="wr-redes-clean__list" aria-label="Postagens anteriores">
                <li
                  className={cn(
                    'wr-redes-clean__section',
                    postsHoje.length > 0 && 'wr-redes-clean__section--separada',
                  )}
                  aria-hidden
                >
                  <span>Anteriores</span>
                  <span className="wr-redes-clean__section-count">
                    top {postsAnteriores.length}
                  </span>
                </li>
                {postsHoje.length === 0 ? (
                  <li className="wr-redes-clean__row wr-redes-clean__row--head wr-redes-clean__row--posts" aria-hidden>
                    <span>Data</span>
                    <span>Header</span>
                    <span className="text-right">Eng.</span>
                  </li>
                ) : null}
                {postsAnteriores.map((post) => (
                  <li
                    key={post.id}
                    className="wr-redes-clean__row wr-redes-clean__row--posts"
                    title={`${post.dateLabel} · ${post.header} · ${formatWarRoomNumber(post.engagement)}`}
                  >
                    <span className="wr-redes-clean__date tabular-nums">{post.dateLabel}</span>
                    <span className="wr-redes-clean__header-text truncate">{post.header}</span>
                    <span className="wr-redes-clean__eng tabular-nums">
                      <Heart className="h-3 w-3 shrink-0 opacity-70" strokeWidth={1.5} aria-hidden />
                      {formatWarRoomNumber(post.engagement)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      ) : themeRows.length === 0 ? (
        <p className="wr-redes-clean__state">
          Sem temas classificados nos últimos {LOOKBACK_DAYS} dias.
        </p>
      ) : (
        <ul className="wr-redes-clean__list" aria-label="Engajamento médio por tema">
          <li className="wr-redes-clean__row wr-redes-clean__row--head wr-redes-clean__row--temas" aria-hidden>
            <span>Tema</span>
            <span className="text-right">Posts</span>
            <span className="text-right">Média</span>
          </li>
          {themeRows.map((theme) => (
            <li
              key={theme.label}
              className="wr-redes-clean__row wr-redes-clean__row--temas"
              title={`${theme.label} · ${theme.posts} posts · média ${formatWarRoomNumber(theme.avgEngagement)} · total ${formatWarRoomNumber(theme.engagement)}`}
            >
              <span className="wr-redes-clean__theme truncate">{theme.label}</span>
              <span className="wr-redes-clean__posts tabular-nums">{theme.posts}</span>
              <span className="wr-redes-clean__eng tabular-nums">
                <Heart className="h-3 w-3 shrink-0 opacity-70" strokeWidth={1.5} aria-hidden />
                {formatWarRoomNumber(theme.avgEngagement)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="wr-redes-clean__footer-row">
        {configured && todayPosts.length > 0 ? (
          <button
            type="button"
            className="wr-redes-clean__footer-btn"
            onClick={() => setPostagensModalAberto(true)}
          >
            <span>{todayPosts.length} hoje</span>
          </button>
        ) : (
          <span className="wr-redes-clean__footer-spacer" aria-hidden />
        )}
        <Link href="/dashboard/conteudo/redes" className="wr-redes-clean__footer">
          <span>Abrir Instagram</span>
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </Link>
      </div>

      {postagensModalAberto ? (
        <WarRoomPostagensDiaModal
          posts={postagensDia}
          onClose={() => setPostagensModalAberto(false)}
        />
      ) : null}
    </section>
  )
}
