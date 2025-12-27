'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Sparkles, TrendingUp, AlertTriangle, MapPin, BarChart3, CheckCircle2, Send, ExternalLink, ArrowRight, Loader2, Users, Calendar, Vote, FileText } from 'lucide-react'

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
      let kpiMessage = `📊 Expectativa 2026: ${typeof expectativa2026 === 'number' ? expectativa2026.toLocaleString('pt-BR') : expectativa2026} votos`
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
        message: `🚨 ${alertsCriticosCount} alerta${alertsCriticosCount > 1 ? 's' : ''} crítico${alertsCriticosCount > 1 ? 's' : ''}!`,
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
        message: `⚠️ ${territoriosFriosCount} território${territoriosFriosCount > 1 ? 's' : ''} frio${territoriosFriosCount > 1 ? 's' : ''}`,
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
      const savedConfig = localStorage.getItem('territorio_sheets_config')
      if (!savedConfig) {
        return `❌ Não encontrei configuração de território. Configure a planilha em Território & Base.`
      }

      const config = JSON.parse(savedConfig)
      const response = await fetch('/api/territorio/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        return `❌ Erro ao buscar dados do território.`
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
        return `❌ Não encontrei a coluna de cidade na planilha.`
      }

      // Buscar registros da cidade
      const cidadeNorm = normalizeText(cidade)
      const registrosCidade = records.filter((r: Record<string, unknown>) => {
        const nomeCidade = normalizeText(String(r[cidadeCol] || ''))
        return nomeCidade.includes(cidadeNorm) || cidadeNorm.includes(nomeCidade)
      })

      if (registrosCidade.length === 0) {
        return `🔍 Não encontrei registros para "${cidade}". Verifique o nome da cidade.`
      }

      // Calcular totais
      let totalExpectativa = 0
      const liderancas: Array<{ nome: string; expectativa: number; funcao?: string }> = []
      
      registrosCidade.forEach((r: Record<string, unknown>) => {
        let expectativa = 0
        if (expectativaCol && r[expectativaCol]) {
          const valor = String(r[expectativaCol]).replace(/[^\d.,]/g, '').replace(',', '.')
          expectativa = parseFloat(valor) || 0
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
      let resposta = `📍 **${cidadeFormatada}**\n\n`
      resposta += `🗳️ Expectativa 2026: **${Math.round(totalExpectativa).toLocaleString('pt-BR')} votos**\n`
      resposta += `👥 Lideranças: **${registrosCidade.length}**`
      
      if (liderancas.length > 0 && liderancas.length <= 8) {
        resposta += `\n\n📋 **Lideranças:**\n`
        liderancas.forEach(l => {
          resposta += `• ${l.nome}`
          if (l.expectativa > 0) resposta += ` (${l.expectativa.toLocaleString('pt-BR')} votos)`
          if (l.funcao) resposta += ` - ${l.funcao}`
          resposta += '\n'
        })
      } else if (liderancas.length > 8) {
        resposta += `\n\n📋 **Top 8 Lideranças:**\n`
        liderancas.slice(0, 8).forEach(l => {
          resposta += `• ${l.nome}`
          if (l.expectativa > 0) resposta += ` (${l.expectativa.toLocaleString('pt-BR')} votos)`
          resposta += '\n'
        })
        resposta += `...e mais ${liderancas.length - 8} liderança(s)`
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar expectativa:', error)
      return `❌ Erro ao buscar dados. Tente novamente.`
    }
  }

  // Buscar lideranças detalhadas de uma cidade
  const fetchLiderancasCidade = async (cidade: string): Promise<string> => {
    try {
      const savedConfig = localStorage.getItem('territorio_sheets_config')
      if (!savedConfig) {
        return `❌ Configure a planilha de território primeiro em Território & Base.`
      }

      const config = JSON.parse(savedConfig)
      const response = await fetch('/api/territorio/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        return `❌ Erro ao buscar dados do território.`
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
        return `❌ Não encontrei a coluna de cidade na planilha.`
      }

      // Buscar registros da cidade
      const cidadeNorm = normalizeText(cidade)
      const registrosCidade = records.filter((r: Record<string, unknown>) => {
        const nomeCidade = normalizeText(String(r[cidadeCol] || ''))
        return nomeCidade.includes(cidadeNorm) || cidadeNorm.includes(nomeCidade)
      })

      if (registrosCidade.length === 0) {
        return `🔍 Não encontrei lideranças em "${cidade}".`
      }

      const cidadeFormatada = cidade.charAt(0).toUpperCase() + cidade.slice(1).toLowerCase()
      let resposta = `👥 **Lideranças em ${cidadeFormatada}**\n\n`
      resposta += `📊 Total: **${registrosCidade.length}** liderança(s)\n\n`

      // Mostrar detalhes
      const maxShow = 10
      const liderancasOrdenadas = [...registrosCidade].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        if (!expectativaCol) return 0
        const va = parseFloat(String(a[expectativaCol] || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0
        const vb = parseFloat(String(b[expectativaCol] || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0
        return vb - va
      })

      liderancasOrdenadas.slice(0, maxShow).forEach((r: Record<string, unknown>, i: number) => {
        resposta += `**${i + 1}. ${r[nomeCol] || 'Sem nome'}**\n`
        if (funcaoCol && r[funcaoCol]) resposta += `   Função: ${r[funcaoCol]}\n`
        if (bairroCol && r[bairroCol]) resposta += `   Bairro: ${r[bairroCol]}\n`
        if (expectativaCol && r[expectativaCol]) {
          const exp = parseFloat(String(r[expectativaCol]).replace(/[^\d.,]/g, '').replace(',', '.')) || 0
          if (exp > 0) resposta += `   Votos 2026: ${Math.round(exp).toLocaleString('pt-BR')}\n`
        }
        resposta += '\n'
      })

      if (registrosCidade.length > maxShow) {
        resposta += `...e mais ${registrosCidade.length - maxShow} liderança(s)`
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar lideranças:', error)
      return `❌ Erro ao buscar lideranças. Tente novamente.`
    }
  }

  // Buscar agendas de uma cidade
  const fetchAgendasCidade = async (cidade: string): Promise<string> => {
    try {
      const response = await fetch('/api/campo/agendas')
      if (!response.ok) {
        return `❌ Erro ao buscar agendas.`
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
        return `📅 Não encontrei agendas em "${cidade}".`
      }

      const cidadeFormatada = agendasCidade[0]?.cities?.name || cidade
      let resposta = `📅 **Agendas em ${cidadeFormatada}**\n\n`

      // Ordenar por data (mais recente primeiro)
      agendasCidade.sort((a: { date: string }, b: { date: string }) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // Mostrar até 5 agendas
      const agendasMostrar = agendasCidade.slice(0, 5)
      
      agendasMostrar.forEach((agenda: { date: string; type: string; status: string; description?: string }, index: number) => {
        const data = new Date(agenda.date).toLocaleDateString('pt-BR')
        const tipo = agenda.type === 'visita' ? '🚗 Visita' : 
                     agenda.type === 'evento' ? '🎉 Evento' :
                     agenda.type === 'reuniao' ? '🤝 Reunião' : '📌 Outro'
        const status = agenda.status === 'concluida' ? '✅' : 
                       agenda.status === 'cancelada' ? '❌' : '⏳'
        
        resposta += `${status} **${data}** - ${tipo}\n`
        if (agenda.description) {
          resposta += `   ${agenda.description}\n`
        }
        if (index < agendasMostrar.length - 1) resposta += '\n'
      })

      if (agendasCidade.length > 5) {
        resposta += `\n...e mais ${agendasCidade.length - 5} agenda(s)`
      }

      // Estatísticas
      const concluidas = agendasCidade.filter((a: { status: string }) => a.status === 'concluida').length
      resposta += `\n\n📊 Total: ${agendasCidade.length} | Concluídas: ${concluidas}`

      return resposta
    } catch (error) {
      console.error('Erro ao buscar agendas:', error)
      return `❌ Erro ao buscar agendas. Tente novamente.`
    }
  }

  // Buscar projeção da chapa federal
  const fetchProjecaoChapa = async (): Promise<string> => {
    try {
      const response = await fetch('/api/chapas/projecao-republicanos')
      if (!response.ok) {
        return `❌ Erro ao buscar projeção da chapa.`
      }

      const data = await response.json()
      
      if (data.message && !data.eleitos) {
        return `📊 **Projeção Chapa Federal**\n\n⚠️ ${data.message}\n\nAcesse a página Chapas para configurar o cenário base.`
      }

      let resposta = `📊 **Projeção Chapa Federal**\n\n`
      resposta += `🗳️ **${data.partido}**: ${data.eleitos} deputado${data.eleitos !== 1 ? 's' : ''} eleito${data.eleitos !== 1 ? 's' : ''}\n`
      
      if (data.cenario) {
        resposta += `📋 Cenário: ${data.cenario}\n`
      }
      
      if (data.quociente) {
        resposta += `📐 Quociente Eleitoral: ${data.quociente.toLocaleString('pt-BR')}\n`
      }

      // Mostrar distribuição se existir
      if (data.distribuicao && data.distribuicao.length > 0) {
        resposta += `\n📈 **Distribuição por partido:**\n`
        data.distribuicao
          .filter((p: { vagas: number }) => p.vagas > 0)
          .sort((a: { vagas: number }, b: { vagas: number }) => b.vagas - a.vagas)
          .forEach((p: { partido: string; vagas: number }) => {
            resposta += `• ${p.partido}: ${p.vagas} vaga${p.vagas !== 1 ? 's' : ''}\n`
          })
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar projeção:', error)
      return `❌ Erro ao buscar projeção. Tente novamente.`
    }
  }

  // Buscar demandas de uma cidade
  const fetchDemandasCidade = async (cidade: string): Promise<string> => {
    try {
      const response = await fetch('/api/campo/demands')
      if (!response.ok) {
        return `❌ Erro ao buscar demandas.`
      }

      const demandas = await response.json()
      const cidadeNorm = normalizeText(cidade)
      
      // Filtrar demandas da cidade
      const demandasCidade = demandas.filter((d: { cities?: { name?: string } }) => {
        if (!d.cities?.name) return false
        const nomeCidade = normalizeText(d.cities.name)
        return nomeCidade.includes(cidadeNorm) || cidadeNorm.includes(nomeCidade)
      })

      if (demandasCidade.length === 0) {
        return `📝 Não encontrei demandas registradas em "${cidade}".`
      }

      const cidadeFormatada = demandasCidade[0]?.cities?.name || cidade
      let resposta = `📝 **Demandas em ${cidadeFormatada}**\n\n`

      // Agrupar por status
      const pendentes = demandasCidade.filter((d: { status: string }) => d.status === 'pendente' || d.status === 'em_andamento')
      const concluidas = demandasCidade.filter((d: { status: string }) => d.status === 'concluida')

      resposta += `📊 Total: ${demandasCidade.length} | Pendentes: ${pendentes.length} | Concluídas: ${concluidas.length}\n\n`

      // Mostrar demandas pendentes primeiro
      if (pendentes.length > 0) {
        resposta += `⏳ **Pendentes:**\n`
        pendentes.slice(0, 5).forEach((d: { title: string; priority: string; created_at: string }) => {
          const prioridade = d.priority === 'alta' ? '🔴' : d.priority === 'media' ? '🟡' : '🟢'
          const data = new Date(d.created_at).toLocaleDateString('pt-BR')
          resposta += `${prioridade} ${d.title} (${data})\n`
        })
        if (pendentes.length > 5) {
          resposta += `...e mais ${pendentes.length - 5}\n`
        }
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar demandas:', error)
      return `❌ Erro ao buscar demandas. Tente novamente.`
    }
  }

  // Buscar pesquisas
  const fetchPesquisas = async (termo: string): Promise<string> => {
    try {
      const response = await fetch('/api/pesquisa')
      if (!response.ok) {
        return `❌ Erro ao buscar pesquisas.`
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
        return `📊 Não encontrei pesquisas para "${termo}".`
      }

      let resposta = `📊 **Pesquisas para "${termo}"**\n\n`

      // Ordenar por data
      pesquisasFiltradas.sort((a: { data_pesquisa: string }, b: { data_pesquisa: string }) => new Date(b.data_pesquisa).getTime() - new Date(a.data_pesquisa).getTime())

      // Mostrar até 5 pesquisas
      const pesquisasMostrar = pesquisasFiltradas.slice(0, 5)
      
      pesquisasMostrar.forEach((p: { data_pesquisa: string; candidato_nome: string; intencao_voto: number; instituto?: string; cidade_nome?: string }, index: number) => {
        const data = new Date(p.data_pesquisa).toLocaleDateString('pt-BR')
        resposta += `📅 **${data}**\n`
        resposta += `   👤 ${p.candidato_nome}: **${p.intencao_voto}%**\n`
        if (p.instituto) resposta += `   🏢 ${p.instituto}\n`
        if (p.cidade_nome) resposta += `   📍 ${p.cidade_nome}\n`
        if (index < pesquisasMostrar.length - 1) resposta += '\n'
      })

      if (pesquisasFiltradas.length > 5) {
        resposta += `\n...e mais ${pesquisasFiltradas.length - 5} pesquisa(s)`
      }

      return resposta
    } catch (error) {
      console.error('Erro ao buscar pesquisas:', error)
      return `❌ Erro ao buscar pesquisas. Tente novamente.`
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
          url: '/dashboard/campo',
          label: 'Ver Demandas',
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
    
    // ===== ALERTAS/NOTÍCIAS =====
    if (queryLower.includes('alerta') || queryLower.includes('noticia') || 
        queryLower.includes('crise') || queryLower.includes('critico') || queryLower.includes('crítico')) {
      if (criticalAlerts.length > 0) {
        const alert = criticalAlerts[0]
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: `🚨 Encontrei ${criticalAlerts.length} alerta${criticalAlerts.length > 1 ? 's' : ''} crítico${criticalAlerts.length > 1 ? 's' : ''}:\n\n📰 "${alert.title}"`,
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
          content: '✅ Não há alertas críticos no momento. O radar de crises está limpo!',
        }
      }
    }
    
    // ===== TERRITÓRIOS FRIOS (GERAL) =====
    if ((queryLower.includes('territorio') || queryLower.includes('território') || queryLower.includes('frio')) && !cidade) {
      if (territoriosFrios.length > 0) {
        const top3 = territoriosFrios.slice(0, 3)
        const cidadesTexto = top3.map(t => `• ${t.cidade}: ${t.motivo}${t.expectativaVotos ? ` (${t.expectativaVotos.toLocaleString('pt-BR')} votos)` : ''}`).join('\n')
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: `🗺️ **${territoriosFriosCount} territórios frios:**\n\n${cidadesTexto}`,
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
          content: '✅ Excelente! Todos os territórios estão com boa cobertura.',
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
          content: `🎯 Você tem **${bandeirasCount} bandeira${bandeirasCount > 1 ? 's' : ''}** ativa${bandeirasCount > 1 ? 's' : ''} com performance média de **${bandeirasPerformance}%**.`,
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
        content: `📈 **Expectativa de votos 2026:** ${typeof expectativa2026 === 'number' ? expectativa2026.toLocaleString('pt-BR') : expectativa2026 || 'não calculada'}\n\n🗺️ **Presença territorial:** ${presencaTerritorial || 'não calculada'}`,
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
        content: '📅 Acesse a página Campo & Agenda para ver suas visitas, fazer check-in e gerenciar demandas.',
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
      content: `🤖 **O que posso fazer:**\n\n📍 **Por cidade:**\n• "expectativa em Teresina"\n• "lideranças em Picos"\n• "agendas em Paes Landim"\n• "demandas em Floriano"\n\n📊 **Geral:**\n• "projeção chapa federal"\n• "quantos deputados elegemos?"\n• "alertas críticos"\n• "territórios frios"\n• "bandeiras de campanha"\n\nDigite sua pergunta!`,
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
        content: '❌ Desculpe, ocorreu um erro. Tente novamente.',
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
          className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg shadow-blue-500/30 flex items-center justify-center hover:scale-110 transition-transform relative"
        >
          <Bot className="w-7 h-7 text-white" />
          {!allLoaded && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full animate-pulse" />
          )}
          {allLoaded && (alertsCriticosCount > 0 || territoriosFriosCount > 0) && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
              {alertsCriticosCount + territoriosFriosCount}
            </span>
          )}
        </button>
      ) : (
        <div className="bg-white rounded-2xl shadow-2xl shadow-blue-500/20 border border-blue-100 overflow-hidden flex flex-col max-h-[600px]">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                {!allLoaded && (
                  <span className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
                )}
                {allLoaded && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center">
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
            <div className="h-1 bg-blue-100 flex-shrink-0">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-500"
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
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="text-sm text-blue-700">
                      👋 Olá! Pergunte-me qualquer coisa sobre a campanha.
                    </p>
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-blue-600 font-medium">Exemplos:</p>
                      <p className="text-xs text-blue-500">• "expectativa em Teresina"</p>
                      <p className="text-xs text-blue-500">• "lideranças em Picos"</p>
                      <p className="text-xs text-blue-500">• "agendas em Paes Landim"</p>
                      <p className="text-xs text-blue-500">• "projeção chapa federal"</p>
                    </div>
                  </div>
                )}
                
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                    <div className={`p-3 rounded-xl max-w-[95%] ${
                      msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <p className="text-sm whitespace-pre-line">{msg.content}</p>
                      
                      {msg.action && (
                        <button
                          onClick={() => handleAction(msg.action)}
                          className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors w-full justify-center"
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
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100">
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    <span className="text-xs text-slate-500">Buscando dados...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {chatMode && (
            <div className="p-3 border-t border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ex: expectativa em Teresina..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isProcessing}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!userInput.trim() || isProcessing}
                  className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
