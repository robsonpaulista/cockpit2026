/** Mesma regra de identificador da página Redes & Instagram. */
export function getInstagramPostIdentifier(post: {
  id: string
  postedAt?: string
  caption?: string
}): string {
  if (post.id) return post.id
  if (post.postedAt && post.caption) {
    const dateStr = new Date(post.postedAt).toISOString().split('T')[0]
    const captionHash = post.caption.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    return `${dateStr}_${captionHash}`
  }
  return `post_${Date.now()}`
}

export type PostMetricasInstagram = {
  likes: number
  comments: number
  views: number
  shares: number
  saves: number
  engagement: number
}

export type PostComMetricas = {
  id: string
  postedAt: string
  caption: string
  metrics: PostMetricasInstagram
}

export type ThemeStatsRow = {
  posts: number
  likes: number
  comments: number
  views: number
  shares: number
  saves: number
  engagement: number
  avgLikes: number
  avgComments: number
  avgViews: number
  avgShares: number
  avgSaves: number
  avgEngagement: number
}

export function aggregateThemeStatsByClassification(
  posts: PostComMetricas[],
  classMap: Record<string, { theme: string }>
): Record<string, ThemeStatsRow> {
  const stats: Record<string, ThemeStatsRow> = {}

  for (const post of posts) {
    const identifier = getInstagramPostIdentifier(post)
    const theme = classMap[identifier]?.theme ?? classMap[post.id]?.theme
    if (!theme) continue

    if (!stats[theme]) {
      stats[theme] = {
        posts: 0,
        likes: 0,
        comments: 0,
        views: 0,
        shares: 0,
        saves: 0,
        engagement: 0,
        avgLikes: 0,
        avgComments: 0,
        avgViews: 0,
        avgShares: 0,
        avgSaves: 0,
        avgEngagement: 0,
      }
    }

    const s = stats[theme]
    s.posts += 1
    s.likes += post.metrics.likes
    s.comments += post.metrics.comments
    s.views += post.metrics.views
    s.shares += post.metrics.shares
    s.saves += post.metrics.saves
    s.engagement += post.metrics.engagement
  }

  for (const theme of Object.keys(stats)) {
    const s = stats[theme]
    s.avgLikes = s.posts > 0 ? Math.round(s.likes / s.posts) : 0
    s.avgComments = s.posts > 0 ? Math.round(s.comments / s.posts) : 0
    s.avgViews = s.posts > 0 ? Math.round(s.views / s.posts) : 0
    s.avgShares = s.posts > 0 ? Math.round(s.shares / s.posts) : 0
    s.avgSaves = s.posts > 0 ? Math.round(s.saves / s.posts) : 0
    s.avgEngagement = s.posts > 0 ? Math.round(s.engagement / s.posts) : 0
  }

  return stats
}

export function sortThemesByAvgEngagement(
  stats: Record<string, ThemeStatsRow>
): Array<[string, ThemeStatsRow]> {
  return Object.entries(stats).sort(([, a], [, b]) => b.avgEngagement - a.avgEngagement)
}

export function formatThemeStatsBullet(theme: string, stats: ThemeStatsRow): string {
  return (
    `${theme}: ${stats.posts} ${stats.posts === 1 ? 'postagem' : 'postagens'} · ` +
    `média ${stats.avgLikes.toLocaleString('pt-BR')} curtidas · ` +
    `${stats.avgComments.toLocaleString('pt-BR')} comentários · ` +
    `${stats.avgViews.toLocaleString('pt-BR')} visualizações · ` +
    `${stats.avgShares.toLocaleString('pt-BR')} compartilhamentos · ` +
    `${stats.avgSaves.toLocaleString('pt-BR')} salvamentos · ` +
    `${stats.avgEngagement.toLocaleString('pt-BR')} engajamento`
  )
}

/** Formato curto para resumo operacional (não lista todas as métricas). */
export function formatThemeResumoCurto(theme: string, stats: ThemeStatsRow): string {
  const postsLabel = stats.posts === 1 ? '1 post' : `${stats.posts} posts`
  return `${theme} (${postsLabel}, eng. médio ${stats.avgEngagement.toLocaleString('pt-BR')})`
}

const RESUMO_DIGITAL_TOP_TEMAS = 3

/** Bullets enxutos de temas para resumo operacional. */
export function buildDigitalTemaResumoItens(
  sortedThemes: Array<[string, ThemeStatsRow]>
): string[] {
  if (sortedThemes.length === 0) return []

  const itens: string[] = []
  const totalPosts = sortedThemes.reduce((sum, [, s]) => sum + s.posts, 0)
  itens.push(
    `${totalPosts.toLocaleString('pt-BR')} publicações classificadas em ${sortedThemes.length} temas`
  )

  const top = sortedThemes.slice(0, RESUMO_DIGITAL_TOP_TEMAS)
  itens.push(
    `Melhor engajamento: ${top.map(([t, s]) => formatThemeResumoCurto(t, s)).join(' · ')}`
  )

  const [volumeTheme, volumeStats] = [...sortedThemes].sort(([, a], [, b]) => b.posts - a.posts)[0]
  const topNames = new Set(top.map(([t]) => t))
  if (volumeStats.posts >= 3 && !topNames.has(volumeTheme)) {
    itens.push(`Maior volume: ${formatThemeResumoCurto(volumeTheme, volumeStats)}`)
  }

  const restantes = sortedThemes.length - top.length
  if (restantes > 0) {
    itens.push(
      `+${restantes} ${restantes === 1 ? 'tema' : 'temas'} — detalhe completo em Redes & Instagram`
    )
  }

  return itens
}
