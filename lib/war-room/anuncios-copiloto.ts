import { OWN_CANDIDATE_SLUG } from '@/lib/instagram-radar-own-sync'
import {
  buildMetaAdsCompareRows,
  buildMetaAdsPeriodTotals,
  type MetaAdsCompareActorRow,
} from '@/lib/meta-ads-aggregate'
import { parseMetricRange } from '@/lib/meta-ads-format'
import { parseTargetLocationsJson } from '@/lib/meta-ads-targeting'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

export const ANUNCIOS_HEADLINE_MAX = 48

export type WarRoomAnuncioListRow = {
  ad: MetaAdsMentionWithActor
  short: string
  full: string
  startedLabel: string
  impressionsLabel: string
  spendLabel: string
  locationsLabel: string | null
  mid: number
  sharePct: number | null
}

export type WarRoomAnunciosCompetitorRow = {
  name: string
  slug: string
  activeCount: number
  adCount: number
  spendLabel: string
  impressionsLabel: string | null
  isOwn: boolean
  isLeader: boolean
  sharePct: number
}

export type WarRoomAnunciosLocationRow = {
  name: string
  count: number
  pct: number
}

export type WarRoomAnunciosScore = {
  score: number
  label: string
  footTone: 'ok' | 'flat' | 'down'
}

export function adHeadline(ad: MetaAdsMentionWithActor): { short: string; full: string } {
  const body = ad.ad_body?.replace(/\s+/g, ' ').trim() ?? ''
  if (body) {
    const firstChunk = body.split(/(?<=[.!?])\s+/)[0]?.trim() || body
    const short =
      firstChunk.length > ANUNCIOS_HEADLINE_MAX
        ? `${firstChunk.slice(0, ANUNCIOS_HEADLINE_MAX).trimEnd()}…`
        : firstChunk
    return { short, full: body }
  }
  const fallback =
    ad.page_name?.trim() ||
    (ad.library_ad_id ? `Anúncio ${ad.library_ad_id}` : 'Anúncio sem texto')
  return { short: fallback, full: fallback }
}

export function impressionMid(ad: MetaAdsMentionWithActor): number {
  const parsed = parseMetricRange(ad.impressions_text)
  const lo = parsed.min ?? parsed.max
  const hi = parsed.max ?? parsed.min
  if (lo == null && hi == null) return 0
  if (lo != null && hi != null) return (lo + hi) / 2
  return lo ?? hi ?? 0
}

export function filterActiveAds(ads: MetaAdsMentionWithActor[]): MetaAdsMentionWithActor[] {
  return ads
    .filter((ad) => ad.is_active === true)
    .sort((a, b) => {
      const da = a.started_running_at ?? ''
      const db = b.started_running_at ?? ''
      return db.localeCompare(da)
    })
}

export function filterOwnCandidateAds(
  ads: MetaAdsMentionWithActor[],
  slug: string = OWN_CANDIDATE_SLUG,
): MetaAdsMentionWithActor[] {
  return ads.filter((ad) => ad.political_actors?.slug === slug)
}

export function adLocationsLabel(ad: MetaAdsMentionWithActor): string | null {
  const text = ad.target_locations_text?.trim()
  if (text) return text
  const parsed = parseTargetLocationsJson(ad.target_locations)
  if (parsed.length === 0) return null
  return parsed
    .filter((loc) => !loc.excluded)
    .map((loc) => loc.name)
    .slice(0, 3)
    .join(' · ')
}

export function buildWarRoomAnuncioListRows(
  ads: MetaAdsMentionWithActor[],
  activeOnly = true,
): WarRoomAnuncioListRow[] {
  const pool = activeOnly ? filterActiveAds(ads) : [...ads]
  const mids = pool.map(impressionMid)
  const totalMid = mids.reduce((sum, n) => sum + n, 0)

  return pool.map((ad, i) => {
    const { short, full } = adHeadline(ad)
    const mid = mids[i] ?? 0
    return {
      ad,
      short,
      full,
      startedLabel: ad.started_running_at
        ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
            new Date(ad.started_running_at),
          )
        : '—',
      impressionsLabel: ad.impressions_text?.trim() || '—',
      spendLabel: ad.spend_text?.trim() || '—',
      locationsLabel: adLocationsLabel(ad),
      mid,
      sharePct: totalMid > 0 && mid > 0 ? Math.round((mid / totalMid) * 100) : null,
    }
  })
}

