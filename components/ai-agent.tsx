'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bot, Sparkles, TrendingUp, AlertTriangle, MapPin, BarChart3, CheckCircle2, Send, ExternalLink, ArrowRight, Loader2, Users, Calendar, Vote, FileText, Flag, Target, Building2, Clock, CheckCheck, XCircle, Circle, ChevronRight, Zap, Mic, HelpCircle, Instagram, Heart, Eye, Share2, Image, Video, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JarvisHudShell } from '@/components/jarvis/jarvis-hud-shell'
import type { JarvisLogLine } from '@/components/jarvis/jarvis-hud-widgets'
import { jarvisHudStyle } from '@/lib/jarvis-hud-tokens'
import { getAgentSessionId } from '@/lib/agent/client-session'
import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import { parseAgendaDayScopeFromAnswer } from '@/lib/agent/agenda-query'
import {
  type AgendaReplyResult,
  resolveAgendaReply,
} from '@/lib/agent/resolve-agenda-reply'
import {
  filterPesquisasByTermo,
  parsePesquisaTipoFromQuery,
  queryMentionsJadyelAlencar,
  resolvePesquisasReply,
  type PesquisaTipo,
} from '@/lib/agent/format-pesquisas'
import {
  formatNoticiasDestaqueReply,
  mapNoticiasApiRows,
  queryAsksNoticiasDestaque,
} from '@/lib/agent/format-noticias'
import {
  startSpeechKeepAlive,
  stopSpeechKeepAlive,
  unlockJarvisAudio,
} from '@/lib/agent/audio-unlock'
import { extractCityNameFromQuery } from '@/lib/agent/city-extract'
import { isCampoVisitasQuery } from '@/lib/agent/detect-visitas-campo'
import { resolveVisitasCampoReply, type CampoAgendaRow } from '@/lib/agent/format-visitas-campo'
import {
  buildGreetingReply,
  buildHelpReply,
  buildUnknownQueryReply,
  isGreetingQuery,
  isHelpQuery,
} from '@/lib/agent/greeting-reply'
import {
  detectExpectativaDetalheFollowUp,
  EXPECTATIVA_DETALHE_DISMISS_REPLY,
  isExpectativaDetalheAffirmative,
  isExpectativaDetalheNegative,
} from '@/lib/agent/expectativa-detalhe-followup'
import {
  buildSidebarNavigateReply,
  detectSidebarNavigate,
  type SidebarNavigateResult,
} from '@/lib/agent/detect-sidebar-navigate'
import {
  pickJarvisLoadingPhrase,
  shouldPlayJarvisLoadingPhrase,
} from '@/lib/agent/jarvis-loading-phrase'
import {
  parseJarvisResultContent,
  shouldShowJarvisResultPopup,
  type JarvisResultView,
} from '@/lib/agent/jarvis-result-view'
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '@/lib/agent/speech-output'
import type {
  AgentChatResponse,
  AgentContextPayload,
  AgendaScopePending,
  PesquisaTipoChoicePending,
} from '@/lib/agent/types'

interface DataInsight {
  id: string
  icon: React.ReactNode
  message: string
  type: 'loading' | 'success' | 'warning' | 'info'
  loaded: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  viaAi?: boolean
  /** Segmentos para TTS com pausa (ex.: um compromisso por frase na agenda). */
  speechSegments?: string[]
  action?: {
    type: 'navigate' | 'link'
    url: string
    label: string
  }
  /** Navegação explícita pedida pelo usuário — abre a rota sem exigir clique no botão. */
  autoNavigate?: boolean
}

type AIAgentResumoEleicoesContext = {
  kind: 'resumo-eleicoes'
  cidades: string[]
  cidadeAtual: string
  buscaIniciada: boolean
  loadingCidades: boolean
  loadingDados: boolean
  selecionarCidadeEBuscar: (nomeCidade: string) => void | Promise<void>
  /** Fluxo Demandas (botão da página → modal de lideranças) */
  seletorDemandasAberto: boolean
  seletorDemandasCarregando: boolean
  liderancasDemandasDisponiveis: string[]
  abrirFluxoDemandas: () => void | Promise<void>
  fecharSeletorDemandas: () => void
  /** Todas + Ver demandas selecionadas (com pequeno atraso para o React aplicar seleção) */
  confirmarDemandasTodasLiderancas: () => Promise<void>
  /** Só estes nomes (exatos da lista) + Ver demandas selecionadas */
  confirmarDemandasComLiderancasNomes: (nomes: string[]) => Promise<void>
  /** Card KPI visível (busca com dados + resumo) — mesmos requisitos dos links "Clique para ver detalhes" */
  painelResumoCardsVisivel: boolean
  /** Modal do card Lideranças ("Clique para ver detalhes") */
  abrirDetalhesLiderancasCard: () => void
  /** Modal do card Pesquisas ("Clique para ver detalhes") */
  abrirDetalhesPesquisasCard: () => void
  modalLiderancasAberto: boolean
  modalPesquisasAberto: boolean
  modalDemandasCidadeAberto: boolean
  fecharModalLiderancas: () => void
  fecharModalPesquisas: () => void
  fecharModalDemandasCidade: () => void
}

type AIAgentCampoContext = {
  kind: 'campo'
  cidades: string[]
  totalAgendas: number
}

/** Contexto da página atual — o agente pode acionar a UI (ex.: Resumo Eleições). */
export type AIAgentPageContext = AIAgentResumoEleicoesContext | AIAgentCampoContext

interface AIAgentProps {
  loadingKPIs: boolean
  loadingPolls: boolean
  loadingTerritorios: boolean
  loadingAlerts: boolean
  loadingBandeiras: boolean
  kpisCount?: number
  expectativa2026?: number | string
  presencaTerritorial?: string
  pollsCount?: number
  candidatoPadrao?: string
  territoriosFriosCount?: number
  alertsCriticosCount?: number
  bandeirasCount?: number
  bandeirasPerformance?: number
  criticalAlerts?: Array<{ id: string; title: string; actionUrl?: string }>
  territoriosFrios?: Array<{ cidade: string; motivo: string; expectativaVotos?: number; visitas?: number }>
  enableVoice?: boolean
  /** Abre direto no chat (sem sequência de insights) — útil em páginas como Resumo Eleições */
  immediateChatMode?: boolean
  /** Quando definido, o agente pode executar ações específicas desta tela */
  pageContext?: AIAgentPageContext
  /** fixed = canto da tela; inline = no fluxo da página (rola com o conteúdo) */
  dockVariant?: 'fixed' | 'inline'
  /** Nome exibido no cabeçalho do painel (padrão: Copilot IA) */
  agentTitle?: string
  /** Altura máxima do painel expandido (px) */
  maxPanelHeight?: number
  /** default = card Cockpit; jarvis-hud = interface neural estilo referência JARVIS */
  uiVariant?: 'default' | 'jarvis-hud'
  /** Jarvis HUD ocupa 100% da área útil do dashboard (home) */
  fullPageHud?: boolean
  /** full = home; compact = bolha flutuante nas demais páginas */
  hudLayout?: 'full' | 'compact'
  /** Ao entrar em páginas internas, inicia recolhido como bolha */
  floatingMode?: boolean
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly 0: { readonly transcript: string }
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number
  readonly results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike

async function diagnoseSpeechNotAllowed(): Promise<string> {
  let micState: PermissionState | null = null
  try {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      micState = result.state
    }
  } catch {
    micState = null
  }

  if (micState === 'granted') {
    return [
      'O Chrome indica microfone PERMITIDO, mas o reconhecimento de voz retornou not-allowed.',
      '',
      'Causa comum em apps Next.js: cabeçalho HTTP Permissions-Policy com microphone=() — isso bloqueia microfone para todo o site, independente do macOS.',
      'Correção: use microphone=(self) no next.config.mjs, reinicie o servidor (npm run dev) e recarregue a página.',
      '',
      'Se já estiver assim: teste janela anônima e feche Teams/Meet/Discord que possam estar segurando o microfone.',
    ].join('\n')
  }

  return [
    'O navegador negou o microfone para ESTE site (código not-allowed).',
    '',
    'Chrome / Edge: ícone à esquerda da URL → Permissões / Configurações do site → Microfone → Permitir.',
    'Confira também: chrome://settings/content/microphone e remova bloqueio para este domínio.',
    'No macOS: Ajustes do Sistema → Privacidade e Segurança → Microfone → Google Chrome.',
    'Depois recarregue a página (F5) e clique no microfone de novo.',
  ].join('\n')
}

function speechRecognitionErrorMessage(
  error: string | undefined,
  ctx?: { isSecureContext: boolean },
): string | null {
  switch (error) {
    case 'not-allowed':
      if (typeof window !== 'undefined' && ctx && !ctx.isSecureContext) {
        return [
          'O navegador trata este endereço como INSEGURO (por exemplo http://192.168.x.x ou outro IP na rede local).',
          'Nesse modo o microfone costuma ser bloqueado mesmo que você “libere” algo nas configurações.',
          'Solução: acesse o app por HTTPS, ou use http://localhost ou http://127.0.0.1 na máquina onde o servidor roda.',
        ].join('\n')
      }
      return [
        'O navegador negou o microfone para ESTE site (código not-allowed).',
        '',
        'Chrome / Edge: ícone à esquerda da URL → Permissões / Configurações do site → Microfone → Permitir.',
        'Confira também: chrome://settings/content/microphone e remova bloqueio para este domínio.',
        'Depois recarregue a página (F5) e clique no microfone de novo.',
      ].join('\n')
    case 'no-speech':
      return 'Não detectei fala. Fale mais perto do microfone ou verifique o áudio.'
    case 'audio-capture':
      return 'Não foi possível acessar o microfone (dispositivo ocupado ou sem microfone).'
    case 'network':
      return 'Erro de rede no reconhecimento de voz. Verifique a conexão.'
    case 'aborted':
      return null
    default:
      return error ? `Erro de voz: ${error}` : 'Não foi possível usar o microfone.'
  }
}

// Normalizar texto para busca
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Função para normalizar números (mesma lógica da página território)
function normalizeNumber(value: any): number {
  if (typeof value === 'number') return value
  
  const str = String(value).trim()
  if (!str) return 0
  
  let cleaned = str.replace(/[^\d.,]/g, '')
  
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts.length === 2) {
      // Se tem 3 dígitos após vírgula = separador de milhar (ex: 1,000 = 1000)
      if (parts[1].length === 3) {
        cleaned = cleaned.replace(/,/g, '')
      } else if (parts[1].length <= 2) {
        // 1-2 dígitos após vírgula = separador decimal (ex: 1,50 = 1.50)
        cleaned = cleaned.replace(',', '.')
      } else {
        cleaned = cleaned.replace(/,/g, '')
      }
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  }
  
  const numValue = parseFloat(cleaned)
  return isNaN(numValue) ? 0 : numValue
}

function extractCityName(query: string): string | null {
  return extractCityNameFromQuery(query)
}

function buildSidebarNavChatMessage(result: SidebarNavigateResult): ChatMessage {
  if (result.kind === 'ambiguous') {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: [
        'Encontrei mais de uma página:',
        '',
        ...result.candidates.map((c) => `› **${c.label}**`),
        '',
        'Seja mais específico, por exemplo: «abrir território e base» ou «ir para WhatsApp».',
      ].join('\n'),
    }
  }

  return {
    id: Date.now().toString(),
    role: 'assistant',
    content: buildSidebarNavigateReply(result),
    action: {
      type: 'navigate',
      url: result.target.href,
      label: result.target.label,
    },
    autoNavigate: result.kind === 'navigate' || result.kind === 'home',
  }
}

/** Cruza a fala/texto com os nomes exatos do dropdown de Resumo Eleições */
function resolveCidadeResumoEleicoesDropdown(query: string, cidades: string[]): string | null {
  const q = normalizeText(query)
  if (!q || cidades.length === 0) return null

  const pares = cidades.map((c) => ({ original: c, norm: normalizeText(c) }))

  for (const { original, norm } of pares) {
    if (norm && q === norm) return original
  }

  let melhor: string | null = null
  let melhorLen = 0
  for (const { original, norm } of pares) {
    if (!norm) continue
    if (q.includes(norm) && norm.length >= melhorLen) {
      melhor = original
      melhorLen = norm.length
    }
  }
  if (melhor) return melhor

  for (const { original, norm } of pares) {
    if (norm.includes(q) && q.length >= 3) return original
  }

  return null
}

/** Cruza texto do usuário com nomes exatos da lista do modal de demandas */
function resolverLiderancasMencionadas(query: string, liderancas: string[]): string[] {
  const q = normalizeText(query)
  if (!q || liderancas.length === 0) return []

  const found: string[] = []
  for (const nome of liderancas) {
    const n = normalizeText(nome)
    if (n.length < 2) continue
    if (q.includes(n)) found.push(nome)
  }
  if (found.length > 0) return [...new Set(found)]

  const stopTerms =
    /\b(todas|todos|cancelar|fechar|voltar|desisto|listar|lideranças|liderancas|demandas|pedidos|abrir|ver|só|somente|apenas|quero|nao|não)\b/gi
  const qSemStop = q.replace(stopTerms, ' ').replace(/\s+/g, ' ').trim()

  const segmentos = qSemStop
    .split(/\s+e\s+|\s*,\s*|\s+ou\s+|\s+e\s+a\s+|\/+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)

  for (const seg of segmentos) {
    for (const nome of liderancas) {
      const n = normalizeText(nome)
      if (n.includes(seg) || seg.includes(n)) {
        found.push(nome)
      }
    }
  }
  return [...new Set(found)]
}

