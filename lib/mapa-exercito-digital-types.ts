import type { ExercitoDigitalAudience } from '@/lib/mandatos-instagram-piaui'
import type { LideradoIgEngajamentoLinha } from '@/lib/mobilizacao-lideres-desempenho-ig-por-td-client'

export type AlertPostStatus = 'Crítico' | 'Atenção'

export type LeaderTrendKind =
  | 'growing'
  | 'falling'
  | 'stable'
  | 'accelerating'
  | 'inactive'

export type LeaderStatusDot = 'green' | 'amber' | 'red' | 'gray'

export type LeaderFilterTab = 'todos' | 'ativos' | 'em-queda' | 'inativos'

/** Filtro por tipo/cargo no ranking unificado. */
export type LeaderCargoFilter = 'todos' | 'rede' | 'prefeito' | 'vereador'

export type ExercitoDigitalAlertPost = {
  id: string
  status: AlertPostStatus
  title: string
  meta: string
  ativados: number
  naoAtivados: number
}

export type LeaderBaseTipo = 'lider' | 'mandato'

export type ExercitoDigitalLeaderRow = {
  id: string
  rank: number
  /** Rede de mobilização (líder) ou mandatário da planilha. */
  tipo: LeaderBaseTipo
  nome: string
  /** @ normalizados do perfil (mandatário) ou da rede de liderados (líder). */
  handles: string[]
  /** Cargo do mandatário (`Prefeito` / `Vereador`); null para líder de rede. */
  cargo: string | null
  /** Município do mandatário, quando aplicável. */
  municipio: string | null
  comentarios: number
  /** Posts em que o mandatário/liderado comentou no período */
  publicacoes: number
  /** Total de posts da conta monitorada no período */
  postsNoPeriodo: number
  ativacaoPct: number
  /** Comentários por mês (M-4 … mês de referência). */
  monthlyCounts: number[]
  trendKind: LeaderTrendKind
  trendLabel: string
  trendDeltaPct: number | null
  statusDot: LeaderStatusDot
  /** Comentários no mês de referência. */
  mesAtual: number
  /** Comentários no mês anterior ao de referência. */
  mesAnterior: number
  variacaoPct: number | null
  consistencia: string
  lideradosComRede: number
  lideradosQueComentaram: number
  /** Meses consecutivos sem comentários até o mês de referência. */
  inactiveMonths: number
  /** Detalhamento por @ — só para `tipo === 'lider'`. */
  lideradosInstagram?: string[]
  lideradosEngajamento?: LideradoIgEngajamentoLinha[]
}

export type ExercitoDigitalCityRow = {
  rank: number
  municipio: string
  comentarios: number
  ativacaoPct: number
  /** Comentários por mês (M-4 … mês de referência). */
  monthlyCounts: number[]
}

export type ExercitoDigitalTrendPoint = {
  label: string
  pctLiderados: number
  pctOrganicos: number
  sortMs: number
}

export type ExercitoDigitalKpis = {
  ativacaoPct: number
  lideresAtivados: number
  lideresMedidos: number
  metaPct: number
  abaixoMeta: boolean
  comentariosTotal: number
  comentariosLiderados: number
  comentariosOrganicos: number
  perfisOrganicos: number
  municipiosCriticos: number
  publicacoesAnalisadas: number
}

export type ExercitoDigitalAccumulatedLeaderRow = {
  id: string
  rank: number
  nome: string
  tipo: LeaderBaseTipo
  handles: string[]
  cargo: string | null
  comentarios: number
}

export type ExercitoDigitalViewModel = {
  audience: ExercitoDigitalAudience
  lookbackDays: number
  /** Mês de referência do placar (YYYY-MM). */
  referenceMonth: string
  referenceMonthLabel: string
  /** Janela do ranking acumulado (90, 60 ou dias disponíveis na base). */
  accumulatedWindowDays: number
  kpis: ExercitoDigitalKpis
  alertPosts: ExercitoDigitalAlertPost[]
  leaders: ExercitoDigitalLeaderRow[]
  accumulatedLeaders: ExercitoDigitalAccumulatedLeaderRow[]
  cities: ExercitoDigitalCityRow[]
  trend: ExercitoDigitalTrendPoint[]
  organicTail: { comentarios: number; perfis: number }
}
