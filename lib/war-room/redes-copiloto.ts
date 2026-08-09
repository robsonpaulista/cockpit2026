import type { InstagramHistoryResponse, InstagramMetrics } from '@/lib/instagramApi'
import type { WarRoomDesempenhoKpi } from '@/components/war-room/war-room-redes-desempenho-view'
import { instagramCaptionHeader } from '@/lib/instagram-caption-municipio'

export const WAR_ROOM_REDES_TZ = 'America/Sao_Paulo'

export const COPILOTO_REDES_PERIOD_OPTIONS = [
  { value: '7d', days: 7, label: '7 dias' },
  { value: '14d', days: 14, label: '14 dias' },
  { value: '28d', days: 28, label: '28 dias' },
  { value: '60d', days: 60, label: '60 dias' },
] as const

export type CopilotoRedesPeriod = (typeof COPILOTO_REDES_PERIOD_OPTIONS)[number]['value']

/** Graph API: 28d usa janela 30d (API não tem 28 explícito). */
export function copilotoRedesApiTimeRange(period: CopilotoRedesPeriod): string {
  if (period === '28d') return '30d'
  return period
}

export function copilotoRedesDays(period: CopilotoRedesPeriod): number {
  return COPILOTO_REDES_PERIOD_OPTIONS.find((o) => o.value === period)?.days ?? 28
}

export function calendarDateInTz(
  iso: string | Date,
  timeZone: string = WAR_ROOM_REDES_TZ,
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function todayKeyInTz(timeZone: string = WAR_ROOM_REDES_TZ): string {
  return calendarDateInTz(new Date(), timeZone)
}

export function formatDataCurta(iso: string, timeZone: string = WAR_ROOM_REDES_TZ): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
  }).format(d)
}

export function formatPostTime(iso: string, timeZone: string = WAR_ROOM_REDES_TZ): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Rótulo do feed: horário (hoje) · ONTEM · dd/mm. */
export function formatFeedDateLabel(iso: string, timeZone: string = WAR_ROOM_REDES_TZ): string {
  const dayKey = calendarDateInTz(iso, timeZone)
  if (!dayKey) return '—'
  const today = todayKeyInTz(timeZone)
  if (dayKey === today) return formatPostTime(iso, timeZone) || 'Hoje'
  const yesterday = cutoffKeyDaysAgo(2, timeZone)
  if (dayKey === yesterday) return 'Ontem'
  return formatDataCurta(iso, timeZone)
}

export function cutoffKeyDaysAgo(days: number, timeZone: string = WAR_ROOM_REDES_TZ): string {
  const now = new Date()
  const cutoff = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
  return calendarDateInTz(cutoff, timeZone)
}

