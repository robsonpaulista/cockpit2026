export type ConteudoStatus = 'rascunho' | 'gerado' | 'aprovado' | 'publicado'

export type CardTemplate =
  | 'obra_impacto'
  | 'prestacao_contas'
  | 'cidade_beneficiada'
  | 'agenda_chegada'
  | 'frase_local'

export interface ConteudoPlanejadoRow {
  id: string
  obra_id: string | null
  agenda_id: string | null
  cidade: string | null
  territorio: string | null
  fase: string | null
  formato: string | null
  template: string | null
  titulo: string | null
  texto_arte: string | null
  legenda: string | null
  status: string
  storage_path_rascunho: string | null
  imagem_url: string | null
  storage_path: string | null
  campanha_geral: boolean
  data_sugerida: string | null
  created_at: string
}
