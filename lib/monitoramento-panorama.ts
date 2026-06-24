import { buildGoogleNewsCompareRows } from '@/lib/google-news-aggregate'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import { buildGoogleTrendsCompareRows } from '@/lib/google-trends-aggregate'
import type {
  GoogleTrendsCompareRow,
  GoogleTrendsInterestPoint,
  GoogleTrendsInterestRow,
  GoogleTrendsRelatedRow,
} from '@/lib/google-trends-types'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import { buildMetaAdsCompareRows } from '@/lib/meta-ads-aggregate'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import { formatSpendBrl } from '@/lib/meta-ads-format'
import { buildPanoramaPlatformCharts, type PanoramaPlatformChart } from '@/lib/monitoramento-panorama-charts'
import { buildPanoramaPlatformKpis, type PanoramaPlatformKpiCard } from '@/lib/monitoramento-panorama-kpis'
import {
  panoramaWindowCutoffDay,
  panoramaWindowCutoffIso,
  panoramaWindowLabel,
} from '@/lib/monitoramento-panorama-window'
import { buildYoutubeCompareRows } from '@/lib/youtube-radar-aggregate'
import { labelActorType } from '@/lib/youtube-radar-labels'
import type { PoliticalActorWithTerms, PoliticalActorType, YoutubeMentionWithActor } from '@/lib/youtube-radar-types'

export type PanoramaTrendLabel =
  | 'mais alto agora'
  | 'caindo'
  | 'pico passado'
  | 'inativo'
  | 'estável'

export type PanoramaHighlight = 'best' | 'worst' | 'none'

export type PanoramaNewsPreview = {
  title: string
  source: string | null
  url: string
  publishedAt: string | null
}

export type PanoramaVideoPreview = {
  title: string
  channel: string | null
  views: number
  url: string
  thumbnailUrl: string | null
  publishedAt: string | null
}

export type PanoramaAdPreview = {
  pageName: string | null
  body: string | null
  isActive: boolean | null
  url: string
  startedAt: string | null
  spendLabel: string
  impressionsText: string | null
}

export type PanoramaTrendsCell = {
  currentIndex: number
  peak3m: number
  peakDate: string | null
  weekChangePct: number | null
  trendLabel: PanoramaTrendLabel
  points: GoogleTrendsInterestPoint[]
  searchContext: GoogleTrendsCompareRow['searchContext']
  highlights: {
    currentIndex: PanoramaHighlight
    peak3m: PanoramaHighlight
    weekChangePct: PanoramaHighlight
  }
}

export type PanoramaMetaAdsCell = {
  activeAds: number
  totalAds: number
  spendMinBrl: number
  spendMaxBrl: number
  topPage: string | null
  spendLabel: string | null
  impressionsLabel: string | null
  targetLocationsLabel: string | null
  deliveryRegionsLabel: string | null
  previews: PanoramaAdPreview[]
  highlights: {
    activeAds: PanoramaHighlight
    totalAds: PanoramaHighlight
  }
}

export type PanoramaGoogleNewsCell = {
  mentions7d: number
  topSource: string | null
  previews: PanoramaNewsPreview[]
  highlights: {
    mentions7d: PanoramaHighlight
  }
}

export type PanoramaYoutubeCell = {
  videos7d: number
  views7d: number
  topChannel: string | null
  previews: PanoramaVideoPreview[]
  highlights: {
    videos7d: PanoramaHighlight
    views7d: PanoramaHighlight
  }
}

export type PanoramaDigitalScoreCell = {
  stars: number
  label: string
}

export type PanoramaCandidateColumn = {
  slug: string
  name: string
  actorType: PoliticalActorType
  actorTypeLabel: string
  accentColor: string
  headline: string
  trends: PanoramaTrendsCell | null
  metaAds: PanoramaMetaAdsCell | null
  googleNews: PanoramaGoogleNewsCell | null
  youtube: PanoramaYoutubeCell | null
  digitalScore: PanoramaDigitalScoreCell
}

export type PanoramaModel = {
  title: string
  windowLabel: string
  lastUpdated: string | null
  isLive: boolean
  columns: PanoramaCandidateColumn[]
  charts: PanoramaPlatformChart[]
  platformKpis: PanoramaPlatformKpiCard[]
  setupRequired: boolean
}

const ACTOR_TYPE_ORDER: Record<string, number> = {
  own_candidate: 0,
  competitor: 1,
  ally: 2,
  other: 3,
}

