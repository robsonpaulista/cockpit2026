export type FluxoEtapaStatus = 'ok' | 'parcial' | 'pendente'

export type FluxoEngajamentoNivel = 'alto' | 'medio' | 'baixo'

export type FluxoEtapaId =
  | 'planejado'
  | 'produzido'
  | 'enviado'
  | 'divulgado'
  | 'visita'
  | 'pos_visita'
  | 'concluido'

export type FluxoEtapaResumo = {
  id: FluxoEtapaId
  label: string
  cidades: number
  pct: number
}

export type FluxoKpi = {
  id: string
  label: string
  valor: string
  detalhe: string
  deltaPct: number
}

export type FluxoTipoConteudo = {
  id: string
  label: string
  pct: number
  cor: string
}

export type FluxoMunicipioRow = {
  municipio: string
  prioridade?: string
  etapas: Record<FluxoEtapaId, FluxoEtapaStatus>
  conteudos: number
  engajamento: FluxoEngajamentoNivel
}

export type FluxoRetorno = {
  id: string
  label: string
  valor: string
  deltaPct: number
}

export type FluxoBandeira = {
  id: string
  nome: string
  pct: number
}

export type FluxoDestaque = {
  id: string
  titulo: string
  local: string
  data: string
  rede: 'instagram' | 'facebook' | 'tiktok'
  alcance: string
  curtidas: string
}

export type FluxoAcao = {
  id: string
  quantidade: number
  rotulo: string
  tom: 'ok' | 'alerta' | 'info'
}

export type FluxoDigitalResumo = {
  escopoLabel: string
  periodoLabel: string
  atualizadoEm: string
  etapas: FluxoEtapaResumo[]
  kpis: FluxoKpi[]
  tipos: FluxoTipoConteudo[]
  totalConteudos: number
  municipios: FluxoMunicipioRow[]
  retornos: FluxoRetorno[]
  bandeiras: FluxoBandeira[]
  destaques: FluxoDestaque[]
  acoes: FluxoAcao[]
}

export type VisitaPlanejadaFluxo = {
  id: string
  date: string | null
  cidade: string
  description: string | null
  hora_evento: string | null
  obra_nome: string | null
  status: string | null
}

export type PlanejamentoFluxoFromAgenda = {
  fonte: 'agendas'
  atualizadoEm: string
  de: string
  ate: string | null
  visitasPlanejadas: number
  municipiosUnicos: number
  municipios: string[]
  eventos: VisitaPlanejadaFluxo[]
}
