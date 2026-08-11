/** Hospedeiros permitidos para proxy de mídia do Instagram / Meta CDN. */
const ALLOWED_HOST_SUFFIXES = [
  '.cdninstagram.com',
  '.fbcdn.net',
  '.fbsbx.com',
  '.instagram.com',
] as const

const ALLOWED_HOSTS = new Set([
  'cdninstagram.com',
  'fbcdn.net',
  'fbsbx.com',
  'instagram.com',
  'www.instagram.com',
])

export function isAllowedInstagramCdnHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host) return false
  if (ALLOWED_HOSTS.has(host)) return true
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/**
 * Converte URL de CDN Instagram em rota same-origin, evitando bloqueio de
 * hotlink / Referrer-Policy do browser. Storage próprio e paths locais passam direto.
 */
export function proxiedInstagramMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const raw = url.trim()
  if (raw.startsWith('/')) return raw
  if (raw.includes('supabase.co/storage/')) return raw

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (!isAllowedInstagramCdnHost(parsed.hostname)) return raw

  return `/api/instagram-cdn-proxy?url=${encodeURIComponent(parsed.toString())}`
}
