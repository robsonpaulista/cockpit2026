'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Sparkles, TrendingUp, AlertTriangle, MapPin, BarChart3, CheckCircle2, Send, ExternalLink, ArrowRight, Loader2, Users, Calendar, Vote, FileText, Flag, Target, Building2, Clock, CheckCheck, XCircle, Circle, ChevronRight, Zap, MessageSquare, HelpCircle, Instagram, Heart, Eye, Share2, Image, Video, Play } from 'lucide-react'

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
  action?: {
    type: 'navigate' | 'link'
    url: string
    label: string
  }
}

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

// Lista de cidades do Piauí para melhor reconhecimento
const cidadesPiaui = [
  'teresina', 'picos', 'parnaiba', 'floriano', 'piripiri', 'campo maior', 'oeiras', 
  'barras', 'pedro ii', 'paes landim', 'jose de freitas', 'uruçui', 'bom jesus', 
  'corrente', 'agua branca', 'altos', 'amarante', 'angical', 'batalha', 'canto do buriti',
  'castelo', 'cocal', 'demerval lobao', 'elesbao veloso', 'esperantina', 'fronteiras',
  'guadalupe', 'ilha grande', 'inhuma', 'itainopolis', 'jaicos', 'joaquim pires',
  'lagoa do piaui', 'luzilandia', 'miguel alves', 'miguel leao', 'monsenhor gil',
  'nazare', 'nossa senhora', 'palmeirais', 'paulistana', 'pimenteiras', 'pio ix',
  'piracuruca', 'regeneracao', 'ribeiro goncalves', 'santa cruz', 'santa filomena',
  'santana', 'santo antonio', 'sao felix', 'sao goncalo', 'sao joao', 'sao jose',
  'sao miguel', 'sao pedro', 'sao raimundo', 'simoes', 'simplicio', 'socorro', 'uniao', 
  'valenca', 'varzea', 'luzilândia', 'são joão do piauí', 'são raimundo nonato',
  'alto longa', 'beneditinos', 'buriti dos lopes', 'cabeceiras do piauí', 'cajueiro da praia',
  'campo largo', 'capitão de campos', 'caracol', 'cocal de telha', 'cocal dos alves',
  'colônia do gurguéia', 'cristino castro', 'curimatá', 'dom expedito lopes', 'dom inocêncio',
  'domingos mourao', 'eliseu martins', 'fartura do piaui', 'flores do piaui', 'francinopolis',
  'gilbues', 'hugo napoleao', 'ipiranga do piaui', 'isaias coelho', 'itaueira', 'jacobina do piaui',
  'jardim do mulato', 'jatoba do piaui', 'jerumenha', 'joao costa', 'juazeiro do piaui',
  'julio borges', 'jurema', 'lagoa alegre', 'lagoa de sao francisco', 'lagoa do barro do piaui',
  'lagoa do sitio', 'lagoinha do piaui', 'landri sales', 'luis correia', 'madeiro',
  'manoel emidio', 'marcolandia', 'marcos parente', 'massape do piaui', 'matias olimpio',
  'morro cabeca no tempo', 'morro do chapeu do piaui', 'murici dos portelas', 'nazaria',
  'nossa senhora de nazare', 'nossa senhora dos remedios', 'novo oriente do piaui',
  'novo santo antonio', 'paqueta', 'parnagua', 'passagem franca do piaui', 'patos do piaui',
  'pau darco do piaui', 'paulistana', 'pavussu', 'pedro laurentino', 'porto alegre do piaui',
  'queimada nova', 'redencao do gurgueia', 'riacho frio', 'ribeira do piaui', 'rio grande do piaui',
  'santa cruz do piaui', 'santa cruz dos milagres', 'santa luz', 'santa rosa do piaui',
  'santana do piaui', 'santo antonio de lisboa', 'santo antonio dos milagres', 'santo inacio do piaui',
  'sao braz do piaui', 'sao felix do piaui', 'sao francisco de assis do piaui',
  'sao francisco do piaui', 'sao goncalo do gurgueia', 'sao goncalo do piaui',
  'sao joao da canabrava', 'sao joao da fronteira', 'sao joao da serra', 'sao joao da varjota',
  'sao joao do arraial', 'sao jose do divino', 'sao jose do peixe', 'sao jose do piaui',
  'sao juliao', 'sao lourenco do piaui', 'sao luis do piaui', 'sao miguel da baixa grande',
  'sao miguel do fidalgo', 'sao miguel do tapuio', 'sao pedro do piaui', 'sao raimundo nonato',
  'sebastiao barros', 'sebastiao leal', 'sigefredo pacheco', 'simoes', 'socorro do piaui',
  'sussuapara', 'tamboril do piaui', 'tanque do piaui', 'vera mendes', 'vila nova do piaui',
  'wall ferraz'
]

