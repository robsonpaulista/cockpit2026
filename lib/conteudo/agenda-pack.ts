import type { CardTemplate } from '@/lib/conteudo/types'

export interface AgendaConteudoSeed {
  fase: string
  formato: string
  template: CardTemplate
}

/** Pacote automático de 6 conteúdos ao vincular agenda à obra (spec MVP). */
export const AGENDA_CONTEUDO_PACK: AgendaConteudoSeed[] = [
  { fase: 'antes', formato: 'story', template: 'cidade_beneficiada' },
  { fase: 'antes', formato: 'card', template: 'obra_impacto' },
  { fase: 'durante', formato: 'card', template: 'agenda_chegada' },
  { fase: 'durante', formato: 'reels_capa', template: 'cidade_beneficiada' },
  { fase: 'depois', formato: 'card', template: 'prestacao_contas' },
  { fase: 'depois', formato: 'story', template: 'frase_local' },
]

/** Três conteúdos base ao clicar "Gerar conteúdos" na obra. */
export const OBRA_CONTEUDO_SEEDS: AgendaConteudoSeed[] = [
  { fase: 'obra', formato: 'card', template: 'obra_impacto' },
  { fase: 'obra', formato: 'card', template: 'prestacao_contas' },
  { fase: 'obra', formato: 'card', template: 'cidade_beneficiada' },
]
