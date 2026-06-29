export type TipoPesquisaPublico = 'opiniao' | 'eleitoral'

export type PlanoAmostragemBloco = {
  id: string
  nome: string
  pesoPct: number
  entrevistas: number
  tipo: 'urbano' | 'rural' | 'transicao'
  notas?: string
}

export type PlanoAmostragemCota = {
  perfil: string
  meta: number
  pct: number
}

export type PlanoAmostragemEquipe = {
  entrevistador: number
  entrevistas: number
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
