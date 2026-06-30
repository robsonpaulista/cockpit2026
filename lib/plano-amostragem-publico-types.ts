export type TipoPesquisaPublico = 'opiniao' | 'eleitoral'

export type PlanoAmostragemBloco = {
  id: string
  nome: string
  /** Percentual dentro do estrato (urbano ou rural). */
  pesoPct: number
  /** Percentual sobre a amostra total (N). */
  pctAmostra: number
  entrevistas: number
  tipo: 'urbano' | 'rural' | 'transicao'
  notas?: string
  /** Setores IBGE que compõem o bloco (individual ou agrupado). */
  setorIds?: string[]
}

export type PlanoAmostragemAlocacaoBloco = {
  blocoId: string
  blocoNome: string
  entrevistas: number
}

export type PlanoAmostragemCota = {
  perfil: string
  meta: number
  pct: number
}

export type PlanoAmostragemEquipe = {
  entrevistador: number
  entrevistas: number
  /** Alocação exata por bloco — fonte de verdade para fichas. */
  alocacao: PlanoAmostragemAlocacaoBloco[]
  blocosSugeridos: string
}

export type PlanoAmostragemPublico = {
  municipio: string
  codigoIbge: string
  territorio: string | null
  populacaoCenso2022: number
  populacaoEstimada: number
  anoEstimativa: number | null
  taxaUrbanaPct: number
  taxaRuralPct: number
  eleitorado: number | null
  amostraTotal: number
  /** Meta de entrevistas na zona urbana (fecha com amostraRural = amostraTotal). */
  amostraUrbana: number
  /** Meta de entrevistas na zona rural. */
  amostraRural: number
  entrevistadoresPrevistos: number
  tipoPesquisa: TipoPesquisaPublico
  institutoDestino: string | null
  geradoEm: string
  metodologiaResumo: string
  divisaoTerritorial: PlanoAmostragemBloco[]
  cotasSexo: PlanoAmostragemCota[]
  cotasIdade: PlanoAmostragemCota[]
  cotasHorario: PlanoAmostragemCota[]
  equipeCampo: PlanoAmostragemEquipe[]
  regrasCampo: string[]
  regrasSorteio: string[]
  auditoria: string[]
  avisos: string[]
  bairrosReferencia: string[]
}
