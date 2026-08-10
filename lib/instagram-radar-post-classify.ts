/**
 * Classificação de formato — Apify (concorrentes) e Graph (próprio).
 * DNA do Comparativo: Imagem | Reels | Carrossel (video feed conta como Reels).
 */

export type InstagramRadarFormat = 'image' | 'reel' | 'carousel' | 'video'

export function classifyInstagramRadarFormat(post: {
  post_type?: string | null
  post_url?: string | null
}): InstagramRadarFormat {
  const url = (post.post_url ?? '').toLowerCase()
  const type = (post.post_type ?? '').toLowerCase()

  if (
    url.includes('/reel/') ||
    type.includes('reel') ||
    type.includes('clips') ||
    type === 'clips'
  ) {
    return 'reel'
  }
  if (
    type.includes('sidecar') ||
    type.includes('carousel') ||
    type.includes('album')
  ) {
    return 'carousel'
  }
  if (type.includes('video') || type === 'ig_video') {
    return 'video'
  }
  return 'image'
}

/** Reels + vídeo (coluna Views/Reels e % Reels). */
export function isInstagramRadarReelLike(post: {
  post_type?: string | null
  post_url?: string | null
}): boolean {
  const format = classifyInstagramRadarFormat(post)
  return format === 'reel' || format === 'video'
}

export function instagramRadarContentMix(
  posts: Array<{ post_type?: string | null; post_url?: string | null }>,
): { image: number; reels: number; carousel: number } {
  if (posts.length === 0) return { image: 0, reels: 0, carousel: 0 }
  let image = 0
  let reels = 0
  let carousel = 0
  for (const p of posts) {
    const format = classifyInstagramRadarFormat(p)
    if (format === 'carousel') carousel += 1
    else if (format === 'reel' || format === 'video') reels += 1
    else image += 1
  }
  const total = posts.length
  const raw = [
    { key: 'image' as const, n: image },
    { key: 'reels' as const, n: reels },
    { key: 'carousel' as const, n: carousel },
  ]
  const floors = raw.map((r) => ({
    key: r.key,
    pct: Math.floor((r.n / total) * 100),
    frac: (r.n / total) * 100 - Math.floor((r.n / total) * 100),
  }))
  let rest = 100 - floors.reduce((s, f) => s + f.pct, 0)
  floors
    .slice()
    .sort((a, b) => b.frac - a.frac)
    .forEach((f) => {
      if (rest <= 0) return
      f.pct += 1
      rest -= 1
    })
  return {
    image: floors.find((f) => f.key === 'image')!.pct,
    reels: floors.find((f) => f.key === 'reels')!.pct,
    carousel: floors.find((f) => f.key === 'carousel')!.pct,
  }
}
