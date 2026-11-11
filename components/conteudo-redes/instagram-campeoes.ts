import { Download, Eye, Heart, MessageCircle, Share2, TrendingUp, type LucideIcon } from 'lucide-react'
import type { InstagramPost } from '@/hooks/use-instagram-redes'

export type CampeaoIndicadorId = 'likes' | 'comments' | 'views' | 'shares' | 'saves' | 'engagement'

export type CampeaoIndicador = {
  id: CampeaoIndicadorId
  titulo: string
  icone: LucideIcon
  valor: (post: InstagramPost) => number
}

export const CAMPEOES_INDICADORES: readonly CampeaoIndicador[] = [
  { id: 'likes', titulo: 'Mais curtidas', icone: Heart, valor: (p) => p.metrics.likes || 0 },
  { id: 'comments', titulo: 'Mais comentários', icone: MessageCircle, valor: (p) => p.metrics.comments || 0 },
  { id: 'views', titulo: 'Mais visualizações', icone: Eye, valor: (p) => p.metrics.views || 0 },
  { id: 'shares', titulo: 'Mais compartilhamentos', icone: Share2, valor: (p) => p.metrics.shares || 0 },
  { id: 'saves', titulo: 'Mais salvamentos', icone: Download, valor: (p) => p.metrics.saves || 0 },
  { id: 'engagement', titulo: 'Maior engajamento', icone: TrendingUp, valor: (p) => p.metrics.engagement || 0 },
]

export function maiorPorIndicador(
  posts: readonly InstagramPost[],
  valor: (post: InstagramPost) => number,
): InstagramPost | null {
  if (posts.length === 0) return null
  return posts.reduce((melhor, post) => (valor(post) > valor(melhor) ? post : melhor), posts[0])
}
