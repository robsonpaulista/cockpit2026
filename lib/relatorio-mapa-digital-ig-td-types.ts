import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

export type RelatorioMapaDigitalIgEscopo = 'td' | 'pi'

export type RelatorioMapaDigitalIgResumoMunicipio = {
  /** Preenchido no export «PI todo» (12 TDs). */
  territorioTd?: TerritorioDesenvolvimentoPI
  /** Nome oficial do município no TD. */
  municipio: string
  rankIg: number
  lideres: number
  liderados: number
  comentarios: number
  perfisUnicos: number
  tempoMedioPostComentarioMs: number | null
  pctEngajamento: number
  classificacaoEngLabel: string
}

export type RelatorioMapaDigitalIgDetalheLinha = {
  territorioTd?: TerritorioDesenvolvimentoPI
  municipio: string
  liderNome: string
  liderTelefone: string
  lideradoNome: string
  lideradoWhatsapp: string
  lideradoInstagram: string
  lideradoStatus: string
  comentarios: number
  perfisUnicos: number
  tempoMedioPostComentarioMs: number | null
}

export type RelatorioMapaDigitalIgTotais = {
  mun: number
  lideres: number
  liderados: number
  com: number
  perf: number
  tempoPostComentarioSomaMs: number
  tempoPostComentarioN: number
}

export type RelatorioMapaDigitalIgTdPayload = {
  escopo: RelatorioMapaDigitalIgEscopo
  /** Texto do recorte (nome do TD ou «PI — todos os TDs»). */
  recorteDescricao: string
  geradoEm: string
  /** TD em foco quando `escopo === 'td'`; com `escopo === 'pi'` fica `null`. */
  territorio: TerritorioDesenvolvimentoPI | null
  postagensProcessadas: number
  resumoPorMunicipio: RelatorioMapaDigitalIgResumoMunicipio[]
  totais: RelatorioMapaDigitalIgTotais
  detalhes: RelatorioMapaDigitalIgDetalheLinha[]
}
