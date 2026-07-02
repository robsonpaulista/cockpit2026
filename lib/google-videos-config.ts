/**
 * Google Vídeos — piloto castração / causa animal (Playwright, aba Vídeos tbm=vid / udm=7).
 */

export function getGoogleVideosMaxItems(): number {
  const raw = process.env.GOOGLE_VIDEOS_MAX_ITEMS?.trim()
  const n = raw ? Number(raw) : 30
  return Number.isFinite(n) && n > 0 ? Math.min(50, Math.floor(n)) : 30
}

export function getGoogleVideosLanguage(): string {
  return process.env.GOOGLE_VIDEOS_LANGUAGE?.trim() || 'pt-BR'
}

export function getGoogleVideosCountry(): string {
  return process.env.GOOGLE_VIDEOS_COUNTRY?.trim() || 'br'
}

/** Descarta links de portais — só Instagram, YouTube, Facebook etc. */
export function isGoogleVideosSocialOnly(): boolean {
  const raw = process.env.GOOGLE_VIDEOS_SOCIAL_ONLY?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return true
}

/** Exige Teresina/Piauí no título, snippet ou URL — desligado por padrão (termos já são locais). */
export function isGoogleVideosLocalFilterEnabled(): boolean {
  const raw = process.env.GOOGLE_VIDEOS_LOCAL_FILTER?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

/** Cooldown entre coletas (padrão 7 dias). */
export function getGoogleVideosCooldownMs(): number {
  const raw = process.env.GOOGLE_VIDEOS_COOLDOWN_DAYS?.trim()
  const days = raw ? Number(raw) : 7
  if (!Number.isFinite(days) || days <= 0) return 7 * 24 * 60 * 60 * 1000
  return Math.min(30, Math.floor(days)) * 24 * 60 * 60 * 1000
}

export function isGoogleVideosCooldownEnabled(): boolean {
  const skip = process.env.GOOGLE_VIDEOS_SKIP_COOLDOWN?.trim().toLowerCase()
  return !(skip === '1' || skip === 'true' || skip === 'yes')
}
