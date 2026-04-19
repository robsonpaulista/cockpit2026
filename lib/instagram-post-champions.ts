/** Post com métricas mínimas para ranking (Instagram / dashboard). */
export type InstagramPostMetricsRow = {
  id: string
  thumbnail: string
  caption: string
  url: string
  metrics: {
    likes: number
    comments: number
    engagement: number
    views?: number
    shares?: number
    saves?: number
  }
}

export type InstagramPostChampions = {
  bestLikes: InstagramPostMetricsRow
  bestComments: InstagramPostMetricsRow
  bestViews: InstagramPostMetricsRow
  bestShares: InstagramPostMetricsRow
  bestSaves: InstagramPostMetricsRow
  bestEngagement: InstagramPostMetricsRow
}

export function buildInstagramPostChampions(
  posts: InstagramPostMetricsRow[]
): InstagramPostChampions | null {
  if (posts.length === 0) return null
  const pick = (better: (a: InstagramPostMetricsRow, b: InstagramPostMetricsRow) => boolean) =>
    posts.reduce((a, b) => (better(a, b) ? a : b))

  return {
    bestLikes: pick((a, b) => a.metrics.likes >= b.metrics.likes),
    bestComments: pick((a, b) => a.metrics.comments >= b.metrics.comments),
    bestViews: pick((a, b) => (a.metrics.views ?? 0) >= (b.metrics.views ?? 0)),
    bestShares: pick((a, b) => (a.metrics.shares ?? 0) >= (b.metrics.shares ?? 0)),
    bestSaves: pick((a, b) => (a.metrics.saves ?? 0) >= (b.metrics.saves ?? 0)),
    bestEngagement: pick((a, b) => a.metrics.engagement >= b.metrics.engagement),
  }
}