export function AIAgent({
  loadingKPIs,
  loadingPolls,
  loadingTerritorios,
  loadingAlerts,
  loadingBandeiras,
  kpisCount = 0,
  expectativa2026,
  presencaTerritorial,
  pollsCount = 0,
  candidatoPadrao,
  territoriosFriosCount = 0,
  alertsCriticosCount = 0,
  bandeirasCount = 0,
  bandeirasPerformance = 0,
  criticalAlerts = [],
  territoriosFrios = [],
  enableVoice = false,
  immediateChatMode = false,
  pageContext,
  dockVariant = 'fixed',
  agentTitle = 'Copilot IA',
  maxPanelHeight = 600,
  uiVariant = 'default',
  fullPageHud = false,
  hudLayout = 'full',
  floatingMode = false,
}: AIAgentProps) {
  const isJarvisHud = uiVariant === 'jarvis-hud'
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [isMinimized, setIsMinimized] = useState(() => floatingMode)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showAgent, setShowAgent] = useState(true)
  const [completedMessages, setCompletedMessages] = useState<string[]>([])
  
  // Chat interativo
  const [chatMode, setChatMode] = useState<boolean>(() => Boolean(immediateChatMode))
  const [userInput, setUserInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechCapabilityResolved, setSpeechCapabilityResolved] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const pendingSpeechRef = useRef('')
  const stopSpeakingReplyRef = useRef<(() => void) | null>(null)
  const pageContextRef = useRef<AIAgentPageContext | undefined>(undefined)
  pageContextRef.current = pageContext

  const wasFullPageHudRef = useRef(fullPageHud)
  useEffect(() => {
    if (fullPageHud) {
      setIsMinimized(false)
    } else if (floatingMode && wasFullPageHudRef.current) {
      setIsMinimized(true)
    }
    wasFullPageHudRef.current = fullPageHud
  }, [floatingMode, fullPageHud])

  const [resumoDemandasAssistPhase, setResumoDemandasAssistPhase] = useState<
    'idle' | 'awaiting_lideranca_escopo'
  >('idle')
  const [pesquisaTipoPending, setPesquisaTipoPending] =
    useState<PesquisaTipoChoicePending | null>(null)
  const [expectativaDetalhePending, setExpectativaDetalhePending] = useState<{
    cidade: string
  } | null>(null)
  const expectativaDetalhePendingRef = useRef<{ cidade: string } | null>(null)
  const [agendaScopePending, setAgendaScopePending] = useState<AgendaScopePending | null>(null)
  const agendaScopePendingRef = useRef<AgendaScopePending | null>(null)
  const [jarvisResultPopup, setJarvisResultPopup] = useState<{
    id: string
    view: JarvisResultView
    action?: ChatMessage['action']
  } | null>(null)
  const jarvisLoadingSpeechRef = useRef(false)
  const jarvisPendingAnswerRef = useRef<{ content: string; segments?: string[] } | null>(null)

  const syncAgendaScopePending = useCallback((pending: AgendaScopePending | null) => {
    agendaScopePendingRef.current = pending
    setAgendaScopePending(pending)
  }, [])

  const syncExpectativaDetalhePending = useCallback((pending: { cidade: string } | null) => {
    expectativaDetalhePendingRef.current = pending
    setExpectativaDetalhePending(pending)
  }, [])
  const resumoEleicoesCidadeChave =
    pageContext?.kind === 'resumo-eleicoes' ? pageContext.cidadeAtual : ''

  useEffect(() => {
    setResumoDemandasAssistPhase('idle')
    setPesquisaTipoPending(null)
    syncExpectativaDetalhePending(null)
    syncAgendaScopePending(null)
  }, [resumoEleicoesCidadeChave, syncAgendaScopePending, syncExpectativaDetalhePending])

  // Scroll automático para última mensagem
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  // Gerar insights baseados nos dados
  const insights = useMemo<DataInsight[]>(() => {
    const list: DataInsight[] = []

    if (loadingKPIs) {
      list.push({
        id: 'kpis-loading',
        icon: <BarChart3 className="w-4 h-4" />,
        message: 'Analisando indicadores de performance...',
        type: 'loading',
        loaded: false,
      })
    } else if (expectativa2026) {
      let kpiMessage = `Expectativa 2026: ${typeof expectativa2026 === 'number' ? expectativa2026.toLocaleString('pt-BR') : expectativa2026} votos`
      if (presencaTerritorial) {
        kpiMessage += ` | Presença: ${presencaTerritorial}`
      }
      list.push({
        id: 'kpis-done',
        icon: <TrendingUp className="w-4 h-4" />,
        message: kpiMessage,
        type: 'success',
        loaded: true,
      })
    }

    if (loadingAlerts) {
      list.push({
        id: 'alerts-loading',
        icon: <AlertTriangle className="w-4 h-4" />,
        message: 'Verificando alertas...',
        type: 'loading',
        loaded: false,
      })
    } else if (alertsCriticosCount > 0) {
      list.push({
        id: 'alerts-done',
        icon: <AlertTriangle className="w-4 h-4" />,
        message: `${alertsCriticosCount} alerta${alertsCriticosCount > 1 ? 's' : ''} crítico${alertsCriticosCount > 1 ? 's' : ''}!`,
        type: 'warning',
        loaded: true,
      })
    }

    if (loadingTerritorios) {
      list.push({
        id: 'territorios-loading',
        icon: <MapPin className="w-4 h-4" />,
        message: 'Analisando territórios...',
        type: 'loading',
        loaded: false,
      })
    } else if (territoriosFriosCount > 0) {
      list.push({
        id: 'territorios-done',
        icon: <MapPin className="w-4 h-4" />,
        message: `${territoriosFriosCount} território${territoriosFriosCount > 1 ? 's' : ''} frio${territoriosFriosCount > 1 ? 's' : ''}`,
        type: 'warning',
        loaded: true,
      })
    }

    return list
  }, [loadingKPIs, loadingAlerts, loadingTerritorios, expectativa2026, presencaTerritorial, alertsCriticosCount, territoriosFriosCount])

  // ==================== FUNÇÕES DE BUSCA ====================

  // Buscar dados de expectativa e lideranças por cidade
  const fetchExpectativaCidade = async (
    cidade: string,
    options?: { detalhe?: boolean }
  ): Promise<string> => {
    const incluirLiderancas = options?.detalhe ?? false
    try {
      // 1. Primeiro verificar configuração do servidor (variáveis de ambiente)
      let config = null
      try {
        const serverConfigRes = await fetch('/api/territorio/config')
        const serverConfig = await serverConfigRes.json()
        if (serverConfig.configured) {
          config = {} // Servidor usa variáveis de ambiente
        }
      } catch (e) {
        // Continuar para localStorage
      }
      
      // 2. Fallback: localStorage (apenas se servidor não configurado)
      if (!config && typeof window !== 'undefined') {
        const savedConfig = localStorage.getItem('territorio_sheets_config')
        if (savedConfig) {
          config = JSON.parse(savedConfig)
        }
      }

      if (!config) {
        return `Não encontrei configuração de território. A configuração deve ser feita via variáveis de ambiente no servidor.`
      }

      const response = await fetch('/api/territorio/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        return `Erro ao buscar dados do território.`
      }

      const data = await response.json()
      const records = data.records || []
      const headers = data.headers || []
      
      // Encontrar colunas
      const cidadeCol = headers.find((h: string) => /cidade|city|município/i.test(h)) || headers[1]
      const expectativaCol = headers.find((h: string) => /expectativa.*votos.*2026/i.test(h) && !/jadyel|nome|pessoa/i.test(h))
      const nomeCol = headers.find((h: string) => /nome|name|lider|pessoa/i.test(h)) || headers[0]
      const telefoneCol = headers.find((h: string) => /telefone|phone|celular|whatsapp/i.test(h))
      const funcaoCol = headers.find((h: string) => /função|funcao|cargo|papel/i.test(h))
      
      if (!cidadeCol) {
        return `Não encontrei a coluna de cidade na planilha.`
      }

      // Buscar registros da cidade
      const cidadeNorm = normalizeText(cidade)
      const registrosCidade = records.filter((r: Record<string, unknown>) => {
        const nomeCidade = normalizeText(String(r[cidadeCol] || ''))
        return nomeCidade.includes(cidadeNorm) || cidadeNorm.includes(nomeCidade)
      })

      if (registrosCidade.length === 0) {
        return `Não encontrei registros para "${cidade}". Verifique o nome da cidade.`
      }

      // Calcular totais
      let totalExpectativa = 0
      const liderancas: Array<{ nome: string; expectativa: number; funcao?: string }> = []
      
      registrosCidade.forEach((r: Record<string, unknown>) => {
        let expectativa = 0
        if (expectativaCol && r[expectativaCol]) {
          expectativa = normalizeNumber(r[expectativaCol])
          totalExpectativa += expectativa
        }
        if (nomeCol && r[nomeCol]) {
          liderancas.push({
            nome: String(r[nomeCol]),
            expectativa: Math.round(expectativa),
            funcao: funcaoCol ? String(r[funcaoCol] || '') : undefined
          })
        }
      })

      // Ordenar por expectativa
      liderancas.sort((a, b) => b.expectativa - a.expectativa)

      const cidadeFormatada = cidade.charAt(0).toUpperCase() + cidade.slice(1).toLowerCase()
      const totalFormatado = Math.round(totalExpectativa).toLocaleString('pt-BR')
      const qtdLiderancas = registrosCidade.length

      if (!incluirLiderancas) {
        return [
          `**${cidadeFormatada}**`,
          '',
          `Expectativa 2026: **${totalFormatado} votos**`,
          `Lideranças cadastradas: **${qtdLiderancas}**`,
          '',
          'Quer que eu detalhe a expectativa por liderança?',
        ].join('\n')
      }

      let resposta = `**${cidadeFormatada}**\n\n`
      resposta += `Expectativa 2026: **${totalFormatado} votos**\n`
      resposta += `Lideranças: **${qtdLiderancas}**`
      
      if (liderancas.length > 0 && liderancas.length <= 8) {
        resposta += `\n\n**Lideranças:**\n`
        liderancas.forEach(l => {
          resposta += `› ${l.nome}`
          if (l.expectativa > 0) resposta += ` (${l.expectativa.toLocaleString('pt-BR')} votos)`
          if (l.funcao) resposta += ` — ${l.funcao}`
          resposta += '\n'
        })
      } else if (liderancas.length > 8) {
        resposta += `\n\n**Top 8 Lideranças:**\n`
        liderancas.slice(0, 8).forEach(l => {
          resposta += `› ${l.nome}`
          if (l.expectativa > 0) resposta += ` (${l.expectativa.toLocaleString('pt-BR')} votos)`
          resposta += '\n'
        })
        resposta += `+ ${liderancas.length - 8} liderança(s)`
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar expectativa:', error)
      return `Erro ao buscar dados. Tente novamente.`
    }
  }

  // Buscar lideranças detalhadas de uma cidade
  const fetchLiderancasCidade = async (cidade: string): Promise<string> => {
    try {
      // 1. Primeiro verificar configuração do servidor (variáveis de ambiente)
      let config = null
      try {
        const serverConfigRes = await fetch('/api/territorio/config')
        const serverConfig = await serverConfigRes.json()
        if (serverConfig.configured) {
          config = {} // Servidor usa variáveis de ambiente
        }
      } catch (e) {
        // Continuar para localStorage
      }
      
      // 2. Fallback: localStorage (apenas se servidor não configurado)
      if (!config && typeof window !== 'undefined') {
        const savedConfig = localStorage.getItem('territorio_sheets_config')
        if (savedConfig) {
          config = JSON.parse(savedConfig)
        }
      }

      if (!config) {
        return `Não encontrei configuração de território. A configuração deve ser feita via variáveis de ambiente no servidor.`
      }

      const response = await fetch('/api/territorio/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        return `Erro ao buscar dados do território.`
      }

      const data = await response.json()
      const records = data.records || []
      const headers = data.headers || []
      
      // Encontrar colunas
      const cidadeCol = headers.find((h: string) => /cidade|city|município/i.test(h)) || headers[1]
      const nomeCol = headers.find((h: string) => /nome|name|lider|pessoa/i.test(h)) || headers[0]
      const telefoneCol = headers.find((h: string) => /telefone|phone|celular|whatsapp|contato/i.test(h))
      const funcaoCol = headers.find((h: string) => /função|funcao|cargo|papel|atuação/i.test(h))
      const expectativaCol = headers.find((h: string) => /expectativa.*votos.*2026/i.test(h) && !/jadyel|nome|pessoa/i.test(h))
      const bairroCol = headers.find((h: string) => /bairro|região|regiao|localidade/i.test(h))
      
      if (!cidadeCol) {
        return `Não encontrei a coluna de cidade na planilha.`
      }

      // Buscar registros da cidade
      const cidadeNorm = normalizeText(cidade)
      const registrosCidade = records.filter((r: Record<string, unknown>) => {
        const nomeCidade = normalizeText(String(r[cidadeCol] || ''))
        return nomeCidade.includes(cidadeNorm) || cidadeNorm.includes(nomeCidade)
      })

      if (registrosCidade.length === 0) {
        return `Não encontrei lideranças em "${cidade}".`
      }

      const cidadeFormatada = cidade.charAt(0).toUpperCase() + cidade.slice(1).toLowerCase()
      let resposta = `**Lideranças em ${cidadeFormatada}**\n\n`
      resposta += `Total: **${registrosCidade.length}** liderança(s)\n\n`

      // Mostrar detalhes
      const maxShow = 10
      const liderancasOrdenadas = [...registrosCidade].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        if (!expectativaCol) return 0
        const va = normalizeNumber(a[expectativaCol] || '0')
        const vb = normalizeNumber(b[expectativaCol] || '0')
        return vb - va
      })

      liderancasOrdenadas.slice(0, maxShow).forEach((r: Record<string, unknown>, i: number) => {
        resposta += `**${i + 1}. ${r[nomeCol] || 'Sem nome'}**\n`
        if (funcaoCol && r[funcaoCol]) resposta += `   Função: ${r[funcaoCol]}\n`
        if (bairroCol && r[bairroCol]) resposta += `   Bairro: ${r[bairroCol]}\n`
        if (expectativaCol && r[expectativaCol]) {
          const exp = normalizeNumber(r[expectativaCol])
          if (exp > 0) resposta += `   Votos 2026: ${Math.round(exp).toLocaleString('pt-BR')}\n`
        }
        resposta += '\n'
      })

      if (registrosCidade.length > maxShow) {
        resposta += `+ ${registrosCidade.length - maxShow} liderança(s)`
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar lideranças:', error)
      return `Erro ao buscar lideranças. Tente novamente.`
    }
  }

  type AgendaFetchOutcome =
    | { kind: 'data'; content: string; speechSegments?: string[] }
    | { kind: 'ask_scope'; content: string; pending: AgendaScopePending }
    | { kind: 'error'; content: string }

  const buildNoticiasDestaqueChatMessage = useCallback(async (): Promise<ChatMessage> => {
    try {
      const response = await fetch('/api/noticias?dashboard_highlight=true&limit=8')
      if (!response.ok) {
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Não consegui acessar as notícias em destaque.',
        }
      }

      const rows = mapNoticiasApiRows((await response.json()) as unknown[])
      const formatted = formatNoticiasDestaqueReply(rows)

      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: formatted.content,
        speechSegments: formatted.speechSegments,
        action: {
          type: 'navigate',
          url: '/dashboard/noticias',
          label: 'Ver Notícias & Crises',
        },
      }
    } catch (error) {
      console.error('Erro ao buscar notícias em destaque:', error)
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Erro ao buscar notícias em destaque. Tente novamente.',
      }
    }
  }, [])

  const fetchCampoVisitasOutcome = useCallback(async (
    query: string,
    options?: { cidade?: string }
  ): Promise<{ content: string; speechSegments?: string[] }> => {
    try {
      const response = await fetch('/api/campo/agendas')
      if (!response.ok) {
        return { content: 'Não consegui acessar as visitas do módulo Campo & Agenda.' }
      }
      const agendas = (await response.json()) as CampoAgendaRow[]
      if (!Array.isArray(agendas)) {
        return { content: 'Não consegui ler as agendas de campo.' }
      }
      return resolveVisitasCampoReply(agendas, query, {
        cidade: options?.cidade,
      })
    } catch (error) {
      console.error('Erro ao buscar visitas de campo:', error)
      return { content: 'Erro ao buscar visitas de campo. Tente novamente.' }
    }
  }, [])

  const fetchAgendaOutcome = useCallback(async (
    query: string,
    options?: {
      cidade?: string
      scopePending?: AgendaScopePending
      dayScope?: 'upcoming' | 'all'
    }
  ): Promise<AgendaFetchOutcome> => {
    try {
      const response = await fetch('/api/agenda/events')
      if (!response.ok) {
        return { kind: 'error', content: 'Não consegui acessar a agenda do Google Calendar.' }
      }

      const payload = (await response.json()) as {
        events?: CalendarEventRow[]
        error?: string
      }

      if (payload.error) return { kind: 'error', content: payload.error }

      const events = payload.events ?? []
      if (events.length === 0) {
        return { kind: 'error', content: 'Não há eventos na agenda configurada.' }
      }

      const result: AgendaReplyResult = resolveAgendaReply(events, query, {
        cidade: options?.cidade,
        scopePending: options?.scopePending,
        dayScope: options?.dayScope,
        maxItems: 8,
      })

      if (result.kind === 'ask_scope') {
        return { kind: 'ask_scope', content: result.content, pending: result.pending }
      }

      if (result.kind === 'error') {
        return { kind: 'error', content: result.content }
      }

      return {
        kind: 'data',
        content: result.content,
        speechSegments: result.speechSegments,
      }
    } catch (error) {
      console.error('Erro ao buscar agenda:', error)
      return { kind: 'error', content: 'Erro ao buscar a agenda. Tente novamente.' }
    }
  }, [])

  const buildAgendaChatMessage = useCallback((
    outcome: AgendaFetchOutcome,
    options?: { viaAi?: boolean }
  ): ChatMessage => {
    if (outcome.kind === 'ask_scope') {
      syncAgendaScopePending(outcome.pending)
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: outcome.content,
        viaAi: options?.viaAi,
      }
    }

    syncAgendaScopePending(null)
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: outcome.content,
      speechSegments: outcome.kind === 'data' ? outcome.speechSegments : undefined,
      viaAi: options?.viaAi,
      action:
        outcome.kind === 'data'
          ? {
              type: 'navigate',
              url: '/dashboard/agenda',
              label: 'Ver Agenda',
            }
          : undefined,
    }
  }, [syncAgendaScopePending])

  // Buscar projeção da chapa federal
  const fetchProjecaoChapa = async (): Promise<string> => {
    try {
      const response = await fetch('/api/chapas/projecao-republicanos')
      if (!response.ok) {
        return `Erro ao buscar projeção da chapa.`
      }

      const data = await response.json()
      
      if (data.message && !data.eleitos) {
        return `**Projeção Chapa Federal**\n\n${data.message}\n\nAcesse a página Chapas para configurar o cenário base.`
      }

      let resposta = `**Projeção Chapa Federal**\n\n`
      resposta += `**${data.partido}**: ${data.eleitos} deputado${data.eleitos !== 1 ? 's' : ''} eleito${data.eleitos !== 1 ? 's' : ''}\n`
      
      if (data.cenario) {
        resposta += `Cenário: ${data.cenario}\n`
      }
      
      if (data.quociente) {
        resposta += `Quociente Eleitoral: ${data.quociente.toLocaleString('pt-BR')}\n`
      }

      // Mostrar candidatos do Republicanos
      if (data.candidatos && data.candidatos.length > 0) {
        resposta += `\n**Candidatos REPUBLICANOS:**\n`
        data.candidatos.forEach((c: { nome: string; votos: number; eleito: boolean }) => {
          const status = c.eleito ? '●' : '○'
          resposta += `${status} ${c.nome}: ${c.votos.toLocaleString('pt-BR')} votos${c.eleito ? ' — Eleito' : ''}\n`
        })
        
        // Votos de legenda
        if (data.votosLegenda && data.votosLegenda > 0) {
          resposta += `Votos de Legenda: ${data.votosLegenda.toLocaleString('pt-BR')}\n`
        }
      }

      // Mostrar distribuição se existir
      if (data.distribuicao && data.distribuicao.length > 0) {
        resposta += `\n**Distribuição por partido:**\n`
        data.distribuicao
          .filter((p: { vagas: number }) => p.vagas > 0)
          .sort((a: { vagas: number }, b: { vagas: number }) => b.vagas - a.vagas)
          .forEach((p: { partido: string; vagas: number; votosLegenda?: number }) => {
            let linha = `› ${p.partido}: ${p.vagas} vaga${p.vagas !== 1 ? 's' : ''}`
            if (p.votosLegenda && p.votosLegenda > 0) {
              linha += ` (legenda: ${p.votosLegenda.toLocaleString('pt-BR')})`
            }
            resposta += linha + '\n'
          })
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar projeção:', error)
      return `Erro ao buscar projeção. Tente novamente.`
    }
  }

  // Buscar demandas de uma cidade
  const fetchDemandasCidade = async (cidade: string): Promise<string> => {
    try {
      // Usar API com filtro por cidade
      const response = await fetch(`/api/campo/demands?cidade=${encodeURIComponent(cidade)}`)
      if (!response.ok) {
        return `Erro ao buscar demandas.`
      }

      const demandas = await response.json()

      if (demandas.length === 0) {
        return `Não encontrei demandas registradas em "${cidade}".`
      }

      const cidadeFormatada = cidade.charAt(0).toUpperCase() + cidade.slice(1).toLowerCase()
      let resposta = `**Demandas em ${cidadeFormatada}**\n\n`

      resposta += `Total: **${demandas.length}** demanda${demandas.length !== 1 ? 's' : ''}\n\n`

      // Agrupar por status
      const statusGroups: Record<string, any[]> = {}
      demandas.forEach((d: any) => {
        const status = d.status || 'Sem status'
        if (!statusGroups[status]) {
          statusGroups[status] = []
        }
        statusGroups[status].push(d)
      })

      // Mostrar por status
      Object.keys(statusGroups).forEach(status => {
        const grupo = statusGroups[status]
        resposta += `**${status}:** ${grupo.length}\n`
        grupo.slice(0, 3).forEach((d: any) => {
          resposta += `› ${d.title || 'Sem título'}`
          if (d.lideranca) resposta += ` (${d.lideranca})`
          resposta += '\n'
        })
        if (grupo.length > 3) {
          resposta += `+ ${grupo.length - 3} mais\n`
        }
        resposta += '\n'
      })

      return resposta
    } catch (error) {
      console.error('Erro ao buscar demandas:', error)
      return `Erro ao buscar demandas. Tente novamente.`
    }
  }

  // Buscar métricas do Instagram
  const fetchInstagramMetrics = async (): Promise<string> => {
    try {
      const savedConfig = localStorage.getItem('instagramToken')
      const savedBusinessId = localStorage.getItem('instagramBusinessAccountId')
      
      if (!savedConfig || !savedBusinessId) {
        return `Configure o Instagram na página Conteúdo & Redes Sociais para ver as métricas.`
      }

      const response = await fetch('/api/instagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: savedConfig,
          businessAccountId: savedBusinessId,
          timeRange: '30d',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (errorData.error?.includes('Token')) {
          return `Token do Instagram expirado. Reconecte na página Conteúdo & Redes Sociais.`
        }
        return `Erro ao buscar dados do Instagram. Verifique sua conexão.`
      }

      const data = await response.json()
      
      let resposta = `**Instagram @${data.username}**\n\n`
      
      // Seguidores
      resposta += `**Seguidores:** ${(data.followers?.total || 0).toLocaleString('pt-BR')}\n`
      
      // Métricas de perfil
      if (data.insights) {
        if (data.insights.profileViews > 0) {
          resposta += `**Visitas ao Perfil:** ${data.insights.profileViews.toLocaleString('pt-BR')}\n`
        }
        if (data.insights.reach > 0) {
          resposta += `**Alcance:** ${data.insights.reach.toLocaleString('pt-BR')}\n`
        }
        if (data.insights.websiteClicks > 0) {
          resposta += `**Cliques no Link:** ${data.insights.websiteClicks.toLocaleString('pt-BR')}\n`
        }
        if (data.insights.totalInteractions > 0) {
          resposta += `**Interações:** ${data.insights.totalInteractions.toLocaleString('pt-BR')}\n`
        }
      }

      // Total de posts
      if (data.posts && data.posts.length > 0) {
        resposta += `\n**Publicações analisadas:** ${data.posts.length}\n`
        
        // Métricas agregadas
        const totalLikes = data.posts.reduce((sum: number, p: { metrics?: { likes?: number } }) => sum + (p.metrics?.likes || 0), 0)
        const totalComments = data.posts.reduce((sum: number, p: { metrics?: { comments?: number } }) => sum + (p.metrics?.comments || 0), 0)
        const totalViews = data.posts.reduce((sum: number, p: { metrics?: { views?: number } }) => sum + (p.metrics?.views || 0), 0)
        
        resposta += `**Total Curtidas:** ${totalLikes.toLocaleString('pt-BR')}\n`
        resposta += `**Total Comentários:** ${totalComments.toLocaleString('pt-BR')}\n`
        if (totalViews > 0) {
          resposta += `**Total Visualizações:** ${totalViews.toLocaleString('pt-BR')}\n`
        }
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar Instagram:', error)
      return `Erro ao buscar dados do Instagram. Tente novamente.`
    }
  }

  // Buscar histórico de evolução do Instagram
  const fetchInstagramHistory = async (): Promise<string> => {
    try {
      const response = await fetch('/api/instagram/snapshot?days=30')
      
      if (!response.ok) {
        return `Não há dados históricos ainda. Os dados são coletados automaticamente ao acessar a página Conteúdo.`
      }

      const data = await response.json()
      
      if (!data.history || data.history.length === 0) {
        return `Ainda não há histórico de métricas. Acesse a página Conteúdo & Redes Sociais para começar a coletar dados.`
      }

      let resposta = `**Evolução Instagram (${data.summary.periodDays} dias)**\n\n`
      
      // Resumo
      resposta += `**Seguidores Atuais:** ${data.summary.currentFollowers.toLocaleString('pt-BR')}\n`
      
      if (data.summary.growth !== 0) {
        const crescimento = data.summary.growth > 0 ? '+' : ''
        resposta += `**Crescimento:** ${crescimento}${data.summary.growth.toLocaleString('pt-BR')} (${data.summary.growthPercentage}%)\n`
      }
      
      if (data.summary.totalProfileViews > 0) {
        resposta += `**Visitas ao Perfil:** ${data.summary.totalProfileViews.toLocaleString('pt-BR')}\n`
      }

      // Últimos registros
      if (data.history.length > 1) {
        resposta += `\n**Últimos ${Math.min(7, data.history.length)} dias:**\n`
        const ultimos = data.history.slice(-7).reverse()
        ultimos.forEach((h: { snapshot_date: string; followers_count: number; profile_views?: number }) => {
          const dataFormatada = new Date(h.snapshot_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          resposta += `› ${dataFormatada}: ${h.followers_count.toLocaleString('pt-BR')} seguidores`
          if (h.profile_views && h.profile_views > 0) {
            resposta += ` (${h.profile_views} visitas)`
          }
          resposta += '\n'
        })
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar histórico:', error)
      return `Erro ao buscar histórico. Tente novamente.`
    }
  }

  // Buscar posts com melhor performance
  const fetchTopPosts = async (metrica: 'likes' | 'comments' | 'views' | 'shares' | 'all'): Promise<string> => {
    try {
      const savedConfig = localStorage.getItem('instagramToken')
      const savedBusinessId = localStorage.getItem('instagramBusinessAccountId')
      
      if (!savedConfig || !savedBusinessId) {
        return `Configure o Instagram na página Conteúdo & Redes Sociais.`
      }

      const response = await fetch('/api/instagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: savedConfig,
          businessAccountId: savedBusinessId,
          timeRange: '30d',
        }),
      })

      if (!response.ok) {
        return `Erro ao buscar posts do Instagram.`
      }

      const data = await response.json()
      const posts = data.posts || []

      if (posts.length === 0) {
        return `Não encontrei publicações no período analisado.`
      }

      // Ordenar por métrica
      let sortedPosts = [...posts]
      let tituloMetrica = ''
      
      switch (metrica) {
        case 'likes':
          sortedPosts.sort((a, b) => (b.metrics?.likes || 0) - (a.metrics?.likes || 0))
          tituloMetrica = 'Mais Curtidas'
          break
        case 'comments':
          sortedPosts.sort((a, b) => (b.metrics?.comments || 0) - (a.metrics?.comments || 0))
          tituloMetrica = 'Mais Comentários'
          break
        case 'views':
          sortedPosts.sort((a, b) => (b.metrics?.views || 0) - (a.metrics?.views || 0))
          tituloMetrica = 'Mais Visualizações'
          break
        case 'shares':
          sortedPosts.sort((a, b) => (b.metrics?.shares || 0) - (a.metrics?.shares || 0))
          tituloMetrica = 'Mais Compartilhados'
          break
        default:
          // Ordenar por engajamento total
          sortedPosts.sort((a, b) => {
            const engA = (a.metrics?.likes || 0) + (a.metrics?.comments || 0) * 2 + (a.metrics?.shares || 0) * 3
            const engB = (b.metrics?.likes || 0) + (b.metrics?.comments || 0) * 2 + (b.metrics?.shares || 0) * 3
            return engB - engA
          })
          tituloMetrica = 'Melhor Performance'
      }

      let resposta = `**Posts com ${tituloMetrica}**\n\n`

      // Top 5 posts
      const top5 = sortedPosts.slice(0, 5)
      top5.forEach((post: { type: string; postedAt: string; caption?: string; metrics?: { likes?: number; comments?: number; views?: number; shares?: number } }, index: number) => {
        const tipo = post.type === 'video' ? '▶ Vídeo' : post.type === 'carousel' ? '◫ Carrossel' : '▣ Imagem'
        const data = new Date(post.postedAt).toLocaleDateString('pt-BR')
        
        // Pegar primeira linha da legenda (título) - até 150 caracteres
        let titulo = 'Sem legenda'
        if (post.caption) {
          // Pegar a primeira linha ou até o primeiro emoji/quebra
          const primeiraLinha = post.caption.split('\n')[0].trim()
          titulo = primeiraLinha.length > 150 ? primeiraLinha.substring(0, 150) + '...' : primeiraLinha
        }
        
        resposta += `**${index + 1}. ${titulo}**\n`
        resposta += `${tipo} — ${data}\n`
        
        const metricas = []
        if (post.metrics?.likes) metricas.push(`♥ ${post.metrics.likes.toLocaleString('pt-BR')}`)
        if (post.metrics?.comments) metricas.push(`💬 ${post.metrics.comments.toLocaleString('pt-BR')}`)
        if (post.metrics?.views) metricas.push(`👁 ${post.metrics.views.toLocaleString('pt-BR')}`)
        if (post.metrics?.shares) metricas.push(`↗ ${post.metrics.shares.toLocaleString('pt-BR')}`)
        
        if (metricas.length > 0) {
          resposta += `${metricas.join(' | ')}\n`
        }
        resposta += '\n'
      })

      return resposta
    } catch (error) {
      console.error('Erro ao buscar posts:', error)
      return `Erro ao buscar posts. Tente novamente.`
    }
  }

  // Buscar posts por tipo de conteúdo
  const fetchPostsByType = async (): Promise<string> => {
    try {
      const savedConfig = localStorage.getItem('instagramToken')
      const savedBusinessId = localStorage.getItem('instagramBusinessAccountId')
      
      if (!savedConfig || !savedBusinessId) {
        return `Configure o Instagram na página Conteúdo & Redes Sociais.`
      }

      const response = await fetch('/api/instagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: savedConfig,
          businessAccountId: savedBusinessId,
          timeRange: '30d',
        }),
      })

      if (!response.ok) {
        return `Erro ao buscar dados do Instagram.`
      }

      const data = await response.json()
      const posts = data.posts || []

      if (posts.length === 0) {
        return `Não encontrei publicações no período analisado.`
      }

      // Agrupar por tipo
      const porTipo: Record<string, { count: number; likes: number; comments: number; views: number }> = {
        image: { count: 0, likes: 0, comments: 0, views: 0 },
        video: { count: 0, likes: 0, comments: 0, views: 0 },
        carousel: { count: 0, likes: 0, comments: 0, views: 0 },
      }

      posts.forEach((post: { type: string; metrics?: { likes?: number; comments?: number; views?: number } }) => {
        const tipo = post.type || 'image'
        if (!porTipo[tipo]) {
          porTipo[tipo] = { count: 0, likes: 0, comments: 0, views: 0 }
        }
        porTipo[tipo].count++
        porTipo[tipo].likes += post.metrics?.likes || 0
        porTipo[tipo].comments += post.metrics?.comments || 0
        porTipo[tipo].views += post.metrics?.views || 0
      })

      let resposta = `**Publicações por Tipo de Conteúdo**\n\n`
      resposta += `Total: ${posts.length} publicações\n\n`

      const tipos = [
        { key: 'image', label: 'Imagens', icon: '▣' },
        { key: 'video', label: 'Vídeos/Reels', icon: '▶' },
        { key: 'carousel', label: 'Carrosséis', icon: '◫' },
      ]

      tipos.forEach(({ key, label, icon }) => {
        const stats = porTipo[key]
        if (stats && stats.count > 0) {
          const mediaLikes = Math.round(stats.likes / stats.count)
          const mediaComments = Math.round(stats.comments / stats.count)
          
          resposta += `**${icon} ${label}:** ${stats.count} posts\n`
          resposta += `   Média: ${mediaLikes.toLocaleString('pt-BR')} curtidas, ${mediaComments.toLocaleString('pt-BR')} comentários\n`
          
          if (stats.views > 0) {
            const mediaViews = Math.round(stats.views / stats.count)
            resposta += `   Visualizações: ${mediaViews.toLocaleString('pt-BR')} (média)\n`
          }
          resposta += '\n'
        }
      })

      // Identificar melhor tipo
      const melhorTipo = tipos
        .map(t => ({
          ...t,
          engajamento: porTipo[t.key]?.count > 0 
            ? (porTipo[t.key].likes + porTipo[t.key].comments * 2) / porTipo[t.key].count 
            : 0
        }))
        .filter(t => porTipo[t.key]?.count > 0)
        .sort((a, b) => b.engajamento - a.engajamento)[0]

      if (melhorTipo) {
        resposta += `**Melhor tipo:** ${melhorTipo.label} (maior engajamento médio)`
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar posts por tipo:', error)
      return `Erro ao buscar dados. Tente novamente.`
    }
  }

  // Buscar performance por tema de postagens
  const fetchThemePerformance = async (): Promise<string> => {
    try {
      const savedConfig = localStorage.getItem('instagramToken')
      const savedBusinessId = localStorage.getItem('instagramBusinessAccountId')
      
      if (!savedConfig || !savedBusinessId) {
        return `Configure o Instagram na página Conteúdo & Redes Sociais.`
      }

      // Buscar classificações de temas do Supabase
      const classificationsResponse = await fetch('/api/instagram/classifications')
      if (!classificationsResponse.ok) {
        return `Erro ao buscar classificações. Faça login novamente.`
      }

      const classificationsData = await classificationsResponse.json()
      if (!classificationsData.success || !classificationsData.classifications) {
        return `Nenhum post foi classificado por tema ainda.\n\nAcesse Conteúdo & Redes Sociais e classifique os posts por tema para ver a performance.`
      }

      const classifications: Record<string, { theme?: string; isBoosted?: boolean }> = classificationsData.classifications

      if (Object.keys(classifications).length === 0) {
        return `Nenhum post foi classificado por tema ainda.\n\nAcesse Conteúdo & Redes Sociais e classifique os posts por tema para ver a performance.`
      }

      // Buscar posts do Instagram
      const response = await fetch('/api/instagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: savedConfig,
          businessAccountId: savedBusinessId,
          timeRange: '30d',
        }),
      })

      if (!response.ok) {
        return `Erro ao buscar dados do Instagram.`
      }

      const data = await response.json()
      const posts = data.posts || []

      if (posts.length === 0) {
        return `Não encontrei publicações no período analisado.`
      }

      // Calcular estatísticas por tema
      const themeStats: Record<string, { 
        posts: number
        likes: number
        comments: number
        views: number
        shares: number
        saves: number
      }> = {}

      posts.forEach((post: { id: string; postedAt?: string; caption?: string; metrics?: { likes?: number; comments?: number; views?: number; shares?: number; saves?: number } }) => {
        // Gerar identificador do post (mesmo método usado na página de Conteúdo)
        // Prioridade: post.id, senão usa data + caption hash
        let identifier = post.id
        if (!identifier && post.postedAt && post.caption) {
          const dateStr = new Date(post.postedAt).toISOString().split('T')[0]
          const captionHash = post.caption.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
          identifier = `${dateStr}_${captionHash}`
        }

        const classification = classifications[identifier]
        
        if (classification?.theme) {
          const theme = classification.theme
          if (!themeStats[theme]) {
            themeStats[theme] = { posts: 0, likes: 0, comments: 0, views: 0, shares: 0, saves: 0 }
          }
          
          themeStats[theme].posts++
          themeStats[theme].likes += post.metrics?.likes || 0
          themeStats[theme].comments += post.metrics?.comments || 0
          themeStats[theme].views += post.metrics?.views || 0
          themeStats[theme].shares += post.metrics?.shares || 0
          themeStats[theme].saves += post.metrics?.saves || 0
        }
      })

      const temas = Object.keys(themeStats)
      
      if (temas.length === 0) {
        return `Nenhum post foi classificado por tema ainda.\n\nAcesse Conteúdo & Redes Sociais e classifique os posts por tema para ver a performance.`
      }

      // Calcular engajamento médio e ordenar
      const temasComEngajamento = temas.map(tema => {
        const stats = themeStats[tema]
        const engajamentoMedio = stats.posts > 0 
          ? Math.round((stats.likes + stats.comments * 2 + stats.shares * 3) / stats.posts)
          : 0
        const mediaLikes = stats.posts > 0 ? Math.round(stats.likes / stats.posts) : 0
        const mediaComments = stats.posts > 0 ? Math.round(stats.comments / stats.posts) : 0
        const mediaViews = stats.posts > 0 ? Math.round(stats.views / stats.posts) : 0
        
        return {
          tema,
          ...stats,
          engajamentoMedio,
          mediaLikes,
          mediaComments,
          mediaViews,
        }
      }).sort((a, b) => b.engajamentoMedio - a.engajamentoMedio)

      const melhor = temasComEngajamento[0]
      const totalClassificados = temasComEngajamento.reduce((sum, t) => sum + t.posts, 0)

      let resposta = `**Performance por Tema**\n`
      resposta += `${totalClassificados} posts em ${temas.length} temas\n\n`
      
      resposta += `🏆 **${melhor.tema}** é o tema com melhor engajamento\n\n`

      // Mostrar top 5 de forma limpa
      const top5 = temasComEngajamento.slice(0, 5)
      top5.forEach((t, index) => {
        const pos = index + 1
        const barra = '█'.repeat(Math.min(Math.round((t.engajamentoMedio / melhor.engajamentoMedio) * 8), 8))
        resposta += `${pos}. ${t.tema} ${barra}\n`
        resposta += `   ${t.posts} posts · ${t.mediaLikes} curtidas · ${t.mediaComments} comentários\n`
      })

      if (temasComEngajamento.length > 5) {
        resposta += `\n+${temasComEngajamento.length - 5} outros temas`
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar performance por tema:', error)
      return `Erro ao buscar dados. Tente novamente.`
    }
  }

  type PesquisasFetchOutcome =
    | { kind: 'data'; content: string }
    | { kind: 'ask_tipo'; content: string; pending: PesquisaTipoChoicePending }
    | { kind: 'error'; content: string }

  const fetchPesquisasOutcome = useCallback(async (
    termo: string,
    tipo?: PesquisaTipo,
    pendingContext?: PesquisaTipoChoicePending,
    options?: { focoJadyel?: boolean }
  ): Promise<PesquisasFetchOutcome> => {
    try {
      const response = await fetch('/api/pesquisa')
      if (!response.ok) {
        return { kind: 'error', content: 'Erro ao buscar pesquisas.' }
      }

      const pesquisas = (await response.json()) as Array<Record<string, unknown>>
      const searchTerm = pendingContext?.termo || termo
      const focoJadyel = options?.focoJadyel ?? pendingContext?.focoJadyel ?? false
      const pesquisasFiltradas = filterPesquisasByTermo(pesquisas, searchTerm, { focoJadyel })

      if (pesquisasFiltradas.length === 0) {
        return { kind: 'error', content: `Não encontrei pesquisas para "${searchTerm}".` }
      }

      const result = resolvePesquisasReply(pesquisasFiltradas, {
        termo: searchTerm,
        tipoFilter: tipo,
        pendingContext,
        focoJadyel,
        maxGrupos: 3,
        maxCandidatosPorGrupo: 12,
      })

      if (result.kind === 'ask_tipo') {
        return { kind: 'ask_tipo', content: result.content, pending: result.pending }
      }

      if (result.kind === 'empty' || !result.content) {
        return { kind: 'error', content: result.content || `Não encontrei pesquisas para "${searchTerm}".` }
      }

      return { kind: 'data', content: result.content }
    } catch (error) {
      console.error('Erro ao buscar pesquisas:', error)
      return { kind: 'error', content: 'Erro ao buscar pesquisas. Tente novamente.' }
    }
  }, [])

  const buildPesquisasChatMessage = useCallback((
    outcome: PesquisasFetchOutcome,
    options?: { viaAi?: boolean }
  ): ChatMessage => {
    if (outcome.kind === 'ask_tipo') {
      setPesquisaTipoPending(outcome.pending)
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: outcome.content,
        viaAi: options?.viaAi,
      }
    }

    setPesquisaTipoPending(null)
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: outcome.content,
      viaAi: options?.viaAi,
      action:
        outcome.kind === 'data'
          ? {
              type: 'navigate',
              url: '/dashboard/pesquisa',
              label: 'Ver Pesquisas',
            }
          : undefined,
    }
  }, [])

  // ==================== PROCESSAMENTO DE QUERIES ====================

  // Processar pergunta do usuário
  const processUserQuery = useCallback(async (query: string): Promise<ChatMessage> => {
    const queryLower = normalizeText(query)
    const pc = pageContextRef.current

    if (isGreetingQuery(query)) {
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: buildGreetingReply(query),
      }
    }

    if (isHelpQuery(query)) {
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: buildHelpReply(),
      }
    }

    const sidebarNav = detectSidebarNavigate(query, pathnameRef.current)
    if (sidebarNav) {
      return buildSidebarNavChatMessage(sidebarNav)
    }

    if (pc?.kind === 'resumo-eleicoes') {
      if (pc.loadingCidades) {
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'A lista de municípios ainda está carregando. Aguarde um instante e tente de novo.',
        }
      }

      if (/\b(ajuda|comandos|exemplos)\b/.test(queryLower) || queryLower === '?') {
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: [
            '**Resumo Eleições (esta página)**',
            '',
            'Posso **definir o município** no campo **Cidade** e **acionar Buscar** (o mesmo do botão da página).',
            '',
            'Exemplos:',
            '› "Buscar Teresina"',
            '› "Picos"',
            '› "Mostrar dados de Parnaíba"',
            '› "Atualizar" (com uma cidade já selecionada)',
            '',
            'Com **uma cidade já carregada** (após Buscar):',
            '› **abrir demandas** / **ver demandas** — mesmo fluxo do botão **Demandas**; depois pergunto se quer **todas** as lideranças ou **nomes específicos**.',
            '› **ver lideranças** / **abrir lideranças** — abre o modal do card **Lideranças** (link **Clique para ver detalhes**).',
            '› **ver pesquisas** / **histórico de pesquisas** — abre o modal do card **Pesquisas** (mesmo texto de detalhes).',
            '› **fechar** / **feche o modal** / **fechar lideranças** / **fechar pesquisas** — fecha os modais abertos (e o painel de demandas, se estiver aberto).',
            '',
            'Diga **listar cidades** para ver uma amostra dos nomes do dropdown.',
          ].join('\n'),
        }
      }

      if (
        queryLower.includes('listar cidades') ||
        queryLower.includes('cidades disponiveis') ||
        queryLower.includes('cidades disponíveis') ||
        queryLower.includes('quais cidades')
      ) {
        const total = pc.cidades.length
        const amostra = pc.cidades.slice(0, 35).join(' | ')
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: `**Municípios no dropdown:** ${total}\n\n${amostra}${total > 35 ? '\n\n… (diga o nome ou parte dele na frase)' : ''}`,
        }
      }

      const ehDemandaTerritorio = /\b(demandas?|pedidos?)\s+em\b/.test(queryLower)
      const querDemandasPaginaResumo =
        !ehDemandaTerritorio &&
        /\b(demandas|pedidos)\b/.test(queryLower) &&
        (/\b(abrir|ver|mostrar|consultar|exibir|filtro|filtrar)\b/.test(queryLower) ||
          /\b(quero|preciso|desejo)\b/.test(queryLower) ||
          /^demandas$/i.test(query.trim()) ||
          /^pedidos$/i.test(query.trim()))

      const querFecharModaisResumo =
        /\b(fechar|feche|fecha)\b/.test(queryLower) ||
        /\bsair\s+(do|da)\s+(modal|janela)\b/.test(queryLower) ||
        /^feche$/i.test(query.trim()) ||
        /^fechar$/i.test(query.trim())

      if (querFecharModaisResumo) {
        const algumAberto =
          pc.modalLiderancasAberto ||
          pc.modalPesquisasAberto ||
          pc.modalDemandasCidadeAberto ||
          pc.seletorDemandasAberto

        const citouLiderancas = /\b(lideranças|liderancas)\b/.test(queryLower)
        const citouPesquisas =
          /\b(pesquisas?)\b/.test(queryLower) || /\bhistorico de pesquisas?\b/.test(queryLower)
        const citouDemandas = /\b(demandas|pedidos)\b/.test(queryLower)

        const fecharTudoOuGenerico =
          /\b(tudo|todos os modais|todas as janelas|fechar modais|feche os modais)\b/.test(queryLower) ||
          /\b(o\s+)?modal\b/.test(queryLower) ||
          /\b(a\s+)?janela\b/.test(queryLower) ||
          /\b(painel)\b/.test(queryLower) ||
          /^fechar$/i.test(query.trim()) ||
          /^feche$/i.test(query.trim()) ||
          (!citouLiderancas && !citouPesquisas && !citouDemandas)

        if (!algumAberto) {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Não há modal ou painel desta página aberto no momento.',
          }
        }

        const fechados: string[] = []

        const registrar = (label: string) => {
          if (!fechados.includes(label)) fechados.push(label)
        }

        if (fecharTudoOuGenerico) {
          if (pc.modalLiderancasAberto) {
            pc.fecharModalLiderancas()
            registrar('Lideranças')
          }
          if (pc.modalPesquisasAberto) {
            pc.fecharModalPesquisas()
            registrar('Pesquisas')
          }
          if (pc.modalDemandasCidadeAberto) {
            pc.fecharModalDemandasCidade()
            registrar('Demandas da cidade')
          }
          if (pc.seletorDemandasAberto) {
            pc.fecharSeletorDemandas()
            setResumoDemandasAssistPhase('idle')
            registrar('Seleção de lideranças (demandas)')
          }
        } else if (citouLiderancas && pc.modalLiderancasAberto) {
          pc.fecharModalLiderancas()
          registrar('Lideranças')
        } else if (citouPesquisas && pc.modalPesquisasAberto) {
          pc.fecharModalPesquisas()
          registrar('Pesquisas')
        } else if (citouDemandas && (pc.seletorDemandasAberto || pc.modalDemandasCidadeAberto)) {
          if (pc.seletorDemandasAberto) {
            pc.fecharSeletorDemandas()
            setResumoDemandasAssistPhase('idle')
            registrar('Seleção de lideranças (demandas)')
          }
          if (pc.modalDemandasCidadeAberto) {
            pc.fecharModalDemandasCidade()
            registrar('Demandas da cidade')
          }
        } else {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content:
              'Não identifiquei um modal aberto com esse nome. Diga **fechar** para fechar tudo o que estiver aberto, ou **ajuda**.',
          }
        }

        return {
          id: Date.now().toString(),
          role: 'assistant',
          content:
            fechados.length > 0
              ? `Fechei: **${fechados.join('**, **')}**.`
              : 'Pronto.',
        }
      }

      if (resumoDemandasAssistPhase === 'awaiting_lideranca_escopo') {
        if (querDemandasPaginaResumo && !pc.seletorDemandasAberto) {
          setResumoDemandasAssistPhase('idle')
        } else {
          if (querDemandasPaginaResumo && pc.seletorDemandasAberto) {
            return {
              id: Date.now().toString(),
              role: 'assistant',
              content:
                'Já estamos no passo das lideranças. Diga **todas** ou cite os nomes. **listar lideranças** mostra a lista.',
            }
          }
          if (/\b(cancelar|fechar|voltar|desisto)\b/.test(queryLower)) {
            pc.fecharSeletorDemandas()
            setResumoDemandasAssistPhase('idle')
            return {
              id: Date.now().toString(),
              role: 'assistant',
              content: 'Fluxo de demandas cancelado e o painel de lideranças foi fechado.',
            }
          }

          if (
            queryLower.includes('listar liderancas') ||
            queryLower.includes('listar lideranças') ||
            queryLower.includes('quais liderancas') ||
            queryLower.includes('quais lideranças') ||
            queryLower.includes('nomes das liderancas') ||
            queryLower.includes('nomes das lideranças')
          ) {
            const lista = pc.liderancasDemandasDisponiveis
            if (lista.length === 0) {
              return {
                id: Date.now().toString(),
                role: 'assistant',
                content:
                  'A lista de lideranças ainda está vazia ou carregando. Aguarde um instante e diga **listar lideranças** de novo.',
              }
            }
            return {
              id: Date.now().toString(),
              role: 'assistant',
              content: `**Lideranças no modal** (${lista.length}):\n\n${lista
                .slice(0, 45)
                .map((n) => `› ${n}`)
                .join('\n')}${lista.length > 45 ? '\n\n…' : ''}`,
            }
          }

          const trimmed = queryLower.trim()
          const querTodasLiderancas =
            !/\bnao\b/.test(queryLower) &&
            !/\bnão\b/.test(queryLower) &&
            (trimmed === 'todas' ||
              trimmed === 'todos' ||
              /\b(selecionar todas|manter todas|todas as lideran)\b/.test(queryLower) ||
              /\bquero\s+todas\b/.test(queryLower))

          if (querTodasLiderancas) {
            if (pc.liderancasDemandasDisponiveis.length === 0) {
              setResumoDemandasAssistPhase('idle')
              pc.fecharSeletorDemandas()
              return {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Não há lideranças listadas para esta cidade; não dá para abrir demandas com **todas**.',
              }
            }
            try {
              await pc.confirmarDemandasTodasLiderancas()
              setResumoDemandasAssistPhase('idle')
              return {
                id: Date.now().toString(),
                role: 'assistant',
                content:
                  'Mantive **todas** as lideranças e acionei **Ver demandas selecionadas** (o modal de demandas da cidade deve abrir).',
              }
            } catch {
              setResumoDemandasAssistPhase('idle')
              return {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Não consegui confirmar as demandas. Use o botão **Ver demandas selecionadas** na página.',
              }
            }
          }

          const nomesDemanda = resolverLiderancasMencionadas(query, pc.liderancasDemandasDisponiveis).filter((n) =>
            pc.liderancasDemandasDisponiveis.includes(n),
          )
          if (nomesDemanda.length > 0) {
            try {
              await pc.confirmarDemandasComLiderancasNomes(nomesDemanda)
              setResumoDemandasAssistPhase('idle')
              return {
                id: Date.now().toString(),
                role: 'assistant',
                content: `Selecionei **${nomesDemanda.join(', ')}** e acionei **Ver demandas selecionadas**.`,
              }
            } catch {
              setResumoDemandasAssistPhase('idle')
              return {
                id: Date.now().toString(),
                role: 'assistant',
                content:
                  'Não consegui abrir as demandas filtradas. Confira os nomes no painel e clique em **Ver demandas selecionadas**.',
              }
            }
          }

          if (!pc.seletorDemandasAberto) {
            setResumoDemandasAssistPhase('idle')
            return {
              id: Date.now().toString(),
              role: 'assistant',
              content:
                'O painel de lideranças não está mais aberto. Digite **abrir demandas** para recomeçar, ou **cancelar**.',
            }
          }

          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: [
              'Não entendi a escolha de lideranças.',
              '',
              'Diga **todas** para manter todas selecionadas, ou cite nomes (ex.: **Fulano e Beltrano**).',
              'Diga **listar lideranças** para ver os nomes disponíveis.',
              '**cancelar** fecha o painel.',
            ].join('\n'),
          }
        }
      }

      if (querDemandasPaginaResumo) {
        if (!pc.buscaIniciada || !pc.cidadeAtual.trim()) {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Primeiro escolha um município e acione **Buscar** (campo Cidade + botão da página).',
          }
        }
        if (pc.loadingDados) {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Aguarde terminar o carregamento da cidade antes de abrir demandas.',
          }
        }

        try {
          await Promise.resolve(pc.abrirFluxoDemandas())
        } catch {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Não consegui abrir o fluxo de demandas. Use o botão **Demandas** na página.',
          }
        }

        await new Promise((r) => setTimeout(r, 120))
        const pcAtualizado = pageContextRef.current
        if (pcAtualizado?.kind !== 'resumo-eleicoes') {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Contexto da página mudou; tente de novo.',
          }
        }

        setResumoDemandasAssistPhase('awaiting_lideranca_escopo')

        const lista = pcAtualizado.liderancasDemandasDisponiveis
        const amostra = lista.slice(0, 12).map((n) => `› ${n}`).join('\n')
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: [
            'Abri o mesmo fluxo do botão **Demandas**: seleção de lideranças.',
            '',
            'Quer **todas** as lideranças (como o padrão ao abrir o painel) ou **uma ou mais específicas**?',
            '',
            'Responda com **todas** ou com os nomes (ex.: **Fulano e Beltrano**).',
            lista.length > 0
              ? `\nAlguns nomes:\n${amostra}${lista.length > 12 ? '\n… Diga **listar lideranças** para a lista completa.' : ''}`
              : '\nSe a lista ainda estiver vazia, aguarde um instante e diga **listar lideranças**.',
          ].join('\n'),
        }
      }

      const ehLiderancaTerritorio = /\b(lideranças?|liderancas?)\s+em\b/.test(queryLower)
      const querLiderancasCardResumo =
        !ehLiderancaTerritorio &&
        /\b(lideranças|liderancas|liderança|lideranca)\b/.test(queryLower) &&
        (/\b(abrir|ver|mostrar|consultar|exibir|detalhes|modal)\b/.test(queryLower) ||
          /\b(quero|preciso|desejo)\b/.test(queryLower) ||
          /^lideranças$/i.test(query.trim()) ||
          /^liderancas$/i.test(query.trim()))

      if (querLiderancasCardResumo) {
        if (!pc.buscaIniciada || !pc.cidadeAtual.trim()) {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Primeiro escolha um município e acione **Buscar**.',
          }
        }
        if (pc.loadingDados) {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Aguarde terminar o carregamento antes de abrir o modal de lideranças.',
          }
        }
        if (!pc.painelResumoCardsVisivel) {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content:
              'O card **Lideranças** só aparece após uma busca **com resultados**. Faça **Buscar** de novo ou outro município.',
          }
        }
        try {
          pc.abrirDetalhesLiderancasCard()
        } catch {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Não consegui abrir o modal. Use **Clique para ver detalhes** no card **Lideranças**.',
          }
        }
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content:
            'Abri o modal de **Lideranças** da cidade (o mesmo do **Clique para ver detalhes** no card).',
        }
      }

      const ehPesquisaTerritorio = /\bpesquisas?\s+em\b/.test(queryLower)
      const mencionaHistoricoPesquisaCard = /\bhistorico de pesquisas?\b/.test(queryLower)
      const querPesquisasCardResumo =
        !ehPesquisaTerritorio &&
        (mencionaHistoricoPesquisaCard ||
          (/\b(pesquisas?)\b/.test(queryLower) &&
            (/\b(abrir|ver|mostrar|consultar|exibir|detalhes|histórico|historico)\b/.test(queryLower) ||
              /\b(quero|preciso|desejo)\b/.test(queryLower) ||
              /^pesquisas$/i.test(query.trim()) ||
              /^pesquisa$/i.test(query.trim()))))

      if (querPesquisasCardResumo) {
        if (!pc.buscaIniciada || !pc.cidadeAtual.trim()) {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Primeiro escolha um município e acione **Buscar**.',
          }
        }
        if (pc.loadingDados) {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Aguarde terminar o carregamento antes de abrir o histórico de pesquisas.',
          }
        }
        if (!pc.painelResumoCardsVisivel) {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content:
              'O card **Pesquisas** só aparece após uma busca **com resultados**. Faça **Buscar** de novo ou outro município.',
          }
        }
        try {
          pc.abrirDetalhesPesquisasCard()
        } catch {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Não consegui abrir o modal. Use **Clique para ver detalhes** no card **Pesquisas**.',
          }
        }
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content:
            'Abri o histórico de **Pesquisas** (o mesmo do **Clique para ver detalhes** no card).',
        }
      }

      const indicaOutrosModulos =
        /expectativa\s+em|lideranças?\s+em|liderancas?\s+em|demandas?\s+em|agendas?\s+em|instagram|chapa|federal|republicanos|territorio|território|pesquisas?\s+em/.test(
          queryLower,
        )

      let nomeAlvo = resolveCidadeResumoEleicoesDropdown(query, pc.cidades)
      if (!nomeAlvo) {
        const extracted = extractCityName(query)
        if (extracted) {
          const exNorm = normalizeText(extracted)
          nomeAlvo =
            pc.cidades.find((c) => normalizeText(c) === exNorm) ||
            pc.cidades.find(
              (c) =>
                normalizeText(c).includes(exNorm) ||
                (exNorm.length >= 4 && exNorm.includes(normalizeText(c))),
            ) ||
            null
        }
      }

      const pedeBuscaExplicito =
        /buscar|pesquisar|carregar|atualizar|trazer|mostrar|exibir|dados|resultados|executar|rode|roda|faz|faça|faca/.test(queryLower)

      const apenasComandoCurto =
        /^(buscar|pesquisar|atualizar|carregar|ok|vai|executa|executar|confirma|confirmar)(\s+agora)?$/.test(
          queryLower.trim(),
        )

      if (pc.loadingDados && (nomeAlvo || pedeBuscaExplicito || apenasComandoCurto)) {
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Já existe uma busca em andamento na página. Aguarde terminar.',
        }
      }

      if ((pedeBuscaExplicito || apenasComandoCurto) && !nomeAlvo && pc.cidadeAtual.trim()) {
        try {
          await Promise.resolve(pc.selecionarCidadeEBuscar(pc.cidadeAtual.trim()))
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: `**${pc.cidadeAtual.trim()}** — acionei **Buscar** de novo (mesma cidade selecionada).`,
          }
        } catch {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Não consegui acionar a busca. Use o botão **Buscar** na página.',
          }
        }
      }

      if (nomeAlvo && (!indicaOutrosModulos || pedeBuscaExplicito)) {
        try {
          await Promise.resolve(pc.selecionarCidadeEBuscar(nomeAlvo))
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: `**${nomeAlvo}** — defini no campo **Cidade** e acionei **Buscar**. Os painéis vão atualizar em instantes.`,
          }
        } catch {
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Não consegui completar a busca. Tente pelo botão **Buscar** na página.',
          }
        }
      }

      if (pedeBuscaExplicito && !nomeAlvo) {
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content:
            'Diga qual município buscar, por exemplo: **"Buscar Teresina"** ou só **"Picos"**.\n\nSe não souber o nome exato, diga **listar cidades**.',
        }
      }
    }

    const cidade = extractCityName(query)
    
    // ===== PROJEÇÃO DA CHAPA FEDERAL =====
    if (queryLower.includes('chapa') || queryLower.includes('federal') || queryLower.includes('deputado') || 
        queryLower.includes('projecao') || queryLower.includes('projeção') || queryLower.includes('eleitos') ||
        queryLower.includes('republicanos') || queryLower.includes('vagas')) {
      const resposta = await fetchProjecaoChapa()
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/chapas',
          label: 'Ver Simulador de Chapas',
        },
      }
    }

    // ===== LIDERANÇAS DE UMA CIDADE =====
    if (cidade && (queryLower.includes('lideranca') || queryLower.includes('liderancas') || 
        queryLower.includes('liderança') || queryLower.includes('lideranças') ||
        queryLower.includes('quem') || queryLower.includes('capilaridade') || queryLower.includes('base'))) {
      const resposta = await fetchLiderancasCidade(cidade)
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/territorio',
          label: 'Ver Território & Base',
        },
      }
    }
    
    // ===== EXPECTATIVA/VOTOS EM CIDADE ESPECÍFICA =====
    if (cidade && (queryLower.includes('expectativa') || queryLower.includes('voto') || 
        queryLower.includes('2026') || queryLower.includes('quantos') || queryLower.includes('potencial'))) {
      const pedeDetalheLideranca =
        /\b(por lideranca|por liderança|detalhada|detalhado|detalhe|liste|listar|quem)\b/.test(queryLower)
      const resposta = await fetchExpectativaCidade(cidade, { detalhe: pedeDetalheLideranca })
      if (!pedeDetalheLideranca) {
        syncExpectativaDetalhePending({ cidade })
      } else {
        syncExpectativaDetalhePending(null)
      }
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/territorio',
          label: pedeDetalheLideranca ? 'Ver Território Completo' : 'Ver Território & Base',
        },
      }
    }
    
    // ===== VISITAS DE CAMPO (Campo & Agenda) =====
    if (isCampoVisitasQuery(query)) {
      const outcome = await fetchCampoVisitasOutcome(query, { cidade: cidade ?? undefined })
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: outcome.content,
        speechSegments: outcome.speechSegments,
        action: {
          type: 'navigate',
          url: '/dashboard/campo',
          label: 'Ver Campo & Agenda',
        },
      }
    }

    // ===== AGENDA EM CIDADE ESPECÍFICA (Google Calendar) =====
    if (
      cidade &&
      (queryLower.includes('agenda') ||
        queryLower.includes('evento') ||
        queryLower.includes('reuniao') ||
        queryLower.includes('reunião') ||
        queryLower.includes('compromisso'))
    ) {
      const outcome = await fetchAgendaOutcome(query, { cidade })
      return buildAgendaChatMessage(outcome)
    }

    // ===== DEMANDAS DE UMA CIDADE =====
    if (cidade && (queryLower.includes('demanda') || queryLower.includes('pedido') || 
        queryLower.includes('solicitacao') || queryLower.includes('solicitação') || queryLower.includes('problema'))) {
      const resposta = await fetchDemandasCidade(cidade)
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/territorio',
          label: 'Ver Demandas da Cidade',
        },
      }
    }

    // ===== TERRITÓRIO & BASE (GERAL) =====
    if ((queryLower.includes('territorio') || queryLower.includes('território') || queryLower.includes('base') || 
         queryLower.includes('lideranca') || queryLower.includes('liderança') || queryLower.includes('capilaridade')) &&
        !cidade && !queryLower.includes('frio')) {
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: `**Território & Base**\n\nA página Território & Base mostra:\n\n• **Lideranças Atuais** - Lista de lideranças por cidade com expectativa de votos\n• **KPIs** - Expectativa 2026, Presença Territorial, Capilaridade da Base\n• **Demandas por Cidade** - Clique no ícone de documento ao lado de cada cidade para ver as demandas\n• **Mapa Mental** - Visualização das relações entre lideranças\n• **Filtros** - Por cidade, nome, cargo e faixa de votos\n\nPara ver detalhes de uma cidade específica, pergunte: "expectativa em [cidade]" ou "lideranças em [cidade]".`,
        action: {
          type: 'navigate',
          url: '/dashboard/territorio',
          label: 'Ver Território & Base',
        },
      }
    }

    // ===== DEMANDAS (GERAL) =====
    if ((queryLower.includes('demanda') || queryLower.includes('pedido') || queryLower.includes('solicitacao') || 
         queryLower.includes('solicitação')) && !cidade) {
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: `**Demandas**\n\nAs demandas são solicitadas por lideranças e organizadas por cidade. Elas vêm da planilha "Cadastro de Demandas" do Google Sheets.\n\n**Para ver demandas de uma cidade específica:**\n• Pergunte: "demandas em [cidade]" ou "pedidos em [cidade]"\n• Ou acesse Território & Base e clique no ícone de documento ao lado da cidade\n\n**Informações exibidas:**\n• Status (da coluna STATUS da planilha)\n• Liderança que fez o pedido\n• Título e descrição\n• Prioridade e tema\n• Prazo SLA`,
        action: {
          type: 'navigate',
          url: '/dashboard/territorio',
          label: 'Ver Território & Base',
        },
      }
    }

    // ===== PESQUISAS =====
    const ehConsultaPesquisa =
      queryLower.includes('pesquisa') ||
      queryLower.includes('intencao') ||
      queryLower.includes('intenção') ||
      /\bvoto\b/.test(queryLower)

    if (ehConsultaPesquisa && (cidade || queryMentionsJadyelAlencar(query))) {
      const tipo = parsePesquisaTipoFromQuery(query)
      const focoJadyel = queryMentionsJadyelAlencar(query)
      const searchTerm = cidade || 'jadyel'
      const outcome = await fetchPesquisasOutcome(searchTerm, tipo ?? undefined, undefined, {
        focoJadyel,
      })
      return buildPesquisasChatMessage(outcome)
    }
    
    // ===== INSTAGRAM - MÉTRICAS GERAIS =====
    if ((queryLower.includes('instagram') || queryLower.includes('insta') || queryLower.includes('rede') || queryLower.includes('social')) &&
        (queryLower.includes('metrica') || queryLower.includes('dado') || queryLower.includes('numero') || 
         queryLower.includes('resumo') || queryLower.includes('como') || queryLower.includes('performance') ||
         queryLower.includes('estatistica') || !queryLower.includes('seguidor') && !queryLower.includes('post') && !queryLower.includes('publicacao'))) {
      const resposta = await fetchInstagramMetrics()
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Conteúdo & Redes Sociais',
        },
      }
    }

    // ===== INSTAGRAM - SEGUIDORES E EVOLUÇÃO =====
    if ((queryLower.includes('seguidor') || queryLower.includes('followers') || queryLower.includes('crescimento') || 
         queryLower.includes('evolucao') || queryLower.includes('evolução')) &&
        (queryLower.includes('instagram') || queryLower.includes('insta') || queryLower.includes('perfil') || 
         queryLower.includes('rede') || queryLower.includes('social') || queryLower.includes('quantos'))) {
      const resposta = await fetchInstagramHistory()
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Evolução Completa',
        },
      }
    }

    // ===== INSTAGRAM - VISITAS AO PERFIL =====
    if ((queryLower.includes('visita') || queryLower.includes('visualiza') || queryLower.includes('view')) && 
        (queryLower.includes('perfil') || queryLower.includes('instagram') || queryLower.includes('insta'))) {
      const resposta = await fetchInstagramMetrics()
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Métricas do Perfil',
        },
      }
    }

    // ===== INSTAGRAM - POSTS MAIS CURTIDOS =====
    if ((queryLower.includes('curtida') || queryLower.includes('like') || queryLower.includes('curtiu')) &&
        (queryLower.includes('post') || queryLower.includes('publicacao') || queryLower.includes('publicação') || 
         queryLower.includes('foto') || queryLower.includes('video') || queryLower.includes('mais') ||
         queryLower.includes('instagram') || queryLower.includes('insta'))) {
      const resposta = await fetchTopPosts('likes')
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Todos os Posts',
        },
      }
    }

    // ===== INSTAGRAM - POSTS MAIS COMENTADOS =====
    if ((queryLower.includes('comentario') || queryLower.includes('comentário') || queryLower.includes('comment')) &&
        (queryLower.includes('post') || queryLower.includes('publicacao') || queryLower.includes('mais') ||
         queryLower.includes('instagram') || queryLower.includes('insta'))) {
      const resposta = await fetchTopPosts('comments')
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Todos os Posts',
        },
      }
    }

    // ===== INSTAGRAM - POSTS MAIS VISUALIZADOS =====
    if ((queryLower.includes('visualiza') || queryLower.includes('view') || queryLower.includes('assistiu') || queryLower.includes('viu')) &&
        (queryLower.includes('post') || queryLower.includes('video') || queryLower.includes('reel') ||
         queryLower.includes('mais') || queryLower.includes('instagram') || queryLower.includes('insta'))) {
      const resposta = await fetchTopPosts('views')
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Todos os Posts',
        },
      }
    }

    // ===== INSTAGRAM - POSTS MAIS COMPARTILHADOS =====
    if ((queryLower.includes('compartilh') || queryLower.includes('share') || queryLower.includes('enviou')) &&
        (queryLower.includes('post') || queryLower.includes('publicacao') || queryLower.includes('mais') ||
         queryLower.includes('instagram') || queryLower.includes('insta'))) {
      const resposta = await fetchTopPosts('shares')
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Todos os Posts',
        },
      }
    }

    // ===== INSTAGRAM - MELHOR POST / PERFORMANCE GERAL =====
    if ((queryLower.includes('melhor') || queryLower.includes('top') || queryLower.includes('destaque') || queryLower.includes('sucesso')) &&
        (queryLower.includes('post') || queryLower.includes('publicacao') || queryLower.includes('publicação') ||
         queryLower.includes('conteudo') || queryLower.includes('conteúdo') || queryLower.includes('instagram') || queryLower.includes('insta'))) {
      const resposta = await fetchTopPosts('all')
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Análise Completa',
        },
      }
    }

    // ===== INSTAGRAM - PUBLICAÇÕES POR TIPO =====
    if ((queryLower.includes('tipo') || queryLower.includes('formato') || queryLower.includes('categoria')) &&
        (queryLower.includes('conteudo') || queryLower.includes('conteúdo') || queryLower.includes('publicacao') || 
         queryLower.includes('publicação') || queryLower.includes('post') || queryLower.includes('instagram'))) {
      const resposta = await fetchPostsByType()
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Análise por Tipo',
        },
      }
    }

    // ===== INSTAGRAM - REELS =====
    if (queryLower.includes('reel') || queryLower.includes('reels')) {
      const resposta = await fetchTopPosts('views')
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Reels',
        },
      }
    }

    // ===== INSTAGRAM - ENGAJAMENTO =====
    if (queryLower.includes('engajamento') || queryLower.includes('engajament') || queryLower.includes('interacao') || queryLower.includes('interação')) {
      const resposta = await fetchInstagramMetrics()
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Métricas de Engajamento',
        },
      }
    }

    // ===== INSTAGRAM - PERFORMANCE POR TEMA =====
    if ((queryLower.includes('tema') || queryLower.includes('assunto') || queryLower.includes('categoria') || queryLower.includes('classificacao') || queryLower.includes('classificação')) &&
        (queryLower.includes('performance') || queryLower.includes('melhor') || queryLower.includes('engaj') || 
         queryLower.includes('funciona') || queryLower.includes('resultado') || queryLower.includes('comparar') ||
         queryLower.includes('qual') || queryLower.includes('ranking'))) {
      const resposta = await fetchThemePerformance()
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo',
          label: 'Ver Análise por Tema',
        },
      }
    }
    
    // ===== NOTÍCIAS EM DESTAQUE (painel) =====
    if (queryAsksNoticiasDestaque(queryLower)) {
      return buildNoticiasDestaqueChatMessage()
    }

    // ===== ALERTAS/NOTÍCIAS =====
    if (
      !queryAsksNoticiasDestaque(queryLower) &&
      (queryLower.includes('alerta') ||
        queryLower.includes('noticia') ||
        queryLower.includes('crise') ||
        queryLower.includes('critico') ||
        queryLower.includes('crítico'))
    ) {
      if (criticalAlerts.length > 0) {
        const alert = criticalAlerts[0]
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Encontrei ${criticalAlerts.length} alerta${criticalAlerts.length > 1 ? 's' : ''} crítico${criticalAlerts.length > 1 ? 's' : ''}:\n\n"${alert.title}"`,
          action: {
            type: alert.actionUrl?.startsWith('http') ? 'link' : 'navigate',
            url: alert.actionUrl || '/dashboard/noticias',
            label: alert.actionUrl?.startsWith('http') ? 'Abrir notícia' : 'Ver notícias',
          },
        }
      } else {
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Não há alertas críticos no momento. O radar de crises está limpo.',
        }
      }
    }
    
    // ===== TERRITÓRIOS FRIOS (GERAL) =====
    if ((queryLower.includes('territorio') || queryLower.includes('território') || queryLower.includes('frio')) && !cidade) {
      if (territoriosFrios.length > 0) {
        const top3 = territoriosFrios.slice(0, 3)
        const cidadesTexto = top3.map(t => `› ${t.cidade}: ${t.motivo}${t.expectativaVotos ? ` (${t.expectativaVotos.toLocaleString('pt-BR')} votos)` : ''}`).join('\n')
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: `**${territoriosFriosCount} territórios frios:**\n\n${cidadesTexto}`,
          action: {
            type: 'navigate',
            url: '/dashboard/territorio',
            label: 'Ver Análise Completa',
          },
        }
      } else {
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Excelente! Todos os territórios estão com boa cobertura.',
          action: {
            type: 'navigate',
            url: '/dashboard/territorio',
            label: 'Ver Território & Base',
          },
        }
      }
    }
    
    // ===== BANDEIRAS/NARRATIVAS =====
    if (queryLower.includes('bandeira') || queryLower.includes('narrativa')) {
      if (bandeirasCount > 0) {
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Você tem **${bandeirasCount} bandeira${bandeirasCount > 1 ? 's' : ''}** ativa${bandeirasCount > 1 ? 's' : ''} com performance média de **${bandeirasPerformance}%**.`,
          action: {
            type: 'navigate',
            url: '/dashboard/narrativas',
            label: 'Ver Bandeiras',
          },
        }
      }
    }
    
    // ===== EXPECTATIVA GERAL =====
    if ((queryLower.includes('expectativa') || queryLower.includes('projecao')) && !cidade) {
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: `**Expectativa de votos 2026:** ${typeof expectativa2026 === 'number' ? expectativa2026.toLocaleString('pt-BR') : expectativa2026 || 'não calculada'}\n\n**Presença territorial:** ${presencaTerritorial || 'não calculada'}`,
        action: {
          type: 'navigate',
          url: '/dashboard/territorio',
          label: 'Ver Território',
        },
      }
    }
    
    // ===== AGENDA GERAL (Google Calendar — mesma fonte da página Agenda) =====
    if (
      queryLower.includes('agenda') ||
      queryLower.includes('compromisso') ||
      (queryLower.includes('evento') && /\b(hoje|amanha|ontem|agenda)\b/.test(queryLower))
    ) {
      const outcome = await fetchAgendaOutcome(query)
      return buildAgendaChatMessage(outcome)
    }

    // ===== CONSULTA SOBRE CIDADE SEM INDICADOR ESPECÍFICO =====
    if (cidade && !queryLower.includes('pesquisa')) {
      const expectativaResp = await fetchExpectativaCidade(cidade)
      syncExpectativaDetalhePending({ cidade })
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: expectativaResp,
        action: {
          type: 'navigate',
          url: '/dashboard/territorio',
          label: 'Ver Território & Base',
        },
      }
    }
    
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: buildUnknownQueryReply(),
    }
  }, [
    criticalAlerts,
    territoriosFrios,
    territoriosFriosCount,
    bandeirasCount,
    bandeirasPerformance,
    expectativa2026,
    presencaTerritorial,
    resumoDemandasAssistPhase,
    fetchPesquisasOutcome,
    buildPesquisasChatMessage,
    buildNoticiasDestaqueChatMessage,
    fetchAgendaOutcome,
    buildAgendaChatMessage,
    fetchCampoVisitasOutcome,
  ])

  const buildAgentContext = useCallback((): AgentContextPayload => {
    const pc = pageContextRef.current
    return {
      pageKind:
        pc?.kind === 'resumo-eleicoes'
          ? 'resumo-eleicoes'
          : pc?.kind === 'campo'
            ? 'campo'
            : 'dashboard',
      cidadeAtual: pc?.kind === 'resumo-eleicoes' ? pc.cidadeAtual : undefined,
      buscaIniciada: pc?.kind === 'resumo-eleicoes' ? pc.buscaIniciada : undefined,
      candidatoPadrao,
      cidadesDisponiveis:
        pc?.kind === 'resumo-eleicoes' || pc?.kind === 'campo'
          ? pc.cidades.slice(0, 40)
          : undefined,
      alertsCriticosCount,
      territoriosFriosCount,
      pollsCount,
      expectativa2026: expectativa2026 != null ? String(expectativa2026) : undefined,
      presencaTerritorial,
    }
  }, [
    alertsCriticosCount,
    candidatoPadrao,
    expectativa2026,
    pollsCount,
    presencaTerritorial,
    territoriosFriosCount,
  ])

  const tryAgentChat = useCallback(
    async (message: string, history: ChatMessage[]): Promise<ChatMessage | null> => {
      try {
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            history: history.slice(-4).map((m) => ({ role: m.role, content: m.content })),
            context: buildAgentContext(),
            sessionId: getAgentSessionId(),
          }),
        })

        if (!res.ok) return null

        const data = (await res.json()) as AgentChatResponse & { hint?: string }

        if (data.source === 'fallback') {
          if (data.meta?.rateLimited && data.hint) {
            return {
              id: Date.now().toString(),
              role: 'assistant',
              content: `${data.hint}\n\nContinuo respondendo com os comandos habituais.`,
            }
          }
          return null
        }

        if (data.clientQuery?.trim()) {
          const legacy = await processUserQuery(data.clientQuery.trim())
          return { ...legacy, viaAi: true }
        }

        if (data.content?.trim()) {
          if (data.pesquisaTipoPending) {
            setPesquisaTipoPending(data.pesquisaTipoPending)
          }
          if (data.agendaScopePending) {
            syncAgendaScopePending(data.agendaScopePending)
          }
          const autoNavigate = data.meta?.intent === 'navegar'
          return {
            id: Date.now().toString(),
            role: 'assistant',
            content: data.content.trim(),
            speechSegments: data.speechSegments,
            action: data.action,
            viaAi: true,
            autoNavigate,
          }
        }

        return null
      } catch {
        return null
      }
    },
    [buildAgentContext, processUserQuery, syncAgendaScopePending]
  )

  const speakJarvisReply = useCallback(
    (content: string, segments?: string[]) => {
      if (!enableVoice) return
      stopSpeakingReplyRef.current?.()
      void speakText(content, {
        segments,
        onStart: () => {
          setVoiceError(null)
          setIsSpeaking(true)
        },
        onEnd: () => setIsSpeaking(false),
        onError: (msg) => {
          setIsSpeaking(false)
          if (msg) setVoiceError(msg)
        },
      }).then((cancel) => {
        stopSpeakingReplyRef.current = cancel
      })
    },
    [enableVoice]
  )

  const scheduleJarvisAnswerSpeech = useCallback(
    (content: string, segments?: string[]) => {
      if (!enableVoice) return
      if (jarvisLoadingSpeechRef.current) {
        jarvisPendingAnswerRef.current = { content, segments }
        return
      }
      speakJarvisReply(content, segments)
    },
    [enableVoice, speakJarvisReply]
  )

  const deliverAssistantResponse = useCallback(
    (response: ChatMessage, userQuery: string) => {
      if (response.autoNavigate && response.action?.type === 'navigate') {
        router.push(response.action.url)
      }

      setChatMessages((prev) => [...prev, response])
      if (response.role !== 'assistant') return

      if (isJarvisHud && shouldShowJarvisResultPopup(response.content)) {
        try {
          setJarvisResultPopup({
            id: response.id,
            view: parseJarvisResultContent(response.content, userQuery),
            action: response.action,
          })
          scheduleJarvisAnswerSpeech(response.content, response.speechSegments)
          return
        } catch (err) {
          console.error('[Jarvis] falha ao montar painel de resultado:', err)
        }
      }

      scheduleJarvisAnswerSpeech(response.content, response.speechSegments)
    },
    [isJarvisHud, router, scheduleJarvisAnswerSpeech]
  )

  const handleJarvisResultClose = useCallback(() => {
    setJarvisResultPopup(null)
    jarvisPendingAnswerRef.current = null
  }, [])

  const submitMessage = useCallback(async (content: string) => {
    const cleanedContent = content.trim()
    if (!cleanedContent || isProcessing) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: cleanedContent,
    }

    setChatMessages(prev => [...prev, userMessage])
    setJarvisResultPopup(null)
    jarvisPendingAnswerRef.current = null
    setIsProcessing(true)

    const expectativaFollowUpFromHistory = detectExpectativaDetalheFollowUp(
      chatMessages,
      cleanedContent
    )

    const playLoadingPhrase =
      enableVoice &&
      shouldPlayJarvisLoadingPhrase(cleanedContent, {
        pesquisaTipoPending: Boolean(pesquisaTipoPending),
        agendaScopePending: Boolean(agendaScopePendingRef.current),
        expectativaDetalhePending:
          Boolean(expectativaDetalhePendingRef.current) || Boolean(expectativaFollowUpFromHistory),
        parsePesquisaTipo: parsePesquisaTipoFromQuery,
        parseAgendaDayScope: parseAgendaDayScopeFromAnswer,
        isExpectativaAffirmative: isExpectativaDetalheAffirmative,
        isExpectativaNegative: isExpectativaDetalheNegative,
      })

    if (playLoadingPhrase) {
      jarvisLoadingSpeechRef.current = true
      stopSpeakingReplyRef.current?.()
      void speakText(pickJarvisLoadingPhrase(), {
        onStart: () => {
          setVoiceError(null)
          setIsSpeaking(true)
        },
        onEnd: () => {
          jarvisLoadingSpeechRef.current = false
          setIsSpeaking(false)
          const pending = jarvisPendingAnswerRef.current
          if (pending) {
            jarvisPendingAnswerRef.current = null
            speakJarvisReply(pending.content, pending.segments)
          }
        },
        onError: (msg) => {
          jarvisLoadingSpeechRef.current = false
          setIsSpeaking(false)
          if (msg) setVoiceError(msg)
        },
      }).then((cancel) => {
        stopSpeakingReplyRef.current = cancel
      })
    }

    try {
      let response: ChatMessage | null = null

      if (pesquisaTipoPending) {
        const tipo = parsePesquisaTipoFromQuery(cleanedContent)
        if (tipo) {
          const outcome = await fetchPesquisasOutcome(
            pesquisaTipoPending.termo,
            tipo,
            pesquisaTipoPending,
            { focoJadyel: pesquisaTipoPending.focoJadyel }
          )
          response = buildPesquisasChatMessage(outcome, { viaAi: true })
        } else {
          response = {
            id: Date.now().toString(),
            role: 'assistant',
            content:
              'Para listar os candidatos, responda **estimulada** ou **espontânea**.',
          }
        }
      } else if (agendaScopePendingRef.current) {
        const pending = agendaScopePendingRef.current
        const dayScope = parseAgendaDayScopeFromAnswer(cleanedContent)
        if (dayScope) {
          const outcome = await fetchAgendaOutcome('', {
            scopePending: pending,
            dayScope,
            cidade: pending.cidade,
          })
          response = buildAgendaChatMessage(outcome, { viaAi: true })
        } else {
          response = {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Responda **próximos** (só o que falta hoje) ou **todos** (dia inteiro, inclusive o que já passou).',
          }
        }
      } else {
        const sidebarNav = detectSidebarNavigate(cleanedContent, pathnameRef.current)
        if (sidebarNav) {
          syncExpectativaDetalhePending(null)
          response = buildSidebarNavChatMessage(sidebarNav)
        } else {
        const expectativaCidade =
          expectativaDetalhePendingRef.current?.cidade ??
          expectativaFollowUpFromHistory?.cidade

        if (expectativaCidade) {
          const querDetalhe =
            isExpectativaDetalheAffirmative(cleanedContent) ||
            expectativaFollowUpFromHistory?.kind === 'affirmative'
          const recusaDetalhe =
            isExpectativaDetalheNegative(cleanedContent) ||
            expectativaFollowUpFromHistory?.kind === 'negative'

          if (recusaDetalhe) {
            syncExpectativaDetalhePending(null)
            response = {
              id: Date.now().toString(),
              role: 'assistant',
              content: EXPECTATIVA_DETALHE_DISMISS_REPLY,
            }
          } else if (querDetalhe) {
            const resposta = await fetchExpectativaCidade(expectativaCidade, {
              detalhe: true,
            })
            syncExpectativaDetalhePending(null)
            response = {
              id: Date.now().toString(),
              role: 'assistant',
              content: resposta,
              action: {
                type: 'navigate',
                url: '/dashboard/territorio',
                label: 'Ver Território Completo',
              },
            }
          } else {
            syncExpectativaDetalhePending({ cidade: expectativaCidade })
            response = {
              id: Date.now().toString(),
              role: 'assistant',
              content:
                'Responda **sim** se quiser o detalhamento por liderança, ou **não** se já está bom assim.',
            }
          }
        }
        }
      }

      if (!response && isGreetingQuery(cleanedContent)) {
        response = {
          id: Date.now().toString(),
          role: 'assistant',
          content: buildGreetingReply(cleanedContent),
        }
      }

      if (!response && isHelpQuery(cleanedContent)) {
        response = {
          id: Date.now().toString(),
          role: 'assistant',
          content: buildHelpReply(),
        }
      }

      if (!response && queryAsksNoticiasDestaque(normalizeText(cleanedContent))) {
        response = await buildNoticiasDestaqueChatMessage()
      }

      if (!response && resumoDemandasAssistPhase === 'idle') {
        response = await tryAgentChat(cleanedContent, chatMessages)
      }

      if (!response) {
        response = await processUserQuery(cleanedContent)
      }

      deliverAssistantResponse(response, cleanedContent)
    } catch (error) {
      const errorReply = 'Desculpe, ocorreu um erro. Tente novamente.'
      deliverAssistantResponse(
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: errorReply,
        },
        cleanedContent
      )
    } finally {
      setIsProcessing(false)
    }
  }, [
    chatMessages,
    enableVoice,
    isProcessing,
    pesquisaTipoPending,
    syncExpectativaDetalhePending,
    agendaScopePending,
    fetchAgendaOutcome,
    buildAgendaChatMessage,
    buildNoticiasDestaqueChatMessage,
    processUserQuery,
    resumoDemandasAssistPhase,
    tryAgentChat,
    fetchPesquisasOutcome,
    buildPesquisasChatMessage,
    fetchExpectativaCidade,
    deliverAssistantResponse,
    speakJarvisReply,
  ])

  const submitMessageRef = useRef<(content: string) => Promise<void>>(async () => {})
  useEffect(() => {
    submitMessageRef.current = submitMessage
  }, [submitMessage])

  // Enviar mensagem digitada
  const handleSendMessage = useCallback(async () => {
    const currentInput = userInput.trim()
    if (!currentInput) return
    setUserInput('')
    await submitMessage(currentInput)
  }, [userInput, submitMessage])

  // Executar ação
  const handleAction = useCallback((action: ChatMessage['action']) => {
    if (!action) return
    
    if (action.type === 'navigate') {
      router.push(action.url)
    } else if (action.type === 'link') {
      window.open(action.url, '_blank')
    }
  }, [router])

  const currentInsight = insights[currentMessageIndex]

  // Efeito de digitação
  useEffect(() => {
    if (chatMode || !currentInsight) return

    setIsTyping(true)
    setDisplayedText('')
    
    const text = currentInsight.message
    let charIndex = 0
    
    const typeInterval = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayedText(text.slice(0, charIndex + 1))
        charIndex++
      } else {
        clearInterval(typeInterval)
        setIsTyping(false)
        
        if (!completedMessages.includes(currentInsight.id)) {
          setCompletedMessages(prev => [...prev, currentInsight.id])
        }
        
        if (currentMessageIndex < insights.length - 1) {
          setTimeout(() => {
            setCurrentMessageIndex(prev => prev + 1)
          }, currentInsight.loaded ? 1000 : 600)
        }
      }
    }, 20)

    return () => clearInterval(typeInterval)
  }, [currentMessageIndex, currentInsight, chatMode])

  const totalItems = 3
  const loadedItems = [!loadingKPIs, !loadingAlerts, !loadingTerritorios].filter(Boolean).length
  const progress = (loadedItems / totalItems) * 100
  const allLoaded = !loadingKPIs && !loadingAlerts && !loadingTerritorios

  // Ativar modo chat
  useEffect(() => {
    if (allLoaded && currentMessageIndex >= insights.length - 1 && !isTyping) {
      const timer = setTimeout(() => {
        setChatMode(true)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [allLoaded, currentMessageIndex, insights.length, isTyping])

  useEffect(() => {
    setChatMessages([])
    setCurrentMessageIndex(0)
    setCompletedMessages([])
  }, [])

  useEffect(() => {
    return () => {
      stopSpeakingReplyRef.current?.()
      stopSpeaking()
    }
  }, [])

  useEffect(() => {
    if (!enableVoice || typeof window === 'undefined' || !isSpeechSynthesisSupported()) return
    const loadVoices = () => {
      window.speechSynthesis.getVoices()
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [enableVoice])

  useEffect(() => {
    if (!enableVoice || typeof window === 'undefined') return

    const SpeechRecognitionAPI =
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructorLike }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructorLike }).webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      setSpeechSupported(false)
      setSpeechCapabilityResolved(true)
      return
    }

    setSpeechSupported(true)
    setSpeechCapabilityResolved(true)
    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i]
        transcript += result?.[0]?.transcript ?? ''
      }
      const cleaned = transcript.trim()
      pendingSpeechRef.current = cleaned
      setUserInput(cleaned)
    }

    recognition.onerror = (event: Event) => {
      const code =
        typeof event === 'object' &&
        event !== null &&
        'error' in event &&
        typeof (event as { error?: string }).error === 'string'
          ? (event as { error: string }).error
          : undefined
      if (code === 'not-allowed') {
        void (async () => {
          const detailedMessage = await diagnoseSpeechNotAllowed()
          setVoiceError(detailedMessage)
        })()
        setIsListening(false)
        return
      }
      const msg = speechRecognitionErrorMessage(code, {
        isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
      })
      if (msg) setVoiceError(msg)
      setIsListening(false)
    }

    recognition.onend = () => {
      stopSpeechKeepAlive()
      setIsListening(false)
      const text = pendingSpeechRef.current.trim()
      pendingSpeechRef.current = ''
      if (text) {
        setUserInput('')
        void submitMessageRef.current(text)
      }
    }

    recognitionRef.current = recognition

    return () => {
      try {
        recognition.stop()
      } catch {
        /* já parado */
      }
      recognitionRef.current = null
      setIsListening(false)
      pendingSpeechRef.current = ''
    }
  }, [enableVoice])

  const handleToggleVoiceListening = useCallback(() => {
    if (!recognitionRef.current) {
      setVoiceError('Microfone indisponível — recarregue a página ou use Chrome/Edge.')
      return
    }

    stopSpeakingReplyRef.current?.()
    stopSpeaking()
    setIsSpeaking(false)

    if (isListening) {
      stopSpeechKeepAlive()
      try {
        recognitionRef.current.stop()
      } catch {
        setIsListening(false)
      }
      return
    }

    setVoiceError(null)
    pendingSpeechRef.current = ''
    setUserInput('')

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setVoiceError(
        [
          'Este endereço não é um contexto seguro (ex.: http:// + IP na rede).',
          'O Chrome costuma bloquear microfone mesmo com permissões.',
          'Use HTTPS ou http://localhost / http://127.0.0.1 na máquina do servidor.',
        ].join('\n'),
      )
      return
    }

    // Desbloqueia áudio/TTS no gesto do toque (obrigatório no iOS antes de respostas assíncronas).
    unlockJarvisAudio()
    startSpeechKeepAlive()

    // Não usar await/getUserMedia aqui: após um await o navegador perde o "gesto do usuário"
    // e o pré-check pode falhar mesmo com permissão já concedida ao site.
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch {
      setIsListening(false)
      setVoiceError('Aguarde um segundo e tente de novo (o microfone pode estar ocupado).')
    }
  }, [isListening])

  const jarvisLogLines = useMemo((): JarvisLogLine[] => {
    return chatMessages.slice(-14).map((m) => ({
      tag: m.role === 'user' ? 'USER' : 'JARVIS',
      message: m.content.replace(/\n/g, ' ').slice(0, 220),
      tone: m.role === 'user' ? 'default' : 'success',
      at: new Date(Number(m.id) || Date.now()).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
    }))
  }, [chatMessages])

  const jarvisLastAction = useMemo((): ChatMessage['action'] => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      const msg = chatMessages[i]
      if (msg.role === 'assistant' && msg.action) return msg.action
    }
    return undefined
  }, [chatMessages])

  const jarvisStatusMessage = useMemo(() => {
    if (jarvisResultPopup && isSpeaking) return 'APRESENTANDO RESULTADO · JARVIS FALANDO'
    if (jarvisResultPopup) return 'RESULTADO NA TELA · JARVIS ATIVO'
    if (isProcessing && isSpeaking) return 'BUSCANDO DADOS · UM MOMENTO'
    if (isSpeaking) return 'SINTETIZANDO RESPOSTA · FALANDO'
    if (isProcessing) return 'PROCESSANDO CONSULTA · AGUARDE'
    if (isListening) return 'ESCUTA ATIVA · FALE SUA PERGUNTA'
    if (allLoaded) return 'JARVIS ONLINE · SISTEMAS PRONTOS · COCKPIT 2026'
    return 'INICIALIZANDO NÚCLEO NEURAL · CARREGANDO MÓDULOS'
  }, [isProcessing, isListening, isSpeaking, allLoaded, jarvisResultPopup])

  if (!showAgent) return null

  const dockInline = dockVariant === 'inline'

  if (isJarvisHud) {
    if (isMinimized) {
      return (
        <div className={cn(dockInline ? 'relative z-40' : 'fixed bottom-6 right-6 z-[100]')}>
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className={cn(
              'relative flex items-center justify-center rounded-full border-2 border-[var(--color-core)] bg-[var(--color-void)] shadow-[0_0_24px_rgba(0,212,255,0.35)] transition-transform hover:scale-105',
              floatingMode ? 'h-12 w-12 sm:h-14 sm:w-14' : 'h-14 w-14'
            )}
            style={jarvisHudStyle as React.CSSProperties}
            title="Abrir Jarvis"
          >
            <Bot className={cn('text-[var(--color-core)]', floatingMode ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-7 w-7')} />
            {(isSpeaking || isListening || isProcessing) && (
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-[var(--color-online)]" />
            )}
            {(alertsCriticosCount > 0 || territoriosFriosCount > 0) && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-online)] text-[9px] font-medium text-[var(--color-void)]">
                {alertsCriticosCount + territoriosFriosCount}
              </span>
            )}
          </button>
        </div>
      )
    }

    const compactHud = hudLayout === 'compact'

    return (
      <div
        className={cn(
          'transition-all duration-500',
          fullPageHud
            ? 'relative z-40 flex h-full min-h-0 w-full flex-1 flex-col'
            : dockInline
              ? 'relative z-40 w-full'
              : cn(
                  'fixed z-[100]',
                  compactHud
                    ? 'bottom-4 right-4 w-[min(calc(100vw-2rem),20rem)] sm:bottom-5 sm:right-5 sm:w-[22rem]'
                    : 'bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[min(100%,1100px)]'
                )
        )}
        style={fullPageHud ? undefined : { maxHeight: maxPanelHeight }}
      >
        <JarvisHudShell
          statusMessage={jarvisStatusMessage}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
          enableVoice={enableVoice}
          speechSupported={speechSupported}
          voiceError={voiceError}
          onMicClick={handleToggleVoiceListening}
          onMinimize={fullPageHud ? undefined : () => setIsMinimized(true)}
          lastAction={jarvisLastAction}
          onActionClick={handleAction}
          logLines={jarvisLogLines}
          hudLayout={hudLayout}
          resultPanel={
            jarvisResultPopup
              ? { view: jarvisResultPopup.view, action: jarvisResultPopup.action }
              : null
          }
          onResultPanelClose={handleJarvisResultClose}
          onResultPanelAction={(action) => handleAction(action)}
          className={cn(
            fullPageHud
              ? 'h-full min-h-0 flex-1'
              : compactHud
                ? 'h-full min-h-0 min-h-[min(320px,calc(100vh-6rem))]'
                : 'h-full min-h-[min(520px,calc(100vh-7rem))]'
          )}
          style={fullPageHud ? undefined : { maxHeight: maxPanelHeight }}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'transition-all duration-500',
        dockInline
          ? cn('relative z-40', isMinimized ? 'h-14 w-14' : 'w-full max-w-[420px]')
          : cn('fixed bottom-6 right-6 z-[100]', isMinimized ? 'w-14 h-14' : 'w-[420px]'),
      )}
    >
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-gold to-accent-gold shadow-lg shadow-accent-gold/30 flex items-center justify-center hover:scale-110 transition-transform relative"
        >
          <Bot className="w-7 h-7 text-white" />
          {!allLoaded && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full animate-pulse" />
          )}
          {allLoaded && (alertsCriticosCount > 0 || territoriosFriosCount > 0) && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-status-danger rounded-full text-[10px] font-bold text-white flex items-center justify-center">
              {alertsCriticosCount + territoriosFriosCount}
            </span>
          )}
        </button>
      ) : (
        <div
          className="bg-surface rounded-2xl shadow-card shadow-accent-gold/10 border border-card overflow-hidden flex flex-col"
          style={{ maxHeight: maxPanelHeight }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-accent-gold to-accent-gold px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                {!allLoaded && (
                  <span className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
                )}
                {allLoaded && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-status-success rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{agentTitle}</h3>
                <p className="text-[10px] text-white/70">
                  {chatMode
                    ? pageContext?.kind === 'resumo-eleicoes'
                      ? 'Cidade + Buscar; depois abrir demandas (voz ou texto)'
                      : agentTitle === 'Jarvis'
                        ? enableVoice && speechCapabilityResolved && speechSupported
                          ? 'Assistente do Cockpit · digite ou fale em linguagem natural'
                          : 'Assistente do Cockpit · pergunte sobre campanha e dados'
                        : enableVoice && speechCapabilityResolved && speechSupported
                        ? 'Digite ou use o microfone — a transcrição aparece ao vivo'
                        : enableVoice && speechCapabilityResolved && !speechSupported
                          ? 'Este navegador não suporta voz; use o teclado'
                          : 'Pergunte sobre cidades, chapas, lideranças...'
                    : allLoaded
                      ? 'Pronto!'
                      : 'Analisando...'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {!chatMode && (
            <div className="h-1 bg-accent-gold-soft flex-shrink-0">
              <div 
                className="h-full bg-gradient-to-r from-accent-gold to-accent-gold transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Conteúdo */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 min-h-0">
            {!chatMode ? (
              <>
                <div className="space-y-2 mb-3">
                  {insights.slice(0, currentMessageIndex).map((insight) => (
                    <div
                      key={insight.id}
                      className={`text-xs p-2 rounded-lg ${
                        insight.type === 'warning' ? 'bg-amber-50 text-amber-700' :
                        insight.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-slate-50 text-slate-600'
                      } opacity-70`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 opacity-60">{insight.icon}</span>
                        <span>{insight.message}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {currentInsight && (
                  <div className={`p-3 rounded-xl ${
                    currentInsight.type === 'loading' ? 'bg-blue-50 border border-blue-100' :
                    currentInsight.type === 'warning' ? 'bg-amber-50 border border-amber-100' :
                    currentInsight.type === 'success' ? 'bg-emerald-50 border border-emerald-100' :
                    'bg-slate-50 border border-slate-100'
                  }`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 ${
                        currentInsight.type === 'loading' ? 'text-blue-500 animate-pulse' :
                        currentInsight.type === 'warning' ? 'text-amber-500' :
                        currentInsight.type === 'success' ? 'text-emerald-500' :
                        'text-slate-500'
                      }`}>
                        {currentInsight.icon}
                      </span>
                      <p className={`text-sm leading-relaxed ${
                        currentInsight.type === 'loading' ? 'text-blue-700' :
                        currentInsight.type === 'warning' ? 'text-amber-700' :
                        currentInsight.type === 'success' ? 'text-emerald-700' :
                        'text-slate-700'
                      }`}>
                        {displayedText}
                        {isTyping && (
                          <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse" />
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {chatMessages.length === 0 && (
                  <div className="p-3 rounded-xl bg-accent-gold-soft border border-accent-gold">
                    {pageContext?.kind === 'resumo-eleicoes' ? (
                      <>
                        <p className="text-sm text-text-primary font-medium">
                          Olá! Posso preencher Cidade, acionar Buscar e, com dados carregados, abrir o fluxo de **Demandas** (escopo de lideranças).
                        </p>
                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-accent-gold font-bold">Exemplos:</p>
                          <p className="text-xs text-accent-gold">› Buscar Teresina</p>
                          <p className="text-xs text-accent-gold">› Picos</p>
                          <p className="text-xs text-accent-gold">› abrir demandas (após buscar)</p>
                          <p className="text-xs text-accent-gold">› ver lideranças / ver pesquisas</p>
                          <p className="text-xs text-accent-gold">› fechar / fechar modais</p>
                          <p className="text-xs text-accent-gold">› Atualizar (cidade já selecionada)</p>
                          <p className="text-xs text-accent-gold">› listar cidades</p>
                          <p className="text-xs text-accent-gold">› ajuda</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-text-primary font-medium">
                          Olá! Pergunte em linguagem natural — a IA interpreta e busca os dados.
                        </p>
                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-accent-gold font-bold">Exemplos:</p>
                          <p className="text-xs text-accent-gold">› expectativa em Teresina</p>
                          <p className="text-xs text-accent-gold">› projeção chapa federal</p>
                          <p className="text-xs text-accent-gold">› métricas do Instagram</p>
                          <p className="text-xs text-accent-gold">› posts mais curtidos</p>
                          <p className="text-xs text-accent-gold">› evolução de seguidores</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                    <div className={`p-3 rounded-xl max-w-[95%] ${
                      msg.role === 'user' ? 'bg-accent-gold text-white' : 'bg-app border border-card text-text-primary'
                    }`}>
                      <p className="text-sm whitespace-pre-line">{msg.content}</p>
                      {msg.viaAi ? (
                        <p className="mt-1.5 text-[10px] text-text-muted">Interpretado por IA (Groq)</p>
                      ) : null}

                      {msg.action && (
                        <button
                          onClick={() => handleAction(msg.action)}
                          className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-accent-gold text-white text-xs font-bold rounded-lg hover:bg-accent-gold transition-colors w-full justify-center"
                        >
                          {msg.action.type === 'link' ? (
                            <ExternalLink className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowRight className="w-3.5 h-3.5" />
                          )}
                          {msg.action.label}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {isProcessing && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-gold-soft">
                    <Loader2 className="w-4 h-4 text-accent-gold animate-spin" />
                    <span className="text-xs text-text-primary font-medium">Interpretando...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {chatMode && (
            <div className="p-3 border-t border-card flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    isListening
                      ? 'Ouvindo... Diga sua pergunta.'
                      : pageContext?.kind === 'resumo-eleicoes'
                        ? 'Ex: Buscar Teresina · listar cidades · ajuda'
                        : 'Pergunte em linguagem natural ou use comandos diretos...'
                  }
                  aria-busy={isListening}
                  className={`flex-1 px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-gold focus:border-transparent ${
                    isListening
                      ? 'border-accent-gold/50 bg-accent-gold-soft/35 ring-2 ring-accent-gold/25'
                      : 'border-card'
                  }`}
                  disabled={isProcessing}
                />
                {enableVoice && speechSupported && (
                  <button
                    type="button"
                    onClick={handleToggleVoiceListening}
                    disabled={isProcessing}
                    title={isListening ? 'Parar gravação de voz' : 'Falar com o agente'}
                    className={`p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isListening
                        ? 'bg-status-danger text-white hover:bg-status-danger'
                        : 'bg-background text-text-primary border border-card hover:bg-app'
                    }`}
                  >
                    <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                  </button>
                )}
                <button
                  onClick={handleSendMessage}
                  disabled={!userInput.trim() || isProcessing}
                  className="p-2 bg-accent-gold text-white rounded-xl hover:bg-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              {isListening && (
                <p className="mt-2 text-[11px] font-medium text-accent-gold animate-pulse">
                  Ouvindo... — fale e aguarde o envio automático ao terminar a frase.
                </p>
              )}
              {isSpeaking && (
                <p className="mt-2 text-[11px] font-medium text-accent-gold">
                  Falando resposta...
                </p>
              )}
              {enableVoice && chatMode && speechCapabilityResolved && !speechSupported && (
                <p className="mt-2 text-[11px] text-text-secondary">
                  Reconhecimento de voz indisponível (use Chrome ou Edge em HTTPS / localhost).
                </p>
              )}
              {voiceError && (
                <p
                  className="mt-2 text-[11px] font-medium text-status-danger whitespace-pre-line leading-snug"
                  role="alert"
                >
                  {voiceError}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
