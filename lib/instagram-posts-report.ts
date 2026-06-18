export type InstagramPostsMetric =
  | 'engagement'
  | 'likes'
  | 'comments'
  | 'views'
  | 'shares'

export type InstagramPostReportRow = {
  id: string
  type?: string
  url?: string
  caption?: string
  postedAt: string
  metrics: {
    likes: number
    comments: number
    shares: number
    saves: number
    views: number
    engagement: number
  }
}

export type InstagramPostsReportInput = {
  posts: InstagramPostReportRow[]
  metric: InstagramPostsMetric
  limit?: number
  username?: string
  highlightSingle?: boolean
}

function postEngagementScore(metrics: InstagramPostReportRow['metrics']): number {
  if (metrics.engagement > 0) return metrics.engagement
  return metrics.likes + metrics.comments * 2 + metrics.shares * 3
}

export function sortInstagramPostsByMetric(
  posts: InstagramPostReportRow[],
  metric: InstagramPostsMetric
): InstagramPostReportRow[] {
  const sorted = [...posts]

  switch (metric) {
    case 'likes':
      return sorted.sort((a, b) => b.metrics.likes - a.metrics.likes)
    case 'comments':
      return sorted.sort((a, b) => b.metrics.comments - a.metrics.comments)
    case 'views':
      return sorted.sort((a, b) => b.metrics.views - a.metrics.views)
    case 'shares':
      return sorted.sort((a, b) => b.metrics.shares - a.metrics.shares)
    default:
      return sorted.sort(
        (a, b) => postEngagementScore(b.metrics) - postEngagementScore(a.metrics)
      )
  }
}

function metricLabel(metric: InstagramPostsMetric): string {
  switch (metric) {
    case 'likes':
      return 'Mais Curtidas'
    case 'comments':
      return 'Mais Comentários'
    case 'views':
      return 'Mais Visualizações'
    case 'shares':
      return 'Mais Compartilhados'
    default:
      return 'Maior Engajamento'
  }
}

function postTypeLabel(type?: string): string {
  if (type === 'video') return '▶ Vídeo/Reel'
  if (type === 'carousel') return '◫ Carrossel'
  return '▣ Imagem'
}

function captionTitle(caption?: string): string {
  if (!caption?.trim()) return 'Sem legenda'
  const firstLine = caption.split('\n')[0].trim()
  return firstLine.length > 150 ? `${firstLine.slice(0, 150)}...` : firstLine
}

function formatPostMetrics(post: InstagramPostReportRow): string {
  const parts: string[] = []
  if (post.metrics.likes) parts.push(`♥ ${post.metrics.likes.toLocaleString('pt-BR')}`)
  if (post.metrics.comments) parts.push(`💬 ${post.metrics.comments.toLocaleString('pt-BR')}`)
  if (post.metrics.views) parts.push(`👁 ${post.metrics.views.toLocaleString('pt-BR')}`)
  if (post.metrics.shares) parts.push(`↗ ${post.metrics.shares.toLocaleString('pt-BR')}`)
  if (post.metrics.engagement) {
    parts.push(`⚡ ${post.metrics.engagement.toLocaleString('pt-BR')} engajamento`)
  }
  return parts.join(' | ')
}

export function formatInstagramPostsReport(input: InstagramPostsReportInput): string {
  const { posts, metric, limit = 5, username, highlightSingle = false } = input

  if (posts.length === 0) {
    return (
      'Não encontrei publicações no período analisado.\n\n' +
      'Acesse **Redes & Instagram** para sincronizar os posts.'
    )
  }

  const sorted = sortInstagramPostsByMetric(posts, metric)
  const titulo = metricLabel(metric)
  const header = username
    ? `**${titulo} — @${username}**`
    : `**${titulo} — Instagram**`

  if (highlightSingle) {
    const top = sorted[0]
    const data = new Date(top.postedAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    let resposta = `${header}\n\n`
    resposta += `**${captionTitle(top.caption)}**\n`
    resposta += `${postTypeLabel(top.type)} — publicado em ${data}\n`
    resposta += `${formatPostMetrics(top)}\n`
    if (top.url) resposta += `🔗 ${top.url}\n`

    if (sorted.length > 1) {
      resposta += `\n**Próximos no ranking:**\n`
      sorted.slice(1, Math.min(4, limit)).forEach((post, index) => {
        const postDate = new Date(post.postedAt).toLocaleDateString('pt-BR')
        resposta += `› ${index + 2}. ${captionTitle(post.caption)} (${postDate}) — ${formatPostMetrics(post)}\n`
      })
    }

    resposta +=
      '\n_Abra **Redes & Instagram** → **Posts & Insights** para ver o ranking completo e campeões por métrica._'
    return resposta
  }

  let resposta = `${header}\n\n`
  sorted.slice(0, limit).forEach((post, index) => {
    const data = new Date(post.postedAt).toLocaleDateString('pt-BR')
    resposta += `**${index + 1}. ${captionTitle(post.caption)}**\n`
    resposta += `${postTypeLabel(post.type)} — ${data}\n`
    resposta += `${formatPostMetrics(post)}\n\n`
  })

  resposta +=
    '_Dados das publicações analisadas em **Redes & Instagram** (últimos ~30 dias)._'
  return resposta
}
