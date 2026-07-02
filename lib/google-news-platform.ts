export type GoogleNewsPlatform =
  | 'website'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'twitter'
  | 'tiktok'
  | 'linkedin'
  | 'other'

export type GoogleNewsCollectChannel = 'google_news_rss' | 'google_web' | 'google_videos'

export function inferGoogleNewsPlatform(url: string): GoogleNewsPlatform {
  try {
    const normalized = unwrapGoogleRedirectUrl(url)
    const host = new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase()

    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram'
    if (
      host === 'facebook.com' ||
      host === 'fb.com' ||
      host === 'fb.watch' ||
      host.endsWith('.facebook.com')
    ) {
      return 'facebook'
    }
    if (host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) {
      return 'youtube'
    }
    if (host === 'twitter.com' || host === 'x.com') return 'twitter'
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok'
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin'

    return 'website'
  } catch {
    return 'other'
  }
}

/** Desembrulha links /url?q=… do Google para inferir a plataforma real. */
export function unwrapGoogleRedirectUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('google.') && (u.pathname === '/url' || u.pathname === '/imgres')) {
      const target = u.searchParams.get('q') || u.searchParams.get('url')
      if (target?.startsWith('http')) return target
    }
  } catch {
    /* ignore */
  }
  return url
}

const SOCIAL_VIDEO_PLATFORMS: ReadonlySet<GoogleNewsPlatform> = new Set([
  'instagram',
  'facebook',
  'youtube',
  'tiktok',
  'twitter',
])

/** Plataformas típicas da aba Vídeos do Google (redes), não matérias de portal. */
export function isSocialVideoPlatform(platform: GoogleNewsPlatform): boolean {
  return SOCIAL_VIDEO_PLATFORMS.has(platform)
}

export function labelGoogleNewsPlatform(platform: GoogleNewsPlatform | string | null | undefined): string {
  switch (platform) {
    case 'instagram':
      return 'Instagram'
    case 'facebook':
      return 'Facebook'
    case 'youtube':
      return 'YouTube'
    case 'twitter':
      return 'X / Twitter'
    case 'tiktok':
      return 'TikTok'
    case 'linkedin':
      return 'LinkedIn'
    case 'website':
      return 'Site'
    default:
      return 'Outro'
  }
}

export function labelGoogleNewsCollectChannel(
  channel: GoogleNewsCollectChannel | string | null | undefined
): string {
  if (channel === 'google_web') return 'Busca Google'
  if (channel === 'google_videos') return 'Google Vídeos'
  return 'Google Notícias'
}
