/** Coleta cidade/UF via detalhe de cada anúncio (lento). Desligado por padrão. */
export function isMetaAdsGeoCollectionEnabled(): boolean {
  const v = process.env.META_ADS_GEO_DETAILS?.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes') return true
  if (process.env.META_ADS_SKIP_DETAILS === '1' || process.env.META_ADS_SKIP_DETAILS === 'true') {
    return false
  }
  return false
}

export function getMetaAdsMaxScrolls(): number {
  const raw = process.env.META_ADS_MAX_SCROLLS?.trim()
  const n = raw ? Number(raw) : 12
  return Number.isFinite(n) && n > 0 ? Math.min(30, Math.floor(n)) : 12
}
