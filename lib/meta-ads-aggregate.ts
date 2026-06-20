import type {
  MetaAdsDeliveryRegion,
  MetaAdsMentionWithActor,
  MetaAdsTargetLocation,
} from '@/lib/meta-ads-types'
import {
  formatMetricCount,
  formatSpendBrl,
  sumMetricRange,
  sumSpendRange,
} from '@/lib/meta-ads-format'
import { buildMetaAdsGeoSummary } from '@/lib/meta-ads-targeting'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

export type MetaAdsPeriodTotals = {
  adCount: number
  spendMinBrl: number
  spendMaxBrl: number
  spendLabel: string
  impressionsLabel: string | null
}

export type MetaAdsComparePageRow = {
  page_name: string
  count: number
}

export type MetaAdsCompareActorRow = {
  actor: PoliticalActorWithTerms
  adCount: number
  activeCount: number
  spendMinBrl: number
  spendMaxBrl: number
  spendLabel: string
  impressionsLabel: string | null
  targetLocationsLabel: string | null
  deliveryRegionsLabel: string | null
  topTargetLocations: MetaAdsTargetLocation[]
  topDeliveryRegions: MetaAdsDeliveryRegion[]
  topPages: MetaAdsComparePageRow[]
  ads: MetaAdsMentionWithActor[]
}

function topPagesFromAds(ads: MetaAdsMentionWithActor[], max = 4): MetaAdsComparePageRow[] {
  const counts = new Map<string, number>()
  for (const ad of ads) {
    const page = ad.page_name?.trim() || 'Página desconhecida'
    counts.set(page, (counts.get(page) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([page_name, count]) => ({ page_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
}

export function buildMetaAdsPeriodTotals(ads: MetaAdsMentionWithActor[]): MetaAdsPeriodTotals {
  const spend = sumSpendRange(ads)
  const impressions = sumMetricRange(ads, 'impressions_text')

  return {
    adCount: ads.length,
    spendMinBrl: spend.min,
    spendMaxBrl: spend.max,
    spendLabel:
      spend.min > 0 || spend.max > 0
        ? formatSpendBrl(spend.min, spend.max)
        : ads.find((a) => a.spend_text)?.spend_text ?? '—',
    impressionsLabel: impressions.hasValue
      ? formatMetricCount(impressions.min, impressions.max)
      : ads.find((a) => a.impressions_text)?.impressions_text ?? null,
  }
}

const ACTOR_TYPE_ORDER: Record<string, number> = {
  own_candidate: 0,
  competitor: 1,
  ally: 2,
  other: 3,
}

export function buildMetaAdsCompareRows(
  actors: PoliticalActorWithTerms[],
  ads: MetaAdsMentionWithActor[]
): MetaAdsCompareActorRow[] {
  const bySlug = new Map<string, MetaAdsMentionWithActor[]>()
  for (const ad of ads) {
    const slug = ad.political_actors?.slug
    if (!slug) continue
    const arr = bySlug.get(slug) ?? []
    arr.push(ad)
    bySlug.set(slug, arr)
  }

  const rows: MetaAdsCompareActorRow[] = actors
    .filter((a) => a.active)
    .map((actor) => {
      const actorAds = [...(bySlug.get(actor.slug) ?? [])].sort((a, b) => {
        const da = a.started_running_at ?? a.collected_at
        const db = b.started_running_at ?? b.collected_at
        return db.localeCompare(da)
      })
      const totals = buildMetaAdsPeriodTotals(actorAds)
      const geo = buildMetaAdsGeoSummary(actorAds)
      return {
        actor,
        adCount: actorAds.length,
        activeCount: actorAds.filter((a) => a.is_active).length,
        spendMinBrl: totals.spendMinBrl,
        spendMaxBrl: totals.spendMaxBrl,
        spendLabel: totals.spendLabel,
        impressionsLabel: totals.impressionsLabel,
        targetLocationsLabel: geo.targetLocationsLabel,
        deliveryRegionsLabel: geo.deliveryRegionsLabel,
        topTargetLocations: geo.targetLocations,
        topDeliveryRegions: geo.deliveryRegions,
        topPages: topPagesFromAds(actorAds),
        ads: actorAds,
      }
    })

  return rows.sort((a, b) => {
    const ta = ACTOR_TYPE_ORDER[a.actor.actor_type] ?? 9
    const tb = ACTOR_TYPE_ORDER[b.actor.actor_type] ?? 9
    if (ta !== tb) return ta - tb
    return b.adCount - a.adCount || a.actor.name.localeCompare(b.actor.name, 'pt-BR')
  })
}
