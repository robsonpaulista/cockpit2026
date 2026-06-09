export type AlertPostStatus = 'Crítico' | 'Atenção'

export type LeaderTrendKind =
  | 'growing'
  | 'falling'
  | 'stable'
  | 'accelerating'
  | 'inactive'

export type LeaderStatusDot = 'green' | 'amber' | 'red' | 'gray'

export type LeaderFilterTab = 'todos' | 'ativos' | 'em-queda' | 'inativos'

export type ExercitoDigitalAlertPost = {
  id: string
  status: AlertPostStatus
  title: string
  meta: string
  ativados: number
  naoAtivados: number
}

export type ExercitoDigitalLeaderRow = {
  id: string
  rank: number
  nome: string
  comentarios: number
  publicacoes: number
  ativacaoPct: number
  weeklyCounts: number[]
  trendKind: LeaderTrendKind
  trendLabel: string
  trendDeltaPct: number | null
  statusDot: LeaderStatusDot
  semanaAtual: number
  semanaAnterior: number
  variacaoPct: number | null
  consistencia: string
  lideradosComRede: number
  lideradosQueComentaram: number
  inactiveWeeks: number
}

export type ExercitoDigitalCityRow = {
  municipio: string
  comentarios: number
  ativacaoPct: number
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

export type ExercitoDigitalViewModel = {
  lookbackDays: number
  kpis: ExercitoDigitalKpis
  alertPosts: ExercitoDigitalAlertPost[]
  leaders: ExercitoDigitalLeaderRow[]
  cities: ExercitoDigitalCityRow[]
  trend: ExercitoDigitalTrendPoint[]
  organicTail: { comentarios: number; perfis: number }
}