// Extrair nome de cidade da query
function extractCityName(query: string): string | null {
  const normalized = normalizeText(query)
  
  // Primeiro tentar encontrar cidade conhecida na query
  for (const cidade of cidadesPiaui) {
    const cidadeNorm = normalizeText(cidade)
    if (normalized.includes(cidadeNorm)) {
      return cidade
    }
  }
  
  // Padrões para extrair cidade de forma genérica
  const patterns = [
    /em\s+([a-z\s]+?)(?:\?|$|,|\.|!|;)/,
    /de\s+([a-z\s]+?)(?:\?|$|,|\.|!|;)/,
    /cidade\s+(?:de\s+)?([a-z\s]+?)(?:\?|$|,|\.|!|;)/,
    /para\s+([a-z\s]+?)(?:\?|$|,|\.|!|;)/,
  ]
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match && match[1]) {
      const candidata = match[1].trim()
      // Verificar se é uma cidade conhecida
      const cidadeEncontrada = cidadesPiaui.find(c => 
        normalizeText(c).includes(candidata) || candidata.includes(normalizeText(c))
      )
      if (cidadeEncontrada) return cidadeEncontrada
      // Se não é conhecida mas parece ser uma cidade, retornar
      if (candidata.length >= 3 && candidata.length <= 30) {
        return candidata
      }
    }
  }
  
  return null
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
}: AIAgentProps) {
  const router = useRouter()
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showAgent, setShowAgent] = useState(true)
  const [completedMessages, setCompletedMessages] = useState<string[]>([])
  
  // Chat interativo
  const [chatMode, setChatMode] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

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
  const fetchExpectativaCidade = async (cidade: string): Promise<string> => {
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
      let resposta = `**${cidadeFormatada}**\n\n`
      resposta += `Expectativa 2026: **${Math.round(totalExpectativa).toLocaleString('pt-BR')} votos**\n`
      resposta += `Lideranças: **${registrosCidade.length}**`
      
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

  // Buscar agendas de uma cidade
  const fetchAgendasCidade = async (cidade: string): Promise<string> => {
    try {
      const response = await fetch('/api/campo/agendas')
      if (!response.ok) {
        return `Erro ao buscar agendas.`
      }

      const agendas = await response.json()
      const cidadeNorm = normalizeText(cidade)
      
      // Filtrar agendas da cidade
      const agendasCidade = agendas.filter((a: { cities?: { name?: string } }) => {
        if (!a.cities?.name) return false
        const nomeCidade = normalizeText(a.cities.name)
        return nomeCidade.includes(cidadeNorm) || cidadeNorm.includes(nomeCidade)
      })

      if (agendasCidade.length === 0) {
        return `Não encontrei agendas em "${cidade}".`
      }

      const cidadeFormatada = agendasCidade[0]?.cities?.name || cidade
      let resposta = `**Agendas em ${cidadeFormatada}**\n\n`

      // Ordenar por data (mais recente primeiro)
      agendasCidade.sort((a: { date: string }, b: { date: string }) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // Mostrar até 5 agendas
      const agendasMostrar = agendasCidade.slice(0, 5)
      
      agendasMostrar.forEach((agenda: { date: string; type: string; status: string; description?: string }, index: number) => {
        const data = new Date(agenda.date).toLocaleDateString('pt-BR')
        const tipo = agenda.type === 'visita' ? 'Visita' : 
                     agenda.type === 'evento' ? 'Evento' :
                     agenda.type === 'reuniao' ? 'Reunião' : 'Outro'
        const statusIcon = agenda.status === 'concluida' ? '●' : 
                           agenda.status === 'cancelada' ? '○' : '◐'
        
        resposta += `${statusIcon} **${data}** — ${tipo}\n`
        if (agenda.description) {
          resposta += `   ${agenda.description}\n`
        }
        if (index < agendasMostrar.length - 1) resposta += '\n'
      })

      if (agendasCidade.length > 5) {
        resposta += `\n+ ${agendasCidade.length - 5} agenda(s)`
      }

      // Estatísticas
      const concluidas = agendasCidade.filter((a: { status: string }) => a.status === 'concluida').length
      resposta += `\n\nTotal: ${agendasCidade.length} | Concluídas: ${concluidas}`

      return resposta
    } catch (error) {
      console.error('Erro ao buscar agendas:', error)
      return `Erro ao buscar agendas. Tente novamente.`
    }
  }

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

  // Buscar pesquisas
  const fetchPesquisas = async (termo: string): Promise<string> => {
    try {
      const response = await fetch('/api/pesquisa')
      if (!response.ok) {
        return `Erro ao buscar pesquisas.`
      }

      const pesquisas = await response.json()
      const termoNorm = normalizeText(termo)
      
      // Filtrar pesquisas
      const pesquisasFiltradas = pesquisas.filter((p: { candidato_nome?: string; cidade_nome?: string; instituto?: string }) => {
        const candidato = normalizeText(p.candidato_nome || '')
        const cidade = normalizeText(p.cidade_nome || '')
        const instituto = normalizeText(p.instituto || '')
        return candidato.includes(termoNorm) || cidade.includes(termoNorm) || instituto.includes(termoNorm)
      })

      if (pesquisasFiltradas.length === 0) {
        return `Não encontrei pesquisas para "${termo}".`
      }

      let resposta = `**Pesquisas para "${termo}"**\n\n`

      // Ordenar por data
      pesquisasFiltradas.sort((a: { data_pesquisa: string }, b: { data_pesquisa: string }) => new Date(b.data_pesquisa).getTime() - new Date(a.data_pesquisa).getTime())

      // Mostrar até 5 pesquisas
      const pesquisasMostrar = pesquisasFiltradas.slice(0, 5)
      
      pesquisasMostrar.forEach((p: { data_pesquisa: string; candidato_nome: string; intencao_voto: number; instituto?: string; cidade_nome?: string }, index: number) => {
        const data = new Date(p.data_pesquisa).toLocaleDateString('pt-BR')
        resposta += `**${data}**\n`
        resposta += `   ${p.candidato_nome}: **${p.intencao_voto}%**\n`
        if (p.instituto) resposta += `   ${p.instituto}\n`
        if (p.cidade_nome) resposta += `   ${p.cidade_nome}\n`
        if (index < pesquisasMostrar.length - 1) resposta += '\n'
      })

      if (pesquisasFiltradas.length > 5) {
        resposta += `\n+ ${pesquisasFiltradas.length - 5} pesquisa(s)`
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar pesquisas:', error)
      return `Erro ao buscar pesquisas. Tente novamente.`
    }
  }

  // ==================== PROCESSAMENTO DE QUERIES ====================

  // Processar pergunta do usuário
  const processUserQuery = useCallback(async (query: string): Promise<ChatMessage> => {
    const queryLower = normalizeText(query)
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
      const resposta = await fetchExpectativaCidade(cidade)
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/territorio',
          label: 'Ver Território Completo',
        },
      }
    }
    
    // ===== AGENDA EM CIDADE ESPECÍFICA =====
    if (cidade && (queryLower.includes('agenda') || queryLower.includes('visita') || 
        queryLower.includes('evento') || queryLower.includes('reuniao') || queryLower.includes('reunião') ||
        queryLower.includes('foi') || queryLower.includes('quando') || queryLower.includes('presenca'))) {
      const resposta = await fetchAgendasCidade(cidade)
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/campo',
          label: 'Ver Campo & Agenda',
        },
      }
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
    if (queryLower.includes('pesquisa') && cidade) {
      const resposta = await fetchPesquisas(cidade)
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: resposta,
        action: {
          type: 'navigate',
          url: '/dashboard/pesquisa',
          label: 'Ver Pesquisas',
        },
      }
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
    
    // ===== ALERTAS/NOTÍCIAS =====
    if (queryLower.includes('alerta') || queryLower.includes('noticia') || 
        queryLower.includes('crise') || queryLower.includes('critico') || queryLower.includes('crítico')) {
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
    
    // ===== AGENDA GERAL =====
    if (queryLower.includes('agenda') && !cidade) {
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Acesse a página Campo & Agenda para ver suas visitas, fazer check-in e gerenciar demandas.',
        action: {
          type: 'navigate',
          url: '/dashboard/campo',
          label: 'Ver Campo & Agenda',
        },
      }
    }

    // ===== CONSULTA SOBRE CIDADE SEM INDICADOR ESPECÍFICO =====
    if (cidade && !queryLower.includes('pesquisa')) {
      // Se mencionou uma cidade mas não especificou o que quer, buscar resumo geral
      const expectativaResp = await fetchExpectativaCidade(cidade)
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: expectativaResp,
        action: {
          type: 'navigate',
          url: '/dashboard/territorio',
          label: 'Ver mais detalhes',
        },
      }
    }
    
    // ===== AJUDA =====
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: `**O que posso fazer:**\n\n**Por cidade:**\n› expectativa em Teresina\n› lideranças em Picos\n› agendas em Paes Landim\n› demandas em Parnaíba\n› pedidos em Teresina\n\n**Território & Base:**\n› território e base\n› capilaridade\n› presença territorial\n› expectativa 2026\n› demandas\n\n**Redes Sociais:**\n› métricas do Instagram\n› quantos seguidores tenho?\n› posts mais curtidos\n› melhores posts\n› publicações por tipo\n› qual tema tem melhor performance?\n\n**Geral:**\n› projeção chapa federal\n› alertas críticos\n› territórios frios\n\nDigite sua pergunta!`,
    }
  }, [criticalAlerts, territoriosFrios, territoriosFriosCount, bandeirasCount, bandeirasPerformance, expectativa2026, presencaTerritorial])

  // Enviar mensagem
  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || isProcessing) return
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput.trim(),
    }
    
    setChatMessages(prev => [...prev, userMessage])
    setUserInput('')
    setIsProcessing(true)
    
    try {
      const response = await processUserQuery(userMessage.content)
      setChatMessages(prev => [...prev, response])
    } catch (error) {
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro. Tente novamente.',
      }])
    } finally {
      setIsProcessing(false)
    }
  }, [userInput, isProcessing, processUserQuery])

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
    setChatMode(false)
    setChatMessages([])
    setCurrentMessageIndex(0)
    setCompletedMessages([])
  }, [])

  if (!showAgent) return null

  return (
    <div 
      className={`fixed bottom-6 right-6 z-40 transition-all duration-500 ${
        isMinimized ? 'w-14 h-14' : 'w-[420px]'
      }`}
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
        <div className="bg-surface rounded-2xl shadow-card shadow-accent-gold/10 border border-card overflow-hidden flex flex-col max-h-[600px]">
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
                <h3 className="text-sm font-semibold text-white">Copilot IA</h3>
                <p className="text-[10px] text-white/70">
                  {chatMode ? 'Pergunte sobre cidades, chapas, lideranças...' : allLoaded ? 'Pronto!' : 'Analisando...'}
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
                    <p className="text-sm text-text-primary font-medium">
                      Olá! Pergunte-me qualquer coisa sobre a campanha.
                    </p>
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-accent-gold font-bold">Exemplos:</p>
                      <p className="text-xs text-accent-gold">› expectativa em Teresina</p>
                      <p className="text-xs text-accent-gold">› projeção chapa federal</p>
                      <p className="text-xs text-accent-gold">› métricas do Instagram</p>
                      <p className="text-xs text-accent-gold">› posts mais curtidos</p>
                      <p className="text-xs text-accent-gold">› evolução de seguidores</p>
                    </div>
                  </div>
                )}
                
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                    <div className={`p-3 rounded-xl max-w-[95%] ${
                      msg.role === 'user' ? 'bg-accent-gold text-white' : 'bg-app border border-card text-text-primary'
                    }`}>
                      <p className="text-sm whitespace-pre-line">{msg.content}</p>
                      
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
                    <span className="text-xs text-text-primary font-medium">Buscando dados...</span>
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
                  placeholder="Ex: expectativa em Teresina..."
                  className="flex-1 px-3 py-2 text-sm border border-card rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-gold focus:border-transparent"
                  disabled={isProcessing}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!userInput.trim() || isProcessing}
                  className="p-2 bg-accent-gold text-white rounded-xl hover:bg-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
