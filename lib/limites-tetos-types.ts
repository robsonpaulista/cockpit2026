export interface SuasFaixaPorte {
  ordem: number
  populacao_max: number | null
  porte: string
  valor: number
}

import type { ModalidadeLimite } from '@/lib/emenda-modalidade'

export interface LimiteMunicipioValor {
  valor: number | null
  ibge: string | null
  municipio_nome: string | null
}

/** Tetos MAC ou PAP por modalidade (individual / coletiva). */
export type LimitesMacPapPorModalidade = Record<ModalidadeLimite, LimiteMunicipioValor>

export interface LimitesMunicipioResponse {
  exercicio: number
  pap: LimitesMacPapPorModalidade
  mac: LimitesMacPapPorModalidade
  suas_faixas: SuasFaixaPorte[]
  classificacao_suas: {
    porte: string
    valor_formatado: string
    valor_numerico: number | null
  }
}

export const SUAS_FAIXAS_PADRAO: SuasFaixaPorte[] = [
  { ordem: 1, populacao_max: 20_000, porte: 'Pequeno Porte I', valor: 1_000_000 },
  { ordem: 2, populacao_max: 50_000, porte: 'Pequeno Porte II', valor: 2_300_000 },
  { ordem: 3, populacao_max: 100_000, porte: 'Médio Porte', valor: 4_100_000 },
  { ordem: 4, populacao_max: 900_000, porte: 'Grande Porte', valor: 8_800_000 },
  { ordem: 5, populacao_max: null, porte: 'Metrópole', valor: 22_700_000 },
]
