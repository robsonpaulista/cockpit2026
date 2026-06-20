/** Normaliza handle Instagram: remove @, trim, lowercase */
export function normalizeInstagramUsername(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let h = raw.trim()
  if (h.startsWith('@')) h = h.slice(1)
  if (h.includes('instagram.com/')) {
    try {
      const url = h.startsWith('http') ? h : `https://${h}`
      const path = new URL(url).pathname.replace(/^\/+|\/+$/g, '')
      h = path.split('/')[0] ?? h
    } catch {
      /* mantém valor */
    }
  }
  h = h.split('?')[0]?.split('/')[0] ?? h
  h = h.toLowerCase().replace(/[^a-z0-9._]/g, '')
  return h.length >= 1 ? h : null
}

export function instagramProfileUrl(username: string): string {
  return `https://www.instagram.com/${username}/`
}
