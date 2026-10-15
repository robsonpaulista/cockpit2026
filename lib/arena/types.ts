/** Tipos da Arena de Apoiadores (modelo §4 do spec). */

export type ArenaLeader = {
  id: string
  name: string
  city: string | null
}

export type ArenaLevel = {
  id: 1 | 2 | 3 | 4 | 5
  name: string
  minPoints: number
}

export type ArenaBadgeId =
  | 'primeira_curtida'
  | 'voz_ativa'
  | 'sequencia_3'
  | 'comentarista_relampago'
  | 'fiel'
  | 'top_10'

export type ArenaBadge = {
  id: ArenaBadgeId
  label: string
  description: string
}

export type ArenaViewerRole = 'admin' | 'lideranca' | 'apoiador'

export type ArenaPerfilPapel = 'lideranca' | 'liderado'

/** Pontuação calculada pelas métricas da Arena a partir dos comentários sincronizados. */
export type PontuacaoPerfil = {
  pontos: number
  pontosComentario: number
  bonusCedo: number
  pontosCurtida: number
  bonusFidelidade: number
  comentarios: number
  comentariosPontuados: number
  comentariosCedo: number
  postsComentados: number
  postsNoPeriodo: number
  taxaEngajamento: number
  sequenciaDias: number
  ultimoComentario: string | null
  nivel: ArenaLevel
  proximoNivel: ArenaLevel | null
  progressoNivel: number
  conquistas: ArenaBadgeId[]
}

/** Perfil da Arena (cadastro em `public.arena_perfis`) com a pontuação do período. */
export type ArenaPerfil = PontuacaoPerfil & {
  id: string
  nome: string
  instagram: string
  papel: ArenaPerfilPapel
  cidade: string | null
  regiao: string | null
  /** Posição no ranking do período (1 = mais pontos). */
  posicao: number
}

export type ArenaIntervalo = {
  /** Datas `AAAA-MM-DD`, inclusivas, no fuso de Brasília. */
  inicio: string
  fim: string
}
