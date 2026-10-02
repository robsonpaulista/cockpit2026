import type { ArenaBadge, ArenaLevel } from '@/lib/arena/types'

export const ARENA_LEVELS: ArenaLevel[] = [
  { id: 1, name: 'Recruta', minPoints: 0 },
  { id: 2, name: 'Apoiador', minPoints: 300 },
  { id: 3, name: 'Militante', minPoints: 900 },
  { id: 4, name: 'Embaixador', minPoints: 1800 },
  { id: 5, name: 'Lenda da Arena', minPoints: 3000 },
]

export const ARENA_BADGES: ArenaBadge[] = [
  {
    id: 'primeira_curtida',
    label: 'Primeira curtida',
    description: '≥1 curtida no período',
  },
  {
    id: 'voz_ativa',
    label: 'Voz ativa',
    description: '≥150 comentários no período',
  },
  {
    id: 'sequencia_3',
    label: 'Sequência de 3 dias',
    description: 'Streak ≥3 dias seguidos interagindo',
  },
  {
    id: 'comentarista_relampago',
    label: 'Comentarista relâmpago',
    description: '≥10 comentários na 1ª hora do post',
  },
  {
    id: 'fiel',
    label: 'Fiel à campanha',
    description: 'Engajamento ≥70% dos posts do período',
  },
  {
    id: 'top_10',
    label: 'Top 10',
    description: 'Entre os 10 primeiros do ranking geral',
  },
]

export const SCORING_RULES = [
  {
    id: 'comentario',
    action: 'Comentário',
    points: '10–14 pts',
    source: 'API oficial do Instagram',
    sourceKind: 'api_oficial' as const,
  },
  {
    id: 'cedo',
    action: 'Comentar cedo (≤1h)',
    points: '+8 pts',
    source: 'Calculado (timestamp do comentário)',
    sourceKind: 'interno' as const,
  },
  {
    id: 'curtida',
    action: 'Curtida no post',
    points: '+3 pts',
    source: 'Verificação periódica (scraper)',
    sourceKind: 'scraper' as const,
  },
  {
    id: 'fidelidade',
    action: 'Fidelidade (≥70% dos posts)',
    points: '+15% do subtotal',
    source: 'Sistema interno',
    sourceKind: 'interno' as const,
  },
] as const
