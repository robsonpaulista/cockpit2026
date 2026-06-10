export type AgentPageKind = 'dashboard' | 'resumo-eleicoes' | 'campo' | 'other'

export type AgentIntent =
  | 'ajuda'
  | 'resposta_direta'
  | 'consultar_pesquisas'
  | 'consultar_demandas'
  | 'consultar_agendas'
  | 'consultar_visitas_campo'
  | 'consultar_expectativa'
  | 'consultar_liderancas'
  | 'consultar_chapa'
  | 'consultar_instagram_metricas'
  | 'consultar_instagram_posts'
  | 'consultar_instagram_tipo'
  | 'consultar_instagram_tema'
  | 'consultar_territorio'
  | 'consultar_alertas'
  | 'consultar_noticias_destaque'
  | 'consultar_territorios_frios'
  | 'enviar_whatsapp'
  | 'navegar'
  | 'resumo_buscar_cidade'
  | 'resumo_abrir_demandas'
  | 'resumo_abrir_liderancas'
  | 'resumo_abrir_pesquisas'
  | 'resumo_fechar_modais'
  | 'desconhecido'

export interface AgentChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentContextPayload {
  pageKind?: AgentPageKind
  cidadeAtual?: string
  buscaIniciada?: boolean
  candidatoPadrao?: string
  cidadesDisponiveis?: string[]
  alertsCriticosCount?: number
  territoriosFriosCount?: number
  pollsCount?: number
  expectativa2026?: string | number
  presencaTerritorial?: string
}

export interface AgentClassifiedIntent {
  intent: AgentIntent
  args: Record<string, string>
  direct_reply?: string | null
}

export interface AgentChatRequest {
  message: string
  history?: AgentChatMessage[]
  context?: AgentContextPayload
  sessionId?: string
}

export interface AgentNavigateAction {
  type: 'navigate'
  url: string
  label: string
}

export interface AgendaScopePending {
  cidade?: string
  dateIso: string
  dateLabel: string
  timePeriod?: 'manha' | 'tarde' | 'noite' | null
}

export interface PesquisaTipoChoicePending {
  termo: string
  cidade: string
  data: string
  instituto: string
  focoJadyel?: boolean
}

export interface AgentChatResponse {
  source: 'groq' | 'fallback'
  content: string
  /** Quando a ação precisa do código legado no cliente (pageContext, Instagram localStorage). */
  clientQuery?: string
  action?: AgentNavigateAction
  /** Aguardando usuário escolher estimulada ou espontânea. */
  pesquisaTipoPending?: PesquisaTipoChoicePending
  /** Aguardando usuário escolher próximos ou todos (agenda de hoje). */
  agendaScopePending?: AgendaScopePending
  /** Segmentos para TTS com pausa (ex.: agenda — um compromisso por frase). */
  speechSegments?: string[]
  meta?: {
    intent?: AgentIntent
    rateLimited?: boolean
    groqUnavailable?: boolean
  }
}