export function listDayKeys(days: number, timeZone: string = WAR_ROOM_REDES_TZ): string[] {
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

export function getInstagramPostIdentifier(post: {
  id: string
  postedAt?: string
  caption?: string
}): string {
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

export type WarRoomRedesTopPost = {
  id: string
  dateLabel: string
  header: string
  engagement: number
  isToday: boolean
  dayKey: string
  postedAt: string
  url?: string
  thumbnail?: string
  caption?: string
}

export function buildWarRoomRedesTopPosts(
  posts: InstagramMetrics['posts'],
  days: number,
): WarRoomRedesTopPost[] {
  const cutoff = cutoffKeyDaysAgo(days)
  const today = todayKeyInTz()
  return [...posts]
    .filter((post) => {
      const day = calendarDateInTz(post.postedAt)
      return day !== '' && day >= cutoff
    })
    .map((post) => {
      const dayKey = calendarDateInTz(post.postedAt)
      const isToday = dayKey === today
      return {
        id: getInstagramPostIdentifier(post),
        dateLabel: formatFeedDateLabel(post.postedAt),
        header: instagramCaptionHeader(post.caption) || 'Sem cabeçalho',
        engagement: post.metrics.engagement || 0,
        isToday,
        dayKey,
        postedAt: post.postedAt,
        url: post.url,
        thumbnail: post.thumbnail,
        caption: post.caption,
      }
    })
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
}

export function buildWarRoomRedesDesempenhoKpis(opts: {
  history: InstagramHistoryResponse | null
  metrics: InstagramMetrics | null
  manualVisitsByDate: Record<string, number>
  days: number
}): WarRoomDesempenhoKpi[] {
  const { history, metrics, manualVisitsByDate, days } = opts
  const audienceSplit = metrics?.insights?.audienceSplit ?? null
  const posts = metrics?.posts ?? []
  const rows = [...(history?.history ?? [])].sort((a, b) =>
    a.snapshot_date.localeCompare(b.snapshot_date),
  )

  const dayKeys = listDayKeys(days)
  const cutoff = cutoffKeyDaysAgo(days)

  const seriesHasSignal = (series: Array<{ value: number }>) =>
    series.some((p) => Number.isFinite(p.value) && p.value !== 0)

  const seriesFromPosts = (pick: (post: (typeof posts)[number]) => number) => {
    const byDate = new Map<string, number>(dayKeys.map((d) => [d, 0]))
    for (const post of posts) {
      const day = calendarDateInTz(post.postedAt)
      if (!day || day < cutoff || !byDate.has(day)) continue
      byDate.set(day, (byDate.get(day) ?? 0) + (pick(post) || 0))
    }
    return dayKeys.map((date) => ({
      date,
      label: formatDataCurta(`${date}T12:00:00`),
      value: byDate.get(date) ?? 0,
    }))
  }

  const seriesFromDaily = (
    daily: Array<{ date: string; value: number }> | undefined,
  ) => {
    if (!daily || daily.length === 0) return []
    const byDate = new Map(daily.map((p) => [p.date, p.value] as const))
    const aligned = dayKeys.map((date) => ({
      date,
      label: formatDataCurta(`${date}T12:00:00`),
      value: byDate.get(date) ?? 0,
    }))
    if (seriesHasSignal(aligned)) return aligned

    // Datas da Graph fora do alinhamento de dayKeys: usa pontos brutos do período.
    const start = dayKeys[0]
    const end = dayKeys[dayKeys.length - 1]
    if (!start || !end) return aligned
    const inRange = daily.filter((p) => p.date >= start && p.date <= end)
    if (inRange.length === 0) return aligned
    return inRange.map((p) => ({
      date: p.date,
      label: formatDataCurta(`${p.date}T12:00:00`),
      value: p.value,
    }))
  }

  const totalOf = (series: Array<{ value: number }>) =>
    series.reduce((sum, p) => sum + p.value, 0)

  const deltaOf = (series: Array<{ value: number }>): number | null => {
    if (series.length < 2) return null
    const first = series[0]?.value ?? 0
    const last = series[series.length - 1]?.value ?? 0
    if (first === 0) return last === 0 ? 0 : null
    return ((last - first) / Math.abs(first)) * 100
  }

  const first = rows[0]
  const last = rows[rows.length - 1]
  const viewsFromApi = seriesFromDaily(metrics?.insights?.dailyViews)
  const viewsFromHistory = (() => {
    const byDate = new Map(rows.map((r) => [r.snapshot_date, r.impressions || 0] as const))
    return dayKeys.map((date) => ({
      date,
      label: formatDataCurta(`${date}T12:00:00`),
      value: byDate.get(date) ?? 0,
    }))
  })()
  const viewsFromPosts = seriesFromPosts((p) => p.metrics.views || 0)
  const viewsSeries = seriesHasSignal(viewsFromApi)
    ? viewsFromApi
    : seriesHasSignal(viewsFromHistory)
      ? viewsFromHistory
      : viewsFromPosts
  const viewsTotal = totalOf(viewsSeries)
  const viewsLegend = seriesHasSignal(viewsFromApi)
    ? 'Views diárias (Graph)'
    : seriesHasSignal(viewsFromHistory)
      ? 'Snapshots diários'
      : 'Soma das views das postagens no dia'
  const likesSeries = seriesFromPosts((p) => p.metrics.likes || 0)
  const commentsSeries = seriesFromPosts((p) => p.metrics.comments || 0)
  const sharesSeries = seriesFromPosts((p) => p.metrics.shares || 0)
  const engagementSeries = seriesFromPosts((p) => p.metrics.engagement || 0)
  const historyViewsByDate = new Map(
    rows.map((r) => [r.snapshot_date, r.profile_views || 0] as const),
  )
  const visitsSeries = dayKeys.map((date) => ({
    date,
    label: formatDataCurta(`${date}T12:00:00`),
    value: manualVisitsByDate[date] ?? historyViewsByDate.get(date) ?? 0,
  }))
  const visitsTotal = totalOf(visitsSeries)
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

  return [
    {
      id: 'engagement',
      label: 'Engajamento',
      total: totalOf(engagementSeries),
      deltaPct: deltaOf(engagementSeries),
      series: engagementSeries,
      legend: 'Soma das postagens no dia',
    },
    {
      id: 'views',
      label: 'Visualizações',
      total: viewsTotal,
      deltaPct: deltaOf(viewsSeries),
      series: viewsSeries,
      followersPct: audiencePct(
        audienceSplit?.views?.followers ?? 0,
        audienceSplit?.views?.total ?? 0,
      ),
      nonFollowersPct: audiencePct(
        audienceSplit?.views?.nonFollowers ?? 0,
        audienceSplit?.views?.total ?? 0,
      ),
      legend: viewsLegend,
    },
    {
      id: 'visits',
      label: 'Visitas no perfil',
      total: visitsTotal,
      deltaPct: deltaOf(visitsSeries),
      series: visitsSeries,
      legend: 'Perfil · lançamento manual quando houver',
    },
    (() => {
      const raw = metrics?.insights?.dailyStoryViews
      const storySeries =
        raw && raw.length > 0
          ? raw.map((p) => ({
              date: p.date,
              label: formatDataCurta(`${p.date}T12:00:00`),
              value: p.value,
            }))
          : []
      const storiesTotal =
        metrics?.insights?.periodMetrics?.storiesViews ?? totalOf(storySeries)
      return {
        id: 'story-views',
        label: 'Visualizações nos Stories',
        total: storiesTotal,
        deltaPct: deltaOf(storySeries),
        series: storySeries,
        legend: 'Graph · breakdown STORY',
      }
    })(),
    {
      id: 'followers',
      label: 'Seguidores',
      total: followersNet,
      deltaPct: followersDeltaPct,
      series: followersSeries,
      legend: 'Ganho líquido no período',
    },
    {
      id: 'likes',
      label: 'Curtidas',
      total: totalOf(likesSeries),
      deltaPct: deltaOf(likesSeries),
      series: likesSeries,
      legend: 'Soma das postagens no dia',
    },
    {
      id: 'comments',
      label: 'Comentários',
      total: totalOf(commentsSeries),
      deltaPct: deltaOf(commentsSeries),
      series: commentsSeries,
      legend: 'Soma das postagens no dia',
    },
    {
      id: 'shares',
      label: 'Compartilhamentos',
      total: totalOf(sharesSeries),
      deltaPct: deltaOf(sharesSeries),
      series: sharesSeries,
      legend: 'Soma das postagens no dia',
    },
  ].filter((kpi) => kpi.total !== 0 || kpi.series.some((p) => p.value !== 0))
}
