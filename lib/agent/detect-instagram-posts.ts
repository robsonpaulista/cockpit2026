import type { AgentClassifiedIntent } from '@/lib/agent/types'
import type { InstagramPostsMetric } from '@/lib/instagram-posts-report'

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const POST_TERMS =
  /\b(post(?:s)?|publicac(?:ao|oes)|foto(?:s)?|video(?:s)?|reels?|conteudo(?:s)?|feed|stories?)\b/

const RANKING_TERMS =
  /\b(maior|melhor(?:es)?|top|destaque|campeao|campea|lider|ranking|mais\s+curtid|mais\s+coment|mais\s+visualiz|mais\s+compartilh|posts?\s+mais|qual\s+(?:foi\s+)?(?:o\s+)?(?:meu\s+)?post)\b/

const METRIC_TERMS =
  /\b(engajament|curtida(?:s)?|likes?|comentari(?:o|os)|visualizac(?:ao|oes)|views?|compartilh|interac(?:ao|oes))\b/

/** Pergunta pede um post específico (campeão), não só ranking genérico. */
export function isInstagramSinglePostQuery(query: string): boolean {
  const q = norm(query)
  return (
    /\bqual\s+(?:foi\s+)?(?:o\s+)?(?:meu\s+)?post\b/.test(q) ||
    /\bmeu\s+post\s+com\b/.test(q) ||
    /\bpost\s+com\s+maior\b/.test(q) ||
    /\bqual\s+publicac/.test(q)
  )
}

export function parseInstagramPostsMetric(query: string): InstagramPostsMetric {
  const q = norm(query)

  if (/\b(curtid|curtiu|likes?)\b/.test(q)) return 'likes'
  if (/\b(comentari|comment)\b/.test(q)) return 'comments'
  if (/\b(visualiz|views?|assistiu|viu)\b/.test(q) && !/\bperfil\b/.test(q)) return 'views'
  if (/\b(compartilh|shares?)\b/.test(q)) return 'shares'

  return 'engagement'
}

/**
 * Ranking de publicações (post com maior engajamento, mais curtidos, etc.).
 * Não inclui tema/tipo agregado nem seguidores.
 */
export function isInstagramPostsQuery(query: string): boolean {
  const q = norm(query)

  if (/\b(tema|assunto|classificac|por\s+tipo|formato\s+de\s+conteudo)\b/.test(q)) {
    return false
  }

  if (/\b(seguidor|followers?)\b/.test(q) && !POST_TERMS.test(q)) {
    return false
  }

  const mentionsPost = POST_TERMS.test(q)
  const mentionsRanking = RANKING_TERMS.test(q)
  const mentionsMetric = METRIC_TERMS.test(q)

  if (mentionsPost && (mentionsRanking || mentionsMetric)) return true

  if (
    mentionsMetric &&
    /\b(instagram|insta|rede\s+social|perfil)\b/.test(q) &&
    !/\b(seguidor|followers?|perfil\s+visit)\b/.test(q)
  ) {
    return true
  }

  if (/\bposts?\s+mais\b/.test(q)) return true

  return false
}

export function detectInstagramPostsIntent(query: string): AgentClassifiedIntent | null {
  if (!isInstagramPostsQuery(query)) return null

  const metric = parseInstagramPostsMetric(query)

  return {
    intent: 'consultar_instagram_posts',
    args: {
      metrica: metric,
      modo: isInstagramSinglePostQuery(query) ? 'destaque' : 'ranking',
      termo: query.slice(0, 160),
    },
  }
}
