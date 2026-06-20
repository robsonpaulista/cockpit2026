import type { MetaAdsDeliveryRegion, MetaAdsMentionWithActor, MetaAdsTargetLocation } from '@/lib/meta-ads-types'
import { cleanGeoLocationName, isLikelyCityOrState, normalizeGeoName } from '@/lib/meta-ads-geo-constants'

export function parseTargetLocationsJson(value: unknown): MetaAdsTargetLocation[] {
  if (!Array.isArray(value)) return []
  const out: MetaAdsTargetLocation[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) continue
    out.push({
      name: cleanGeoLocationName(name),
      ...(row.excluded === true ? { excluded: true } : {}),
    })
  }
  return out
}

export function parseDeliveryRegionsJson(value: unknown): MetaAdsDeliveryRegion[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const region = typeof row.region === 'string' ? row.region.trim() : ''
      if (!region) return null
      const pctRaw = row.pct
      const pct =
        typeof pctRaw === 'number' && Number.isFinite(pctRaw)
          ? pctRaw
          : typeof pctRaw === 'string'
            ? Number(pctRaw.replace(',', '.'))
            : null
      return {
        region,
        pct: pct !== null && Number.isFinite(pct) ? pct : null,
      }
    })
    .filter((item): item is MetaAdsDeliveryRegion => item !== null)
}

export function formatTargetLocationsLabel(
  locations: MetaAdsTargetLocation[] | null | undefined,
  max = 4
): string | null {
  if (!locations?.length) return null
  const included = locations
    .filter((l) => !l.excluded)
    .map((l) => l.name)
    .filter(isLikelyCityOrState)
  const excluded = locations
    .filter((l) => l.excluded)
    .map((l) => l.name)
    .filter(isLikelyCityOrState)
  const parts: string[] = []
  if (included.length > 0) {
    const slice = included.slice(0, max)
    parts.push(slice.join(', ') + (included.length > max ? ` +${included.length - max}` : ''))
  }
  if (excluded.length > 0) {
    parts.push(`exc. ${excluded.slice(0, 2).join(', ')}`)
  }
  return parts.join(' · ') || null
}

export function formatDeliveryRegionsLabel(
  regions: MetaAdsDeliveryRegion[] | null | undefined,
  max = 3
): string | null {
  if (!regions?.length) return null
  return regions
    .filter((r) => isLikelyCityOrState(r.region))
    .slice(0, max)
    .map((r) => (r.pct != null ? `${r.region} ${r.pct.toFixed(0)}%` : r.region))
    .join(' · ') || null
}

export function summarizeTargetLocations(
  ads: MetaAdsMentionWithActor[],
  max = 5
): MetaAdsTargetLocation[] {
  const counts = new Map<string, number>()
  for (const ad of ads) {
    for (const loc of parseTargetLocationsJson(ad.target_locations)) {
      if (loc.excluded) continue
      counts.set(loc.name, (counts.get(loc.name) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, max)
    .map(([name]) => ({ name, excluded: false }))
}

export function summarizeDeliveryRegions(
  ads: MetaAdsMentionWithActor[],
  max = 5
): MetaAdsDeliveryRegion[] {
  const buckets = new Map<string, number[]>()
  for (const ad of ads) {
    for (const region of parseDeliveryRegionsJson(ad.delivery_by_region)) {
      if (region.pct == null) continue
      const arr = buckets.get(region.region) ?? []
      arr.push(region.pct)
      buckets.set(region.region, arr)
    }
  }
  return [...buckets.entries()]
    .map(([region, pcts]) => ({
      region,
      pct: pcts.reduce((sum, pct) => sum + pct, 0) / pcts.length,
    }))
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
    .slice(0, max)
}

export function buildMetaAdsGeoSummary(ads: MetaAdsMentionWithActor[]): {
  targetLocations: MetaAdsTargetLocation[]
  deliveryRegions: MetaAdsDeliveryRegion[]
  targetLocationsLabel: string | null
  deliveryRegionsLabel: string | null
} {
  const targetLocations = summarizeTargetLocations(ads)
  const deliveryRegions = summarizeDeliveryRegions(ads)
  return {
    targetLocations,
    deliveryRegions,
    targetLocationsLabel: formatTargetLocationsLabel(targetLocations),
    deliveryRegionsLabel: formatDeliveryRegionsLabel(deliveryRegions),
  }
}
