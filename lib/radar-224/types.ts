/**
 * Radar 224 — tipos do catálogo de fontes e recorte top 50.
 */

import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

export type RadarFonteCamada =
  | 'estadual'
  | 'regional'
  | 'local'
  | 'oficial'
  | 'rede_social'
  | 'conteudo_politico'

export type RadarFonteStatus = 'ativa' | 'candidata' | 'pausada' | 'rejeitada'

export type RadarFonteSelo =
  | 'Imprensa estadual'
  | 'Imprensa regional'
  | 'Portal local'
  | 'Fonte oficial'
  | 'Rede social'
  | 'Conteúdo político'

export type RadarFonte = {
  id: string
  nome: string
  camada: RadarFonteCamada
  selo: RadarFonteSelo
  url: string
  /** Domínio para matching futuro (Google News / scrape). */
  dominio: string
  /** Nota interna 0–100 (qualidade / prioridade). */
  nota: number
  status: RadarFonteStatus
  /** TDs cobertos (regionais) ou vazio = estadual / amplo. */
  territorios: TerritorioDesenvolvimentoPI[]
  /** Municípios prioritários cobertos (quando conhecidos). */
  municipiosPrioritarios: string[]
  coberturaResumo: string
  notasOperacionais?: string
}

export type RadarMunicipioPrioritario = {
  rank: number
  municipio: string
  municipioNormalizado: string
  expectativaLegado: number
  pctEstado: number
  territorio: TerritorioDesenvolvimentoPI | null
  liderancas: number
  fontesRegionais: string[]
  fontesLocais: string[]
}

export type Radar224Resumo = {
  totalEstadoLegado: number
  topN: number
  topNLegado: number
  topNPctEstado: number
  corteMinimoLegado: number
  cidadesComExpectativa: number
  fontesAtivas: number
  fontesCandidatas: number
  territoriosCobertos: number
}