/** Paleta institucional — âmbar da marca + neutros quentes (menos contraste entre séries). */
const OWN_CANDIDATE_COLOR = '#C8900A'

const COMPETITOR_COLORS = [
  '#6B7280',
  '#8A7560',
  '#64748B',
  '#A68952',
  '#78716C',
  '#9E8B78',
  '#5C6370',
  '#B5A088',
  '#737373',
]

function assignAccentColor(actorType: PoliticalActorType, competitorIndex: number): string {
  if (actorType === 'own_candidate') return OWN_CANDIDATE_COLOR
  return COMPETITOR_COLORS[competitorIndex % COMPETITOR_COLORS.length]
}

function formatPeakDate(iso: string | null): string {
  if (!iso) return 'data desconhecida'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

function filterBySlug<T extends { political_actors?: { slug?: string } | null }>(
  items: T[],
  slug: string
): T[] {
  return items.filter((i) => i.political_actors?.slug === slug)
}

function buildNewsPreviews(mentions: GoogleNewsMentionWithActor[], max = 2): PanoramaNewsPreview[] {
  return [...mentions]
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    .slice(0, max)
    .map((m) => ({
      title: m.title,
      source: m.source_name,
      url: m.url,
      publishedAt: m.published_at,
    }))
}

function buildVideoPreviews(mentions: YoutubeMentionWithActor[], max = 2): PanoramaVideoPreview[] {
  return [...mentions]
    .sort((a, b) => b.views - a.views)
    .slice(0, max)
    .map((m) => ({
      title: m.video_title,
      channel: m.channel_title,
      views: m.views,
      url: m.url,
      thumbnailUrl: m.thumbnail_url,
      publishedAt: m.published_at,
    }))
}

function buildAdPreviews(ads: MetaAdsMentionWithActor[], max = 2): PanoramaAdPreview[] {
  return [...ads]
    .sort((a, b) => {
      const aActive = a.is_active ? 1 : 0
      const bActive = b.is_active ? 1 : 0
      if (aActive !== bActive) return bActive - aActive
      const da = a.started_running_at ?? a.collected_at
      const db = b.started_running_at ?? b.collected_at
      return db.localeCompare(da)
    })
    .slice(0, max)
    .map((a) => ({
      pageName: a.page_name,
      body: a.ad_body,
      isActive: a.is_active,
      url: a.library_url,
      startedAt: a.started_running_at,
      spendLabel: formatSpendBrl(a.spend_min_brl, a.spend_max_brl, a.spend_text),
      impressionsText: a.impressions_text,
    }))
}

function buildHeadline(input: {
  trends: PanoramaTrendsCell | null
  youtube: PanoramaYoutubeCell
  news: PanoramaGoogleNewsCell
  meta: PanoramaMetaAdsCell
  maxCurrent: number
  name: string
}): string {
  const { trends, youtube, news, meta, maxCurrent, name } = input

  if (!trends && youtube.videos7d === 0 && news.mentions7d === 0 && meta.totalAds === 0) {
    return 'Sem sinais recentes no recorte — aguardando novas coletas'
  }

  if (trends?.trendLabel === 'mais alto agora' && trends.currentIndex > 0) {
    return `As buscas por ${name} registram o maior índice atual (${trends.currentIndex}/100)`
  }

  if (trends?.trendLabel === 'caindo' && trends.weekChangePct !== null) {
    return `As buscas por ${name} recuaram ${trends.weekChangePct}% na comparação semanal`
  }

  if (trends?.trendLabel === 'pico passado' && trends.peakDate) {
    return `As buscas por ${name} marcaram pico de ${trends.peak3m}/100 em ${formatPeakDate(trends.peakDate)}`
  }

  if (meta.activeAds > 0) {
    const page = meta.topPage ? ` via ${meta.topPage}` : ''
    const spend = meta.spendLabel ? ` · gasto est. ${meta.spendLabel}` : ''
    return `${name} aparece com ${meta.activeAds} anúncio(s) ativo(s) na Meta${page}${spend}`
  }

  if (news.mentions7d >= 3) {
    return `${name} concentrou ${news.mentions7d} menções na imprensa (${panoramaWindowLabel()})`
  }

  if (youtube.videos7d >= 2) {
    return `${name} acumulou ${youtube.videos7d} vídeos no YouTube (${panoramaWindowLabel()}) · ${youtube.views7d.toLocaleString('pt-BR')} views`
  }

  if (trends && trends.currentIndex === maxCurrent && maxCurrent > 0) {
    return `As buscas por ${name} registram o maior índice entre os monitorados (${trends.currentIndex})`
  }

  return `${name} com monitoramento ativo no recorte`
}

export function rankHighlights(
  values: number[],
  higherIsBetter = true
): PanoramaHighlight[] {
  if (values.length < 2) return values.map(() => 'none')
  const max = Math.max(...values)
  const min = Math.min(...values)
  if (max === min) return values.map(() => 'none')
  return values.map((v) => {
    if (higherIsBetter && v === max) return 'best'
    if (!higherIsBetter && v === min) return 'best'
    if (higherIsBetter && v === min) return 'worst'
    if (!higherIsBetter && v === max) return 'worst'
    return 'none'
  })
}

function resolveTrendLabel(
  row: GoogleTrendsCompareRow,
  maxCurrent: number
): PanoramaTrendLabel {
  if (row.latestScore === 0) return 'inativo'
  if (row.latestScore === maxCurrent && maxCurrent > 0) return 'mais alto agora'
  if ((row.growthPct ?? 0) < -30) return 'caindo'
  if (row.peakScore > row.latestScore * 2 && row.peakScore > 20) return 'pico passado'
  return 'estável'
}

function buildDigitalScore(
  trends: PanoramaTrendsCell | null,
  youtube: PanoramaYoutubeCell,
  news: PanoramaGoogleNewsCell,
  meta: PanoramaMetaAdsCell,
  maxCurrent: number
): PanoramaDigitalScoreCell {
  const trendNorm = (trends?.currentIndex ?? 0) / 100
  const ytNorm = Math.min(youtube.videos7d / 30, 1)
  const newsNorm = Math.min(news.mentions7d / 60, 1)
  const metaNorm = Math.min(meta.activeAds / 5, 1)
  const avg = (trendNorm + ytNorm + newsNorm + metaNorm) / 4

  if (avg === 0) return { stars: 0, label: 'sem presença' }
  if (trends && trends.currentIndex === maxCurrent && trends.currentIndex > 0) {
    const stars = avg >= 0.6 ? 3 : avg >= 0.25 ? 2 : 1
    return { stars, label: 'mais ativo agora' }
  }
  if (trends && trends.peak3m >= 80) {
    const stars = avg >= 0.5 ? 3 : avg >= 0.2 ? 2 : 1
    return { stars, label: 'pico histórico alto' }
  }
  if (trends && trends.peak3m > 30 && trends.currentIndex < 10) {
    const stars = avg >= 0.35 ? 2 : 1
    return { stars, label: 'pico pontual' }
  }
  const stars = avg >= 0.55 ? 3 : avg >= 0.25 ? 2 : 1
  return { stars, label: stars >= 2 ? 'presença moderada' : 'presença baixa' }
}

export function buildMonitoramentoPanorama(input: {
  actors: PoliticalActorWithTerms[]
  trendsRows: GoogleTrendsCompareRow[]
  trendsInterestRows: GoogleTrendsInterestRow[]
  youtubeMentions: YoutubeMentionWithActor[]
  googleNewsMentions: GoogleNewsMentionWithActor[]
  instagramPosts: InstagramRadarPostWithActor[]
  metaAdsMentions30d: MetaAdsMentionWithActor[]
  lastUpdated: string | null
  windowLabel?: string
  title?: string
  setupRequired?: boolean
}): PanoramaModel {
  const activeActors = input.actors.filter((a) => a.active)

  const cutoffIso = panoramaWindowCutoffIso()
  const youtubeMentionsWindow = input.youtubeMentions.filter(
    (m) => m.published_at && m.published_at >= cutoffIso
  )
  const googleNewsMentionsWindow = input.googleNewsMentions.filter(
    (m) => m.published_at && m.published_at >= cutoffIso
  )

  const trendsBySlug = new Map(
    input.trendsRows.filter((r) => r.slug).map((r) => [r.slug!, r])
  )

  const youtubeRows = buildYoutubeCompareRows(activeActors, youtubeMentionsWindow)
  const newsRows = buildGoogleNewsCompareRows(activeActors, googleNewsMentionsWindow)
  const metaRows = buildMetaAdsCompareRows(activeActors, input.metaAdsMentions30d)

  const youtubeBySlug = new Map(youtubeRows.map((r) => [r.actor.slug, r]))
  const newsBySlug = new Map(newsRows.map((r) => [r.actor.slug, r]))
  const metaBySlug = new Map(metaRows.map((r) => [r.actor.slug, r]))

  const sortedActors = [...activeActors].sort((a, b) => {
    const ta = ACTOR_TYPE_ORDER[a.actor_type] ?? 9
    const tb = ACTOR_TYPE_ORDER[b.actor_type] ?? 9
    if (ta !== tb) return ta - tb
    return a.name.localeCompare(b.name, 'pt-BR')
  })

  let competitorIdx = 0
  const draftColumns = sortedActors.map((actor) => {
    const accentColor =
      actor.actor_type === 'own_candidate'
        ? OWN_CANDIDATE_COLOR
        : assignAccentColor(actor.actor_type, competitorIdx++)

    const actorNews = filterBySlug(googleNewsMentionsWindow, actor.slug)
    const actorVideos = filterBySlug(youtubeMentionsWindow, actor.slug)
    const actorAds = filterBySlug(input.metaAdsMentions30d, actor.slug)
    const trendsRow = trendsBySlug.get(actor.slug)
    const yt = youtubeBySlug.get(actor.slug)
    const news = newsBySlug.get(actor.slug)
    const meta = metaBySlug.get(actor.slug)

    return {
      slug: actor.slug,
      name: actor.name,
      actorType: actor.actor_type,
      actorTypeLabel: labelActorType(actor.actor_type).toLowerCase(),
      accentColor,
      trendsRow,
      actorNews,
      actorVideos,
      actorAds,
      youtube: yt
        ? { videos7d: yt.videoCount, views7d: yt.totalViews, topChannel: yt.topChannels[0]?.channel_title ?? null }
        : { videos7d: 0, views7d: 0, topChannel: null },
      googleNews: news
        ? { mentions7d: news.articleCount, topSource: news.topSources[0]?.source_name ?? null }
        : { mentions7d: 0, topSource: null },
      metaAds: meta
        ? {
            activeAds: meta.activeCount,
            totalAds: meta.adCount,
            spendMinBrl: meta.spendMinBrl,
            spendMaxBrl: meta.spendMaxBrl,
            topPage: meta.topPages[0]?.page_name ?? null,
            spendLabel: meta.spendLabel !== '—' ? meta.spendLabel : null,
            impressionsLabel: meta.impressionsLabel,
            targetLocationsLabel: meta.targetLocationsLabel,
            deliveryRegionsLabel: meta.deliveryRegionsLabel,
          }
        : {
            activeAds: 0,
            totalAds: 0,
            spendMinBrl: 0,
            spendMaxBrl: 0,
            topPage: null,
            spendLabel: null,
            impressionsLabel: null,
            targetLocationsLabel: null,
            deliveryRegionsLabel: null,
          },
    }
  })

  const currentIndices = draftColumns.map((c) => c.trendsRow?.latestScore ?? 0)
  const maxCurrent = Math.max(...currentIndices, 0)

  const columns: PanoramaCandidateColumn[] = draftColumns.map((draft) => {
    const trends: PanoramaTrendsCell | null = draft.trendsRow
      ? {
          currentIndex: draft.trendsRow.latestScore,
          peak3m: draft.trendsRow.peakScore,
          peakDate: draft.trendsRow.peakDate,
          weekChangePct: draft.trendsRow.growthPct,
          trendLabel: resolveTrendLabel(draft.trendsRow, maxCurrent),
          points: draft.trendsRow.points,
          searchContext: draft.trendsRow.searchContext,
          highlights: {
            currentIndex: 'none',
            peak3m: 'none',
            weekChangePct: 'none',
          },
        }
      : null

    const youtube: PanoramaYoutubeCell = {
      videos7d: draft.youtube.videos7d,
      views7d: draft.youtube.views7d,
      topChannel: draft.youtube.topChannel,
      previews: buildVideoPreviews(draft.actorVideos),
      highlights: { videos7d: 'none', views7d: 'none' },
    }

    const googleNews: PanoramaGoogleNewsCell = {
      mentions7d: draft.googleNews.mentions7d,
      topSource: draft.googleNews.topSource,
      previews: buildNewsPreviews(draft.actorNews),
      highlights: { mentions7d: 'none' },
    }

    const metaAds: PanoramaMetaAdsCell = {
      activeAds: draft.metaAds.activeAds,
      totalAds: draft.metaAds.totalAds,
      spendMinBrl: draft.metaAds.spendMinBrl,
      spendMaxBrl: draft.metaAds.spendMaxBrl,
      topPage: draft.metaAds.topPage,
      spendLabel: draft.metaAds.spendLabel,
      impressionsLabel: draft.metaAds.impressionsLabel,
      targetLocationsLabel: draft.metaAds.targetLocationsLabel,
      deliveryRegionsLabel: draft.metaAds.deliveryRegionsLabel,
      previews: buildAdPreviews(draft.actorAds),
      highlights: { activeAds: 'none', totalAds: 'none' },
    }

    const headline = buildHeadline({
      trends,
      youtube,
      news: googleNews,
      meta: metaAds,
      maxCurrent,
      name: draft.name,
    })

    return {
      slug: draft.slug,
      name: draft.name,
      actorType: draft.actorType,
      actorTypeLabel: draft.actorTypeLabel,
      accentColor: draft.accentColor,
      headline,
      trends,
      metaAds,
      googleNews,
      youtube,
      digitalScore: buildDigitalScore(trends, youtube, googleNews, metaAds, maxCurrent),
    }
  })

  if (columns.length >= 2) {
    const trendCurrent = columns.map((c) => c.trends?.currentIndex ?? 0)
    const trendPeak = columns.map((c) => c.trends?.peak3m ?? 0)
    const trendWeek = columns.map((c) => c.trends?.weekChangePct ?? 0)
    const ytVideos = columns.map((c) => c.youtube?.videos7d ?? 0)
    const ytViews = columns.map((c) => c.youtube?.views7d ?? 0)
    const newsMentions = columns.map((c) => c.googleNews?.mentions7d ?? 0)
    const metaActive = columns.map((c) => c.metaAds?.activeAds ?? 0)
    const metaTotal = columns.map((c) => c.metaAds?.totalAds ?? 0)

    const hCurrent = rankHighlights(trendCurrent)
    const hPeak = rankHighlights(trendPeak)
    const hWeek = rankHighlights(trendWeek)
    const hYtV = rankHighlights(ytVideos)
    const hYtViews = rankHighlights(ytViews)
    const hNews = rankHighlights(newsMentions)
    const hMetaActive = rankHighlights(metaActive)
    const hMetaTotal = rankHighlights(metaTotal)

    columns.forEach((col, i) => {
      if (col.trends) {
        col.trends.highlights.currentIndex = hCurrent[i]
        col.trends.highlights.peak3m = hPeak[i]
        col.trends.highlights.weekChangePct = hWeek[i]
      }
      if (col.youtube) {
        col.youtube.highlights.videos7d = hYtV[i]
        col.youtube.highlights.views7d = hYtViews[i]
      }
      if (col.googleNews) col.googleNews.highlights.mentions7d = hNews[i]
      if (col.metaAds) {
        col.metaAds.highlights.activeAds = hMetaActive[i]
        col.metaAds.highlights.totalAds = hMetaTotal[i]
      }
    })
  }

  const lastMs = input.lastUpdated ? new Date(input.lastUpdated).getTime() : 0
  const isLive = lastMs > 0 && Date.now() - lastMs < 24 * 60 * 60 * 1000

  const trendsCutoffDay = panoramaWindowCutoffDay()
  const trendsInterestWindow = input.trendsInterestRows.filter(
    (r) => r.interest_date >= trendsCutoffDay
  )

  const charts = buildPanoramaPlatformCharts({
    columns,
    actors: activeActors,
    youtubeMentions: youtubeMentionsWindow,
    googleNewsMentions: googleNewsMentionsWindow,
    instagramPosts: input.instagramPosts.filter(
      (p) => {
        const dateSource = p.posted_at ?? p.collected_at
        return dateSource && dateSource >= cutoffIso
      }
    ),
    trendsInterestRows: trendsInterestWindow,
    metaAdsMentions: input.metaAdsMentions30d,
  })

  const windowLabel = input.windowLabel ?? panoramaWindowLabel()
  const platformKpis = buildPanoramaPlatformKpis({ columns, charts, windowLabel })

  return {
    title: input.title ?? 'PAINEL DE MONITORAMENTO — PIAUÍ 2026',
    windowLabel,
    lastUpdated: input.lastUpdated,
    isLive,
    columns,
    charts,
    platformKpis,
    setupRequired: Boolean(input.setupRequired),
  }
}

export function buildTrendsCompareFromRows(
  actors: PoliticalActorWithTerms[],
  interestRows: GoogleTrendsInterestRow[],
  relatedRows: GoogleTrendsRelatedRow[] = []
): GoogleTrendsCompareRow[] {
  return buildGoogleTrendsCompareRows(actors, interestRows, relatedRows)
}