export function buildWarRoomAnunciosCompareRows(
  actors: PoliticalActorWithTerms[],
  ads: MetaAdsMentionWithActor[],
): MetaAdsCompareActorRow[] {
  return buildMetaAdsCompareRows(actors, ads)
}

export function buildWarRoomAnunciosCompetitorRows(
  compareRows: MetaAdsCompareActorRow[],
): WarRoomAnunciosCompetitorRow[] {
  const totalActive = compareRows.reduce((sum, row) => sum + row.activeCount, 0)
  const leaderActive = Math.max(0, ...compareRows.map((row) => row.activeCount))

  return compareRows.map((row) => ({
    name: row.actor.name,
    slug: row.actor.slug,
    activeCount: row.activeCount,
    adCount: row.adCount,
    spendLabel: row.spendLabel,
    impressionsLabel: row.impressionsLabel,
    isOwn: row.actor.actor_type === 'own_candidate',
    isLeader: row.activeCount > 0 && row.activeCount === leaderActive,
    sharePct:
      totalActive > 0 && row.activeCount > 0
        ? Math.round((row.activeCount / totalActive) * 100)
        : 0,
  }))
}

export function buildWarRoomAnunciosLocationRows(
  ownActiveAds: MetaAdsMentionWithActor[],
): WarRoomAnunciosLocationRow[] {
  const counts = new Map<string, number>()
  for (const ad of ownActiveAds) {
    for (const loc of parseTargetLocationsJson(ad.target_locations)) {
      if (loc.excluded) continue
      counts.set(loc.name, (counts.get(loc.name) ?? 0) + 1)
    }
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, 8)
  const max = Math.max(1, ...sorted.map(([, count]) => count))
  return sorted.map(([name, count]) => ({
    name,
    count,
    pct: Math.round((count / max) * 100),
  }))
}

export function geoCoveragePct(ads: MetaAdsMentionWithActor[]): number {
  if (ads.length === 0) return 0
  const withGeo = ads.filter(
    (ad) =>
      Boolean(ad.target_locations_text?.trim()) ||
      parseTargetLocationsJson(ad.target_locations).length > 0,
  ).length
  return Math.round((withGeo / ads.length) * 100)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function computeWarRoomAnunciosScore(input: {
  ownActiveCount: number
  totalActiveCount: number
  geoCoveragePct: number
  isActiveLeader: boolean
}): WarRoomAnunciosScore {
  const activeShare =
    input.totalActiveCount > 0 ? input.ownActiveCount / input.totalActiveCount : 0
  const volume = clamp(input.ownActiveCount / 6, 0, 1)
  const geo = clamp(input.geoCoveragePct / 100, 0, 1)
  const leaderBonus = input.isActiveLeader ? 1 : activeShare >= 0.5 ? 0.6 : 0

  const scoreRaw =
    activeShare * 3.5 + volume * 2.5 + geo * 2 + leaderBonus * 2
  const score = Math.round(clamp(scoreRaw, 0, 10) * 10) / 10
  const label =
    score >= 8 ? 'Muito bom' : score >= 6 ? 'Bom' : score >= 4 ? 'Regular' : 'Fraco'
  const footTone: WarRoomAnunciosScore['footTone'] =
    score >= 6 ? 'ok' : score >= 4 ? 'flat' : 'down'

  return { score, label, footTone }
}

export function buildOwnAnunciosTotals(ownActiveAds: MetaAdsMentionWithActor[]) {
  return buildMetaAdsPeriodTotals(ownActiveAds)
}
