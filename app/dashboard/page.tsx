'use client'

import { useEffect, useState, useMemo } from 'react'
import { KPICard } from '@/components/kpi-card'
import { KPIHeroCard } from '@/components/kpi-hero-card'
import { AlertCard } from '@/components/alert-card'
import { AnimatedSection } from '@/components/animated-section'
import { AnimatedBar } from '@/components/animated-bar'
// Lazy-load do AIAgent - só carrega quando montado (não bloqueia navegação)
const AIAgent = dynamic(
  () => import('@/components/ai-agent').then(mod => ({ default: mod.AIAgent })),
  { ssr: false, loading: () => null }
)
import { MapaPresenca } from '@/components/mapa-presenca'
import dynamic from 'next/dynamic'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { mockKPIs, mockAlerts } from '@/lib/mock-data'

// Dynamic import do wrapper Leaflet (client-only)
const MapWrapperLeaflet = dynamic(
  () => import('@/components/mapa-wrapper-leaflet').then(mod => mod.MapWrapperLeaflet),
  { ssr: false }
)
import { KPI, Alert, NewsItem } from '@/types'
import { TrendingUp, MapPin, Flag, MessageSquare, ThermometerSun, ThermometerSnowflake, Flame, Activity, Maximize2, X, Lightbulb, AlertTriangle, Users, Heart, Eye, Crown, ArrowUpRight, ArrowDownRight, ArrowRight, Zap, Target, FileText } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { loadInstagramConfigAsync, fetchInstagramData } from '@/lib/instagramApi'
import { getEleitoradoByCity, getAllEleitores } from '@/lib/eleitores'

const trendData = [
  { date: '01/10', ife: 65, sentimento: 60 },
  { date: '08/10', ife: 68, sentimento: 62 },
  { date: '15/10', ife: 70, sentimento: 65 },
  { date: '22/10', ife: 71, sentimento: 66 },
  { date: '29/10', ife: 72, sentimento: 68 },
]

export default function Home() {
  const [kpis, setKpis] = useState<KPI[]>(mockKPIs)
  const [loading, setLoading] = useState(true)
  const [pollsData, setPollsData] = useState<Array<{ date: string; intencao: number; instituto?: string; cidade?: string }>>([])
  const [loadingPolls, setLoadingPolls] = useState(true)
  const [candidatoPadrao, setCandidatoPadrao] = useState<string>('')
  const [territoriosFrios, setTerritoriosFrios] = useState<Array<{ cidade: string; motivo: string; expectativaVotos?: number; visitas?: number }>>([])
  const [territoriosQuentes, setTerritoriosQuentes] = useState<Array<{ cidade: string; motivo: string; expectativaVotos?: number; visitas?: number }>>([])
  const [territoriosMornos, setTerritoriosMornos] = useState<Array<{ cidade: string; motivo: string; expectativaVotos?: number; visitas?: number }>>([])
  const [cidadesComLiderancas, setCidadesComLiderancas] = useState<string[]>([])
  const [cidadesVisitadasLista, setCidadesVisitadasLista] = useState<string[]>([])
  const [territorioStats, setTerritorioStats] = useState<{
    totalCidades: number
    cidadesVisitadas: number
    cidadesNaoVisitadas: number
    totalVisitas: number
    totalExpectativa: number
    percentualCobertura: number
  } | null>(null)
  const [loadingTerritorios, setLoadingTerritorios] = useState(true)
  const [monitorNews, setMonitorNews] = useState<NewsItem[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState<boolean>(true)
  const [bandeirasStats, setBandeirasStats] = useState<{
    totalUsos: number
    totalPerformance: number
    totalBandeiras: number
    topBandeiras: Array<{
      theme: string
      usage_count: number
      performance_score: number
      totalLikes: number
      totalComments: number
      totalEngagement: number
      totalViews: number
      avgLikes: number
      avgEngagement: number
      avgViews: number
      posts: number
      boostedCount: number
    }>
    hasInstagramData: boolean
  } | null>(null)
  const [loadingBandeiras, setLoadingBandeiras] = useState(true)
  const [projecaoChapa, setProjecaoChapa] = useState<number>(0)
  const [rankingExpectativa, setRankingExpectativa] = useState<{ posicao: number; totalCandidatos: number } | null>(null)
  const [segundaVagaInfo, setSegundaVagaInfo] = useState<{
    vagasAtuais: number
    distancia: number
    distanciaCompetidor: number
    tipo: 'margem' | 'faltam'
    competidorProximo: string | null
    qpRepublicanos: number
    qpCompetidor: number
    rodada: number
  } | null>(null)
  const [rankingPesquisas, setRankingPesquisas] = useState<{ posicao: number; totalCandidatos: number; projecaoVotos: number | null; cidadesComPesquisa: number } | null>(null)
  const [agenteMontado, setAgenteMontado] = useState(false)
  const [graficoPollsTelaCheia, setGraficoPollsTelaCheia] = useState(false)
  const [analiseTerritoriosTelaCheia, setAnaliseTerritoriosTelaCheia] = useState(false)
  const [showMapaPresenca, setShowMapaPresenca] = useState(true)
  const [mapaTelaCheia, setMapaTelaCheia] = useState(false)
  const [bandeirasTelaCheia, setBandeirasTelaCheia] = useState(false)
  const [alertasTelaCheia, setAlertasTelaCheia] = useState(false)
  const [insightTelaCheia, setInsightTelaCheia] = useState(false)
  const [expectativasPorCidade, setExpectativasPorCidade] = useState<Record<string, number>>({})

  // Montar o agente de IA com delay (não bloqueia carregamento/navegação inicial)
  useEffect(() => {
    const timer = setTimeout(() => setAgenteMontado(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  // Votos da eleição anterior (2022) para cálculo comparativo
  const VOTOS_ELEICAO_ANTERIOR = 83175

  // Mapa de eleitores por cidade (para uso no mapa)
  const eleitoresPorCidade = useMemo(() => {
    const mapa: Record<string, number> = {}
    const eleitores = getAllEleitores()
    eleitores.forEach(e => {
      mapa[e.municipio] = e.eleitorado
    })
    return mapa
  }, [])

  // ─── Insights inteligentes das bandeiras (Radar de Posicionamento) ───
  const bandeirasInsights = useMemo(() => {
    if (!bandeirasStats || bandeirasStats.topBandeiras.length === 0) return null

    const bandeiras = bandeirasStats.topBandeiras
    const totalUsage = bandeiras.reduce((sum, b) => sum + b.usage_count, 0)
    const totalEngagement = bandeiras.reduce((sum, b) => sum + b.totalEngagement, 0)

    const formatCompact = (num: number): string => {
      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
      if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`
      return num.toString()
    }

    const enriched = bandeiras.map((b, index) => {
      const dominancePercent = totalUsage > 0 ? (b.usage_count / totalUsage) * 100 : 0
      const engagementShare = totalEngagement > 0 ? (b.totalEngagement / totalEngagement) * 100 : 0

      const dominanceLevel: 'dominant' | 'relevant' | 'low' =
        dominancePercent >= 35 ? 'dominant' : dominancePercent >= 15 ? 'relevant' : 'low'

      const avgEng = b.avgEngagement || 0
      const engagementLevel: 'high' | 'medium' | 'low' =
        avgEng >= 80 || b.totalEngagement >= 500 ? 'high'
          : avgEng >= 20 || b.totalEngagement >= 100 ? 'medium'
          : 'low'

      const trend: 'up' | 'down' | 'stable' =
        b.performance_score >= 60 && b.usage_count >= 5 ? 'up'
          : b.usage_count <= 2 || b.performance_score <= 15 ? 'down'
          : 'stable'

      let headline = ''
      if (index === 0 && engagementLevel === 'high') headline = `${b.theme} lidera com forte engajamento nas redes`
      else if (index === 0) headline = `${b.theme} domina a narrativa do mandato`
      else if (dominanceLevel === 'dominant') headline = `${b.theme} concentra ${dominancePercent.toFixed(0)}% das menções`
      else if (engagementLevel === 'high') headline = `${b.theme} gera alto impacto quando aparece`
      else if (dominanceLevel === 'relevant') headline = `${b.theme} mantém presença relevante`
      else if (dominanceLevel === 'low') headline = `${b.theme} com baixa presença recente`
      else headline = `${b.theme} precisa de reforço estratégico`

      let frequencyLabel = ''
      if (b.usage_count >= 15 && b.posts >= 5) frequencyLabel = 'Alta frequência com bom desempenho'
      else if (b.usage_count >= 10) frequencyLabel = 'Boa frequência de aparição'
      else if (b.usage_count >= 5) frequencyLabel = 'Frequência moderada'
      else if (b.usage_count >= 1) frequencyLabel = 'Aparição pontual'
      else frequencyLabel = 'Sem aparições recentes'

      return {
        ...b,
        rank: index + 1,
        dominancePercent,
        engagementShare,
        dominanceLevel,
        engagementLevel,
        trend,
        headline,
        frequencyLabel,
        formattedViews: formatCompact(b.totalViews),
        formattedLikes: formatCompact(b.totalLikes),
        formattedEngagement: formatCompact(b.totalEngagement),
      }
    })

    const top = enriched[0]
    const growing = enriched.find((b, i) => i > 0 && b.trend === 'up') || null
    const weakest = [...enriched].reverse().find(b => b.dominanceLevel === 'low') || null

    let mainSentence = ''
    if (top) {
      if (top.engagementShare >= 50) {
        mainSentence = `${top.theme} domina a narrativa do mandato nos últimos 30 dias, concentrando ${top.engagementShare.toFixed(0)}% do engajamento total.`
      } else if (top.engagementShare >= 30) {
        mainSentence = `${top.theme} lidera o posicionamento com ${top.engagementShare.toFixed(0)}% do engajamento.`
      } else if (top.dominancePercent >= 30) {
        mainSentence = `${top.theme} concentra ${top.dominancePercent.toFixed(0)}% das menções, liderando o radar.`
      } else {
        mainSentence = `As narrativas estão distribuídas. ${top.theme} lidera com ${top.dominancePercent.toFixed(0)}% das menções.`
      }
    }

    return { enriched, top, growing, weakest, mainSentence, totalUsage, totalEngagement, formatCompact }
  }, [bandeirasStats])

  // ─── Interpretação do Monitor de Imprensa ───
  const monitorInsight = useMemo(() => {
    if (monitorNews.length === 0) return null
    const pos = monitorNews.filter(n => n.sentiment === 'positive').length
    const neg = monitorNews.filter(n => n.sentiment === 'negative').length
    const neu = monitorNews.filter(n => n.sentiment === 'neutral').length
    const highRisk = monitorNews.filter(n => n.risk_level === 'high').length
    const total = monitorNews.length

    let headline = ''
    let tone: 'positive' | 'negative' | 'neutral' | 'warning' = 'neutral'

    if (highRisk > 0) {
      headline = `${highRisk} notícia${highRisk > 1 ? 's' : ''} sensíve${highRisk > 1 ? 'is' : 'l'} identificada${highRisk > 1 ? 's' : ''}`
      tone = 'warning'
    } else if (neg > pos && neg > neu) {
      headline = 'Aumento de menções críticas na cobertura'
      tone = 'negative'
    } else if (pos > neg && pos > neu) {
      headline = 'Cobertura majoritariamente positiva'
      tone = 'positive'
    } else if (total > 0) {
      headline = 'Cobertura estável no momento'
      tone = 'neutral'
    }

    return { headline, tone, pos, neg, neu, highRisk, total }
  }, [monitorNews])

  // Calcular média das pesquisas diretamente a partir dos dados do gráfico
  const mediaPesquisas = pollsData.length > 0
    ? Math.round((pollsData.reduce((sum, poll) => sum + (poll.intencao || 0), 0) / pollsData.length) * 10) / 10
    : null

  const fetchMonitorNews = async () => {
    setLoadingAlerts(true)
    try {
      const response = await fetch('/api/noticias?dashboard_highlight=true&limit=10')
      if (response.ok) {
        const data: NewsItem[] = await response.json()
        setMonitorNews(data)
      } else {
        setMonitorNews([])
      }
    } catch {
      setMonitorNews([])
    } finally {
      setLoadingAlerts(false)
    }
  }

  useEffect(() => {
    // Buscar candidato padrão do localStorage
    const candidatoSalvo = localStorage.getItem('candidatoPadraoPesquisa')
    if (candidatoSalvo) {
      setCandidatoPadrao(candidatoSalvo)
    }
    
    // Buscar notícias destacadas para o Monitor de Imprensa
    fetchMonitorNews()
  }, [])

  // Buscar histórico quando candidato padrão mudar
  useEffect(() => {
    const fetchHistoricoIntencao = async (candidato: string) => {
      setLoadingPolls(true)
      try {
        const response = await fetch(`/api/pesquisa/historico-intencao?candidato=${encodeURIComponent(candidato)}`)
        if (response.ok) {
          const data = await response.json()
          const polls = data.data || []
          setPollsData(polls)
          
          // Buscar expectativas de votos por cidade para as pesquisas que têm cidade
          const cidadesUnicas = new Set<string>()
          polls.forEach((poll: { cidade?: string }) => {
            if (poll.cidade && poll.cidade !== 'Estado' && poll.cidade !== 'Cidade não encontrada') {
              cidadesUnicas.add(poll.cidade)
            }
          })
          
          // Buscar expectativas para cada cidade
          let config = null
          
          // Primeiro tentar configuração do servidor
          try {
            const serverConfigRes = await fetch('/api/territorio/config')
            const serverConfig = await serverConfigRes.json()
            if (serverConfig.configured) {
              config = {} // Servidor usa variáveis de ambiente
            }
          } catch (e) {
            // Continuar para localStorage
          }
          
          // Fallback: localStorage
          if (!config && typeof window !== 'undefined') {
            const savedConfig = localStorage.getItem('territorio_sheets_config')
            if (savedConfig) {
              config = JSON.parse(savedConfig)
            }
          }
          
          if (config && cidadesUnicas.size > 0) {
            const expectativas: Record<string, number> = {}
            
            await Promise.all(
              Array.from(cidadesUnicas).map(async (cidade) => {
                try {
                  const expectativaResponse = await fetch('/api/territorio/expectativa-por-cidade', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(
                      config.spreadsheetId 
                        ? {
                            spreadsheetId: config.spreadsheetId,
                            sheetName: config.sheetName,
                            range: config.range,
                            serviceAccountEmail: config.serviceAccountEmail,
                            credentials: config.credentials,
                            cidade,
                          }
                        : { cidade } // Servidor usa variáveis de ambiente
                    ),
                  })
                  
                  if (expectativaResponse.ok) {
                    const expectativaData = await expectativaResponse.json()
                    expectativas[cidade] = expectativaData.expectativaVotos || 0
                  }
                } catch (error) {
                  // Erro silencioso
                }
              })
            )
            
            setExpectativasPorCidade(expectativas)
          }
        } else {
          setPollsData([])
        }
      } catch (error) {
        setPollsData([])
      } finally {
        setLoadingPolls(false)
      }
    }

    if (candidatoPadrao) {
      fetchHistoricoIntencao(candidatoPadrao)
      
      // Buscar ranking e projeção de votos do candidato nas pesquisas estimuladas dep_federal
      fetch(`/api/pesquisa/ranking-estimulada?candidato=${encodeURIComponent(candidatoPadrao)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.posicao > 0) {
            setRankingPesquisas({
              posicao: data.posicao,
              totalCandidatos: data.totalCandidatos,
              projecaoVotos: data.projecaoVotos ?? null,
              cidadesComPesquisa: data.cidadesComPesquisa ?? 0,
            })
          } else {
            setRankingPesquisas(null)
          }
        })
        .catch(() => setRankingPesquisas(null))
    } else {
      setPollsData([])
      setRankingPesquisas(null)
      setLoadingPolls(false)
    }
  }, [candidatoPadrao])

  // Buscar Análise de Territórios (com AbortController para cancelar ao navegar)
  useEffect(() => {
    const abortController = new AbortController()
    const signal = abortController.signal
    
    const fetchTerritorios = async () => {
      setLoadingTerritorios(true)
      try {
        let config = null
        
        // 1. Primeiro verificar configuração do servidor
        try {
          const serverConfigRes = await fetch('/api/territorio/config', { signal })
          const serverConfig = await serverConfigRes.json()
          if (serverConfig.configured) {
            config = {} // Servidor usa variáveis de ambiente
          }
        } catch (e) {
          if (signal.aborted) return
          // Continuar para localStorage
        }
        
        // 2. Fallback: localStorage
        if (!config && typeof window !== 'undefined') {
          const savedConfig = localStorage.getItem('territorio_sheets_config')
          if (savedConfig) {
            config = JSON.parse(savedConfig)
          }
        }
        
        if (config && !signal.aborted) {
          const response = await fetch('/api/dashboard/territorios-frios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              territorioConfig: config.spreadsheetId ? config : {} 
            }),
            signal,
          })
          
          if (response.ok) {
            const data = await response.json()
            if (signal.aborted) return
            
            // Territórios frios
            setTerritoriosFrios(
              data.territoriosFrios?.map((t: Record<string, unknown>) => ({
                cidade: t.cidade,
                motivo: t.motivo,
                expectativaVotos: t.expectativaVotos,
                visitas: t.visitas,
              })) || []
            )
            
            // Territórios quentes
            setTerritoriosQuentes(
              data.territoriosQuentes?.map((t: Record<string, unknown>) => ({
                cidade: t.cidade,
                motivo: t.motivo,
                expectativaVotos: t.expectativaVotos,
                visitas: t.visitas,
              })) || []
            )
            
            // Territórios mornos
            setTerritoriosMornos(
              data.territoriosMornos?.map((t: Record<string, unknown>) => ({
                cidade: t.cidade,
                motivo: t.motivo,
                expectativaVotos: t.expectativaVotos,
                visitas: t.visitas,
              })) || []
            )
            
            // Cidades com lideranças (para o mapa)
            if (data.cidadesComLiderancas) {
              setCidadesComLiderancas(data.cidadesComLiderancas)
            }

            // Cidades visitadas (para o mapa)
            if (data.cidadesVisitadasLista) {
              setCidadesVisitadasLista(data.cidadesVisitadasLista)
            }
            
            // Estatísticas
            if (data.estatisticas) {
              setTerritorioStats(data.estatisticas)
            }
          }
        }
      } catch (error) {
        if (signal.aborted) return
        // Erro silencioso
      } finally {
        if (!signal.aborted) setLoadingTerritorios(false)
      }
    }

    fetchTerritorios()
    return () => { abortController.abort() }
  }, [])

  // Buscar estatísticas das bandeiras com métricas de desempenho do Instagram
  // DEFERIDO: executa 3s após o mount para não bloquear navegação/carregamento inicial
  useEffect(() => {
    const abortController = new AbortController()
    const signal = abortController.signal
    
    const fetchBandeirasStats = async () => {
      setLoadingBandeiras(true)
      try {
        // 1. Buscar narrativas ativas e stats básicos
        const narrativasResponse = await fetch('/api/narrativas?status=ativa', { signal })
        const narrativas = narrativasResponse.ok ? await narrativasResponse.json() : []

        const statsPromises = narrativas.map(async (narrativa: Record<string, string>) => {
          try {
            const statsResponse = await fetch(`/api/narrativas/stats?theme=${encodeURIComponent(narrativa.theme)}`, { signal })
            if (statsResponse.ok) {
              const stats = await statsResponse.json()
              return {
                theme: narrativa.theme,
                usage_count: stats.usage_count || 0,
                performance_score: stats.performance_score || 0,
                boosted_count: stats.boosted_count || 0,
              }
            }
          } catch { /* silêncio */ }
          return { theme: narrativa.theme, usage_count: 0, performance_score: 0, boosted_count: 0 }
        })
        const allNarrativaStats = await Promise.all(statsPromises)
        if (signal.aborted) return

        // 2. Buscar dados do Instagram (mesma lógica da página Conteúdo)
        let instagramPosts: Array<{ id: string; postedAt: string; caption: string; metrics: { likes: number; comments: number; engagement: number; views?: number; shares?: number; saves?: number } }> = []
        let hasInstagramData = false

        try {
          const igConfig = await loadInstagramConfigAsync()
          if (igConfig.token && igConfig.businessAccountId && !signal.aborted) {
            const igData = await fetchInstagramData(igConfig.token, igConfig.businessAccountId, '30d', false)
            if (igData && igData.posts) {
              instagramPosts = igData.posts
              hasInstagramData = true
            }
          }
        } catch (err) {
          if (signal.aborted) return
          console.error('Erro ao carregar dados Instagram para bandeiras:', err)
        }
        if (signal.aborted) return

        // 3. Buscar classificações dos posts (mesma API da página Conteúdo)
        let postClassifications: Record<string, { theme?: string; isBoosted?: boolean }> = {}
        try {
          const classResponse = await fetch('/api/instagram/classifications', { signal })
          if (classResponse.ok) {
            const classData = await classResponse.json()
            if (classData.success && classData.classifications) {
              postClassifications = classData.classifications
            }
          }
        } catch { /* silêncio */ }
        if (signal.aborted) return

        // 4. Função para gerar identifier (mesma da página Conteúdo)
        const getPostIdentifier = (post: { id: string; postedAt?: string; caption?: string }) => {
          if (post.id) return post.id
          if (post.postedAt && post.caption) {
            const dateStr = new Date(post.postedAt).toISOString().split('T')[0]
            const captionHash = post.caption.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
            return `${dateStr}_${captionHash}`
          }
          return post.id
        }

        // 5. Agregar métricas do Instagram por tema (mesma lógica de themeStats da Conteúdo)
        const themeMetrics: Record<string, {
          posts: number; totalLikes: number; totalComments: number
          totalEngagement: number; totalViews: number
        }> = {}

        if (instagramPosts.length > 0 && Object.keys(postClassifications).length > 0) {
          instagramPosts.forEach((post) => {
            const identifier = getPostIdentifier(post)
            const classification = postClassifications[identifier]

            if (classification?.theme) {
              const theme = classification.theme
              if (!themeMetrics[theme]) {
                themeMetrics[theme] = { posts: 0, totalLikes: 0, totalComments: 0, totalEngagement: 0, totalViews: 0 }
              }
              themeMetrics[theme].posts++
              themeMetrics[theme].totalLikes += post.metrics.likes || 0
              themeMetrics[theme].totalComments += post.metrics.comments || 0
              themeMetrics[theme].totalEngagement += post.metrics.engagement || 0
              themeMetrics[theme].totalViews += post.metrics.views || 0
            }
          })
        }

        // 6. Combinar narrativa stats com métricas do Instagram
        const combinedStats = allNarrativaStats.map((ns) => {
          const igMetrics = themeMetrics[ns.theme]
          const posts = igMetrics?.posts || 0
          return {
            theme: ns.theme,
            usage_count: ns.usage_count,
            performance_score: ns.performance_score,
            totalLikes: igMetrics?.totalLikes || 0,
            totalComments: igMetrics?.totalComments || 0,
            totalEngagement: igMetrics?.totalEngagement || 0,
            totalViews: igMetrics?.totalViews || 0,
            avgLikes: posts > 0 ? Math.round((igMetrics?.totalLikes || 0) / posts) : 0,
            avgEngagement: posts > 0 ? Math.round((igMetrics?.totalEngagement || 0) / posts) : 0,
            avgViews: posts > 0 ? Math.round((igMetrics?.totalViews || 0) / posts) : 0,
            posts,
            boostedCount: ns.boosted_count || 0,
          }
        })

        // 7. Ordenar e montar resultado
        combinedStats.sort((a, b) => b.usage_count - a.usage_count)
        const totalUsos = combinedStats.reduce((sum, s) => sum + s.usage_count, 0)
        const totalPerformance = combinedStats.length > 0
          ? Math.round(combinedStats.reduce((sum, s) => sum + s.performance_score, 0) / combinedStats.length)
          : 0

        if (!signal.aborted) {
          setBandeirasStats({
            totalUsos,
            totalPerformance,
            totalBandeiras: combinedStats.length,
            topBandeiras: combinedStats.slice(0, 5),
            hasInstagramData,
          })
        }
      } catch (error) {
        if (signal.aborted) return
        console.error('Erro ao buscar estatísticas das bandeiras:', error)
      } finally {
        if (!signal.aborted) setLoadingBandeiras(false)
      }
    }

    // Deferir 3s para não competir com carregamento inicial e navegação
    const timer = setTimeout(() => {
      if (!signal.aborted) fetchBandeirasStats()
    }, 3000)

    return () => {
      abortController.abort()
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    // Buscar KPIs do Território (mesma API que a página Território & Base usa)
    const fetchTerritorioKPIs = async () => {
      try {
        // 1. Primeiro verificar se há configuração no servidor (variáveis de ambiente)
        try {
          const serverConfigRes = await fetch('/api/territorio/config')
          const serverConfig = await serverConfigRes.json()
          
          if (serverConfig.configured) {
            // Usar configuração do servidor (sem enviar credenciais no body)
            const response = await fetch('/api/territorio/kpis', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}), // Servidor usa variáveis de ambiente
            })
            
            if (response.ok) {
              return await response.json()
            }
          }
        } catch (e) {
          // Continuar para localStorage se servidor não tiver configuração
        }

        // 2. Fallback: Verificar localStorage
        if (typeof window !== 'undefined') {
          const savedConfig = localStorage.getItem('territorio_sheets_config')
          if (savedConfig) {
            const config = JSON.parse(savedConfig)
            const response = await fetch('/api/territorio/kpis', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                spreadsheetId: config.spreadsheetId,
                sheetName: config.sheetName,
                range: config.range,
                serviceAccountEmail: config.serviceAccountEmail,
                credentials: config.credentials,
              }),
            })
            
            if (response.ok) {
              return await response.json()
            }
          }
        }
      } catch (error) {
        // Erro silencioso
      }
      return null
    }

    // Buscar projeção de chapas (eleitos do Republicanos) + ranking + análise 2ª vaga
    const fetchProjecaoChapaComRanking = async (votosExpectativa?: number): Promise<{
      eleitos: number
      ranking: { posicao: number; totalCandidatos: number } | null
      segundaVaga: { vagasAtuais: number; distancia: number; distanciaCompetidor?: number; tipo: 'margem' | 'faltam'; competidorProximo: string | null; qpRepublicanos: number; qpCompetidor: number; rodada: number } | null
    }> => {
      try {
        const params = votosExpectativa && votosExpectativa > 0
          ? `?votosExpectativa=${Math.round(votosExpectativa)}`
          : ''
        const response = await fetch(`/api/chapas/projecao-republicanos${params}`)
        if (response.ok) {
          const data = await response.json()
          return {
            eleitos: data.eleitos || 0,
            ranking: data.ranking || null,
            segundaVaga: data.segundaVaga || null,
          }
        }
      } catch (error) {
        // Erro silencioso
      }
      return { eleitos: 0, ranking: null, segundaVaga: null }
    }

    // Buscar KPIs da API
    Promise.all([
      fetch('/api/dashboard/kpis').then((res) => res.json()),
      fetchTerritorioKPIs(),
    ]).then(async ([data, territorioKPIs]) => {
      if (data.ife) {
        // Se temos KPIs do território, usar os valores calculados (mesmos da página Território & Base)
        const expectativa2026 = territorioKPIs?.expectativa2026 ?? null

        // Calcular votos para ranking
        let votosParaRanking = expectativa2026 ?? 0
        if (!votosParaRanking && data.ife.value) {
          const valorStr = String(data.ife.value).replace(/\./g, '').replace(/,/g, '.')
          votosParaRanking = parseFloat(valorStr) || 0
        }

        // Buscar projeção + ranking + análise 2ª vaga na mesma chamada
        const { eleitos: projecaoEleitos, ranking, segundaVaga } = await fetchProjecaoChapaComRanking(votosParaRanking)
        setProjecaoChapa(projecaoEleitos)
        if (ranking && ranking.posicao > 0) {
          setRankingExpectativa(ranking)
        }
        if (segundaVaga) {
          setSegundaVagaInfo({
            ...segundaVaga,
            distanciaCompetidor: segundaVaga.distanciaCompetidor ?? 0,
          })
        }

        const cidadesUnicas = territorioKPIs?.cidadesUnicas ?? null
        const liderancas = territorioKPIs?.liderancas ?? null
        
        setKpis([
          {
            id: 'ife',
            label: 'Expectativa de Votos',
            value: expectativa2026 !== null && expectativa2026 !== undefined 
              ? (typeof expectativa2026 === 'number' ? expectativa2026.toLocaleString('pt-BR') : String(expectativa2026))
              : (typeof data.ife.value === 'number' ? data.ife.value.toLocaleString('pt-BR') : data.ife.value),
            variation: data.ife.variation,
            status: data.ife.status,
          },
            {
              id: 'presenca',
              label: 'Cobertura Territorial',
              value: cidadesUnicas !== null && cidadesUnicas !== undefined 
                ? `${cidadesUnicas}/224` 
                : data.presenca.value,
              variation: data.presenca.variation,
              status: data.presenca.status,
            },
            {
              id: 'base',
              label: 'Lideranças Mapeadas',
              value: liderancas !== null && liderancas !== undefined 
                ? (typeof liderancas === 'number' ? liderancas.toLocaleString('pt-BR') : String(liderancas))
                : (typeof data.base.value === 'number' ? data.base.value.toLocaleString('pt-BR') : data.base.value),
              variation: data.base.variation,
              status: data.base.status,
            },
            {
              id: 'projecao',
              label: 'Projeção Federal',
              value: `${projecaoEleitos} ${projecaoEleitos === 1 ? 'vaga' : 'vagas'}`,
              variation: 0,
              status: projecaoEleitos >= 2 ? 'success' : projecaoEleitos >= 1 ? 'warning' : 'error',
            },
            {
              id: 'sentimento',
              label: 'Média Pesquisas',
              value: '-',
              variation: 0,
              status: 'neutral',
            },
            {
              id: 'risco',
              label: 'Risco de Crise',
              value: `${data.risco.value} ${Number(data.risco.value) === 1 ? 'alerta' : 'alertas'}`,
              variation: data.risco.variation,
              status: data.risco.status,
            },
          ])
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  // KPIs com média de pesquisas atualizada em tempo real
  const kpisComMedia = kpis.map((kpi): KPI => {
    if (kpi.id === 'sentimento') {
      let status: 'success' | 'warning' | 'error' | 'neutral' = 'neutral'
      if (mediaPesquisas !== null) {
        if (mediaPesquisas >= 50) {
          status = 'success'
        } else if (mediaPesquisas >= 30) {
          status = 'warning'
        } else {
          status = 'error'
        }
      }
      return {
        ...kpi,
        value: mediaPesquisas !== null ? `${mediaPesquisas}%` : '-',
        status,
      }
    }
    return kpi
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-6 lg:px-6">
        {/* KPI Hero - Expectativa 2026 */}
        <section className="mb-4">
          {loading ? (
            <div className="h-40 bg-surface rounded-2xl border border-card animate-pulse" />
          ) : (
            (() => {
              const heroKpi = kpisComMedia.find(k => k.id === 'ife')
              if (!heroKpi) return null
              
              // Calcular % de crescimento vs eleição anterior (83.175 votos)
              const valorAtual = typeof heroKpi.value === 'string'
                ? parseFloat(heroKpi.value.replace(/[^\d]/g, '')) || 0
                : typeof heroKpi.value === 'number' ? heroKpi.value : 0
              
              const infoLines: Array<{ text: string; type?: 'positive' | 'negative' | 'neutral'; icon?: 'trending' | 'trophy' }> = []
              
              if (valorAtual > 0 && VOTOS_ELEICAO_ANTERIOR > 0) {
                const percentualCrescimento = ((valorAtual - VOTOS_ELEICAO_ANTERIOR) / VOTOS_ELEICAO_ANTERIOR) * 100
                const sinal = percentualCrescimento >= 0 ? '+' : ''
                infoLines.push({
                  text: `${sinal}${percentualCrescimento.toFixed(1).replace('.', ',')}% vs eleição anterior (${VOTOS_ELEICAO_ANTERIOR.toLocaleString('pt-BR')} votos)`,
                  type: percentualCrescimento >= 0 ? 'positive' : 'negative',
                  icon: 'trending',
                })
              }
              
              if (rankingExpectativa && rankingExpectativa.posicao > 0) {
                infoLines.push({
                  text: `${rankingExpectativa.posicao}º lugar projetado (chapa)`,
                  type: 'neutral',
                  icon: 'trophy',
                })
              }
              
              return (
                <KPIHeroCard 
                  kpi={heroKpi} 
                  infoLines={infoLines.length > 0 ? infoLines : undefined}
                  href="/ife"
                />
              )
            })()
          )}
        </section>

        {/* KPIs Secundários */}
        <section className="mb-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-stretch">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="min-h-[90px] bg-surface rounded-2xl border border-card animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-stretch">
              {kpisComMedia.filter(kpi => kpi.id !== 'ife').map((kpi, index) => {
                // Subtítulo para Cobertura Territorial (% de cobertura)
                let cardSubtitle: string | undefined
                let cardSubtitleType: 'positive' | 'negative' | 'neutral' | undefined
                let cardInfoLines: Array<{ text: string; type?: 'positive' | 'negative' | 'neutral' }> | undefined
                
                if (kpi.id === 'presenca' && typeof kpi.value === 'string' && kpi.value.includes('/')) {
                  const [cidades, total] = kpi.value.split('/').map(v => parseInt(v.trim()) || 0)
                  if (total > 0) {
                    const percentual = Math.round((cidades / total) * 100)
                    cardSubtitle = `${percentual}% de cobertura`
                    cardSubtitleType = percentual >= 50 ? 'positive' : percentual >= 30 ? 'neutral' : 'negative'
                  }
                }
                
                // Info lines para Média Pesquisas (ranking + projeção de votos)
                if (kpi.id === 'sentimento' && rankingPesquisas && rankingPesquisas.posicao > 0) {
                  const lines: Array<{ text: string; type?: 'positive' | 'negative' | 'neutral' }> = []
                  
                  // Linha 1: ranking entre candidatos
                  const rankType = rankingPesquisas.posicao <= 3 ? 'positive' as const : rankingPesquisas.posicao <= 5 ? 'neutral' as const : 'negative' as const
                  lines.push({
                    text: `${rankingPesquisas.posicao}º de ${rankingPesquisas.totalCandidatos} candidatos`,
                    type: rankType,
                  })
                  
                  // Linha 2: projeção de votos baseada nas pesquisas
                  if (rankingPesquisas.projecaoVotos && rankingPesquisas.projecaoVotos > 0) {
                    lines.push({
                      text: `≈ ${rankingPesquisas.projecaoVotos.toLocaleString('pt-BR')} votos (${rankingPesquisas.cidadesComPesquisa} cid.)`,
                      type: 'neutral',
                    })
                  }
                  
                  cardInfoLines = lines
                }
                
                // Info para Projeção Chapa Federal (margem REP + ameaça do competidor)
                if (kpi.id === 'projecao' && segundaVagaInfo && segundaVagaInfo.distancia > 0) {
                  const competidor = segundaVagaInfo.competidorProximo || '?'
                  if (segundaVagaInfo.tipo === 'margem') {
                    const margemType = segundaVagaInfo.distancia > 20000 ? 'positive' as const : segundaVagaInfo.distancia > 5000 ? 'neutral' as const : 'negative' as const
                    const lines: Array<{ text: string; type?: 'positive' | 'negative' | 'neutral' }> = [
                      {
                        text: `Margem: ${segundaVagaInfo.distancia.toLocaleString('pt-BR')} votos`,
                        type: margemType,
                      },
                    ]
                    if (segundaVagaInfo.distanciaCompetidor > 0) {
                      lines.push({
                        text: `${competidor} precisa +${segundaVagaInfo.distanciaCompetidor.toLocaleString('pt-BR')} votos`,
                        type: 'negative',
                      })
                    }
                    cardInfoLines = lines
                  } else {
                    cardSubtitle = `-${segundaVagaInfo.distancia.toLocaleString('pt-BR')} votos p/ 2ª vaga (${competidor})`
                    cardSubtitleType = 'negative'
                  }
                }
                
                return (
                  <AnimatedSection key={kpi.id} delay={index * 60}>
                    <KPICard 
                      kpi={kpi} 
                      href={`/${kpi.id}`}
                      subtitle={cardSubtitle}
                      subtitleType={cardSubtitleType}
                      infoLines={cardInfoLines}
                    />
                  </AnimatedSection>
                )
              })}
            </div>
          )}
        </section>

        {/* Bloco de Leitura Rápida / Insight - Compacto */}
        {!loading && (
          <section className="mb-4">
            <div className="bg-gradient-to-r from-primary-soft to-surface rounded-xl border border-accent-gold/20 px-4 py-3">
              <div className="flex items-center gap-3">
                <Lightbulb className="w-4 h-4 text-accent-gold flex-shrink-0" />
                <p className="text-sm text-secondary flex-1">
                  {(() => {
                    const presencaKpi = kpisComMedia.find(k => k.id === 'presenca')
                    const baseKpi = kpisComMedia.find(k => k.id === 'base')
                    const riscoKpi = kpisComMedia.find(k => k.id === 'risco')
                    
                    const insights: string[] = []
                    
                    if (presencaKpi && presencaKpi.variation && presencaKpi.variation > 0) {
                      insights.push(`Presença territorial cresceu ${presencaKpi.variation}% no último mês`)
                    }
                    
                    if (riscoKpi && riscoKpi.status === 'error') {
                      insights.push(`há risco de saturação em territórios-chave`)
                    }
                    
                    if (baseKpi && baseKpi.value) {
                      insights.push(`Base ativa com ${baseKpi.value} lideranças mapeadas`)
                    }
                    
                    return insights.length > 0 
                      ? insights.join(', ') + '.'
                      : 'Análise estratégica em tempo real dos indicadores de performance.'
                  })()}
                </p>
                <button
                  onClick={() => setInsightTelaCheia(true)}
                  className="p-1 rounded hover:bg-background/50 transition-colors text-secondary hover:text-text-primary"
                  title="Visualizar em tela cheia"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Grid 1: Análise de Territórios + Histórico de Pesquisas (lado a lado) */}
        <AnimatedSection>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            {/* Análise de Territórios - Compacto */}
            <div className="bg-surface rounded-2xl border border-card p-4 relative overflow-hidden h-full">
              {/* Linha vertical de destaque */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-gold opacity-20" />
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent-gold" />
                  <h2 className="text-base font-semibold text-text-primary">Análise de Territórios</h2>
                  <span className="text-[10px] text-secondary bg-background px-1.5 py-0.5 rounded">Fonte própria</span>
                </div>
                <button
                  onClick={() => setAnaliseTerritoriosTelaCheia(true)}
                  className="p-1.5 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
                  title="Ver detalhes"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              {loadingTerritorios ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-background rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Estatísticas Compactas */}
                  {(() => {
                    const presencaKpi = kpisComMedia.find(k => k.id === 'presenca')
                    let cidadesAtivas = 0
                    let totalCidades = 224
                    
                    if (presencaKpi && typeof presencaKpi.value === 'string' && presencaKpi.value.includes('/')) {
                      const [cidades, total] = presencaKpi.value.split('/').map(v => parseInt(v.trim()) || 0)
                      cidadesAtivas = cidades
                      totalCidades = total || 224
                    }
                    
                    const cidadesVisitadas = territorioStats?.cidadesVisitadas || 0
                    const percentualCobertura = cidadesAtivas > 0 
                      ? Math.round((cidadesVisitadas / cidadesAtivas) * 100) 
                      : 0

                    // Calcular eleitorado: total do estado, com presença e sem presença
                    const normalizeName = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
                    const cidadesComLiderancasNorm = new Set(cidadesComLiderancas.map(normalizeName))
                    
                    let eleitoradoTotal = 0
                    let eleitoradoComPresenca = 0
                    let eleitoradoSemPresenca = 0
                    
                    Object.entries(eleitoresPorCidade).forEach(([cidade, eleitorado]) => {
                      eleitoradoTotal += eleitorado
                      if (cidadesComLiderancasNorm.has(normalizeName(cidade))) {
                        eleitoradoComPresenca += eleitorado
                      } else {
                        eleitoradoSemPresenca += eleitorado
                      }
                    })

                    const percentualEleitoradoCoberto = eleitoradoTotal > 0
                      ? Math.round((eleitoradoComPresenca / eleitoradoTotal) * 100)
                      : 0
                    
                    return (
                      <>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div className="p-3 rounded-lg border border-accent-gold/30 bg-gradient-to-br from-primary-soft to-surface">
                            <div className="flex items-center gap-1.5 mb-1">
                              <MapPin className="w-3.5 h-3.5 text-accent-gold" />
                              <p className="text-xs font-medium text-secondary">Presença</p>
                            </div>
                            <p className="text-xl font-bold text-text-primary leading-tight">{cidadesAtivas}</p>
                            <p className="text-xs text-secondary">de {totalCidades}</p>
                          </div>
                          <div className="p-3 rounded-lg border border-card bg-surface">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Activity className="w-3.5 h-3.5 text-accent-gold" />
                              <p className="text-xs font-medium text-secondary">Visitadas</p>
                            </div>
                            <p className="text-xl font-bold text-text-primary leading-tight">{cidadesVisitadas}</p>
                            <p className="text-xs text-secondary">cidades</p>
                          </div>
                          <div className="p-3 rounded-lg border border-card bg-surface">
                            <div className="flex items-center gap-1.5 mb-1">
                              <TrendingUp className="w-3.5 h-3.5 text-accent-gold" />
                              <p className="text-xs font-medium text-secondary">Cobertura</p>
                            </div>
                            <p className="text-xl font-bold text-text-primary leading-tight">{percentualCobertura}%</p>
                            <p className="text-xs text-secondary">das ativas</p>
                          </div>
                        </div>

                        {/* Eleitorado */}
                        {eleitoradoTotal > 0 && (
                          <div className="p-3 rounded-lg border border-card bg-surface mb-2">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Users className="w-3.5 h-3.5 text-accent-gold" />
                              <p className="text-xs font-medium text-secondary">Eleitorado</p>
                              <span className="ml-auto text-xs font-semibold text-accent-gold">{percentualEleitoradoCoberto}% coberto</span>
                            </div>
                            <AnimatedBar 
                              percentage={percentualEleitoradoCoberto} 
                              className="mb-1.5"
                            />
                            <p className="text-xs text-secondary mb-2">Potencial de expansão: <span className="font-semibold text-accent-gold">{Math.round(eleitoradoSemPresenca / 1000).toLocaleString('pt-BR')} mil eleitores</span></p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-sm font-bold text-text-primary">{eleitoradoTotal.toLocaleString('pt-BR')}</p>
                                <p className="text-[10px] text-secondary">Total PI</p>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-accent-gold">{eleitoradoComPresenca.toLocaleString('pt-BR')}</p>
                                <p className="text-[10px] text-secondary">Com presença</p>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-secondary">{eleitoradoSemPresenca.toLocaleString('pt-BR')}</p>
                                <p className="text-[10px] text-secondary">Sem presença</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}

                  {/* Resumo de Territórios - Inline */}
                  <div className="flex items-center gap-2 text-xs">
                    {territoriosQuentes.length > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-full">
                        <Flame className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-700 font-medium">{territoriosQuentes.length} quentes</span>
                      </div>
                    )}
                    {territoriosMornos.length > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-full">
                        <ThermometerSun className="w-3 h-3 text-amber-500" />
                        <span className="text-amber-700 font-medium">{territoriosMornos.length} mornos</span>
                      </div>
                    )}
                    {territoriosFrios.length > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded-full">
                        <ThermometerSnowflake className="w-3 h-3 text-red-500" />
                        <span className="text-red-700 font-medium">{territoriosFrios.length} frios</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

          </div>

          {/* Histórico de Pesquisas - Compacto */}
          <div>
            <div className="bg-surface rounded-2xl border border-card p-4 relative overflow-hidden h-full">
              {/* Linha vertical de destaque */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-gold opacity-20" />
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-text-primary">Histórico de Pesquisas</h2>
                  {candidatoPadrao && (
                    <span className="text-xs text-secondary bg-accent-gold-soft px-2 py-0.5 rounded-full border border-accent-gold/20">
                      {candidatoPadrao}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {pollsData.length > 0 && (
                    <>
                      <span className="text-[10px] text-secondary bg-background px-1.5 py-0.5 rounded">
                        Fonte própria
                      </span>
                      <button
                        onClick={() => setGraficoPollsTelaCheia(true)}
                        className="p-1.5 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
                        title="Visualizar em tela cheia"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="h-48">
                {loadingPolls ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-full h-full space-y-4">
                      <div className="h-8 bg-surface rounded-lg animate-pulse" />
                      <div className="h-48 bg-surface rounded-lg animate-pulse" />
                    </div>
                  </div>
                ) : pollsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pollsData}>
                      <defs>
                        <linearGradient id="colorIntencao" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="rgb(var(--accent-gold))" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="rgb(var(--accent-gold))" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-card))" strokeWidth={1} opacity={0.5} />
                      <XAxis dataKey="date" stroke="rgb(var(--text-muted))" fontSize={12} />
                      <YAxis 
                        stroke="rgb(var(--text-muted))" 
                        fontSize={12}
                        domain={[0, 100]}
                        label={{ value: 'Intenção (%)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgb(var(--bg-surface))',
                          border: '1px solid rgb(var(--border-card))',
                          borderRadius: '8px',
                          padding: '12px',
                        }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length > 0) {
                            const data = payload[0].payload as { date: string; intencao: number; instituto?: string; cidade?: string }
                            const intencaoPercent = data.intencao || 0
                            const cidade = data.cidade && data.cidade !== 'Estado' && data.cidade !== 'Cidade não encontrada' ? data.cidade : null
                            
                            // Calcular feedback comparativo
                            let feedbackText = null
                            if (cidade) {
                              const eleitorado = getEleitoradoByCity(cidade)
                              const expectativaVotos = expectativasPorCidade[cidade] || 0
                              
                              if (eleitorado && eleitorado > 0) {
                                const votosProporcionais = Math.round((intencaoPercent / 100) * eleitorado)
                                
                                if (expectativaVotos > 0) {
                                  const diferenca = votosProporcionais - expectativaVotos
                                  const percentualDiferenca = ((diferenca / expectativaVotos) * 100).toFixed(1)
                                  
                                  let status = 'neutral'
                                  let statusText = 'dentro do padrão'
                                  
                                  if (Math.abs(parseFloat(percentualDiferenca)) <= 10) {
                                    status = 'success'
                                    statusText = 'dentro do padrão'
                                  } else if (diferenca > 0) {
                                    status = 'success'
                                    statusText = `acima do esperado (+${Math.abs(parseFloat(percentualDiferenca))}%)`
                                  } else {
                                    status = 'error'
                                    statusText = `abaixo do esperado (${percentualDiferenca}%)`
                                  }
                                  
                                  feedbackText = {
                                    cidade,
                                    eleitorado,
                                    intencaoPercent,
                                    votosProporcionais,
                                    expectativaVotos,
                                    diferenca,
                                    status,
                                    statusText,
                                  }
                                } else {
                                  feedbackText = {
                                    cidade,
                                    eleitorado,
                                    intencaoPercent,
                                    votosProporcionais,
                                    expectativaVotos: null,
                                    status: 'neutral',
                                    statusText: 'expectativa não disponível',
                                  }
                                }
                              }
                            }
                            
                            return (
                              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[280px]">
                                <p className="font-semibold text-text-primary mb-2">{label}</p>
                                <p className="text-sm text-text-primary mb-1">
                                  <span className="font-medium">Intenção de Voto:</span>{' '}
                                  <span className="text-accent-gold">{intencaoPercent}%</span>
                                </p>
                                {data.instituto && data.instituto !== 'Não informado' && (
                                  <p className="text-sm text-secondary mb-1">
                                    <span className="font-medium">Instituto:</span> {data.instituto}
                                  </p>
                                )}
                                {cidade && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-sm font-medium text-text-primary mb-2">Análise Comparativa - {cidade}</p>
                                    {feedbackText ? (
                                      <>
                                        <p className="text-xs text-secondary mb-1">
                                          <span className="font-medium">Eleitorado:</span> {feedbackText.eleitorado.toLocaleString('pt-BR')} eleitores
                                        </p>
                                        <p className="text-xs text-secondary mb-1">
                                          <span className="font-medium">Votos Proporcionais:</span> {feedbackText.votosProporcionais.toLocaleString('pt-BR')} votos ({intencaoPercent}% × {feedbackText.eleitorado.toLocaleString('pt-BR')})
                                        </p>
                                        {feedbackText.expectativaVotos !== null && (
                                          <>
                                            <p className="text-xs text-secondary mb-1">
                                              <span className="font-medium">Expectativa (Território & Base):</span> {feedbackText.expectativaVotos.toLocaleString('pt-BR')} votos
                                            </p>
                                            <p className={`text-xs font-medium mt-2 pt-2 border-t border-gray-100 ${
                                              feedbackText.status === 'success' ? 'text-green-600' :
                                              feedbackText.status === 'error' ? 'text-red-600' :
                                              'text-gray-600'
                                            }`}>
                                              Status: {feedbackText.statusText}
                                            </p>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <p className="text-xs text-secondary">Dados de eleitorado não disponíveis para esta cidade</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="intencao"
                        stroke="rgb(var(--accent-gold))"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorIntencao)"
                        name="Intenção de Voto"
                        dot={(props: any) => {
                          const { cx, cy, payload } = props
                          if (!payload) return <circle cx={cx} cy={cy} r={4} fill="rgb(var(--accent-gold))" />
                          
                          const instituto = payload.instituto || ''
                          const cidade = payload.cidade || ''
                          const value = payload.intencao || 0
                          
                          const infoParts = []
                          if (instituto && instituto !== 'Não informado') {
                            infoParts.push(instituto)
                          }
                          if (cidade && cidade !== 'Estado' && cidade !== 'Cidade não encontrada') {
                            infoParts.push(cidade)
                          }
                          const infoText = infoParts.length > 0 ? infoParts.join(' - ') : ''
                          
                          return (
                            <g>
                              <circle cx={cx} cy={cy} r={4} fill="rgb(var(--accent-gold))" />
                              <text
                                x={cx}
                                y={cy - 20}
                                fill="rgb(var(--accent-gold))"
                                fontSize="12"
                                fontWeight="600"
                                textAnchor="middle"
                              >
                                {`${value}%`}
                              </text>
                              {infoText && (
                                <text
                                  x={cx}
                                  y={cy - 8}
                                  fill="rgb(var(--text-muted))"
                                  fontSize="9"
                                  fontWeight="400"
                                  textAnchor="middle"
                                >
                                  {infoText}
                                </text>
                              )}
                            </g>
                          )
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-secondary">
                    {candidatoPadrao 
                      ? 'Nenhuma pesquisa encontrada para este candidato'
                      : 'Selecione um candidato padrão na página Pesquisa & Relato'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </AnimatedSection>

        {/* Grid 2: Bandeiras + Alertas */}
        <AnimatedSection delay={100}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* Radar de Posicionamento - Card compacto */}
          <div className="bg-surface rounded-2xl border border-card p-4 relative overflow-hidden flex flex-col">
              {/* Linha vertical de destaque */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-gold opacity-20" />
              
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent-gold" />
                  <h2 className="text-base font-semibold text-text-primary">Bandeiras</h2>
                  <span className="text-[10px] text-secondary bg-background px-1.5 py-0.5 rounded">30 dias</span>
                </div>
                <button
                  onClick={() => setBandeirasTelaCheia(true)}
                  className="p-1.5 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
                  title="Ver detalhes"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              {/* Frase-resumo dinâmica — 1 linha */}
              {bandeirasInsights && (
                <p className="text-[10px] text-secondary italic mb-2 truncate leading-tight">
                  {bandeirasInsights.mainSentence}
                </p>
              )}

              {loadingBandeiras ? (
                <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-background rounded animate-pulse" />
                  ))}
                </div>
              ) : bandeirasInsights && bandeirasInsights.enriched.length > 0 ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                  <div className="flex flex-col justify-evenly flex-1 gap-1.5">
                    {bandeirasInsights.enriched.slice(0, 3).map((bandeira) => {
                      const isFirst = bandeira.rank === 1
                      const trendColor = bandeira.trend === 'up' ? 'text-emerald-500' : bandeira.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                      const trendSymbol = bandeira.trend === 'up' ? '↑' : bandeira.trend === 'down' ? '↓' : '→'
                      const domColor = bandeira.dominanceLevel === 'dominant' ? 'bg-emerald-500' : bandeira.dominanceLevel === 'relevant' ? 'bg-amber-500' : 'bg-red-400'
                      const domLabel = bandeira.dominanceLevel === 'dominant' ? 'Dominante' : bandeira.dominanceLevel === 'relevant' ? 'Relevante' : 'Baixa'
                      const domTextColor = bandeira.dominanceLevel === 'dominant' ? 'text-emerald-600' : bandeira.dominanceLevel === 'relevant' ? 'text-amber-600' : 'text-red-500'
                      const engLabel = bandeira.engagementLevel === 'high' ? 'Alto engaj.' : bandeira.engagementLevel === 'medium' ? 'Engaj. médio' : 'Baixo engaj.'
                      const engColor = bandeira.engagementLevel === 'high' ? 'text-emerald-600' : bandeira.engagementLevel === 'medium' ? 'text-amber-600' : 'text-gray-500'

                      return (
                        <div
                          key={bandeira.theme}
                          className={`p-2.5 rounded-lg ${isFirst ? 'bg-accent-gold/5 border border-accent-gold/15' : 'bg-background'}`}
                        >
                          {/* Linha 1: rank + nome + trend + dominância badge */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${isFirst ? 'bg-accent-gold text-white' : 'bg-background border border-card text-secondary'}`}>
                                {isFirst ? <Crown className="w-2.5 h-2.5" /> : bandeira.rank}
                              </div>
                              <span className="text-sm text-text-primary font-medium truncate">{bandeira.theme}</span>
                              <span className={`text-[10px] font-bold flex-shrink-0 ${trendColor}`}>{trendSymbol}</span>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold rounded-full flex-shrink-0 ${bandeira.dominanceLevel === 'dominant' ? 'bg-emerald-500/10' : bandeira.dominanceLevel === 'relevant' ? 'bg-amber-500/10' : 'bg-red-500/10'} ${domTextColor}`}>
                              <span className={`w-1 h-1 rounded-full ${domColor}`} />
                              {domLabel}
                            </span>
                          </div>
                          {/* Linha 2: barra de dominância + métricas inline */}
                          <div className="flex items-center gap-2 pl-6">
                            <div className="w-16 h-1 bg-background rounded-full overflow-hidden flex-shrink-0">
                              <div className={`h-full rounded-full animate-grow ${domColor}`} style={{ width: `${Math.max(bandeira.dominancePercent, 3)}%` }} />
                            </div>
                            <span className="text-[10px] text-secondary">{bandeira.usage_count} menções</span>
                            <span className="text-gray-300 text-[10px]">·</span>
                            <span className={`text-[10px] font-medium ${engColor}`}>{engLabel}</span>
                            {bandeira.posts > 0 && (
                              <>
                                <span className="text-gray-300 text-[10px]">·</span>
                                <span className="flex items-center gap-0.5 text-[10px] text-secondary">
                                  <Eye className="w-2.5 h-2.5" />{bandeira.formattedViews}
                                </span>
                                <span className="flex items-center gap-0.5 text-[10px] text-rose-500">
                                  <Heart className="w-2.5 h-2.5" />{bandeira.formattedLikes}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : bandeirasStats ? (
                <p className="text-xs text-secondary text-center py-2 flex-1 flex items-center justify-center">
                  Nenhuma bandeira ativa
                </p>
              ) : (
                <div className="bg-surface rounded-xl border border-card p-4 flex-1 flex items-center justify-center">
                  <p className="text-sm text-secondary text-center">
                    Erro ao carregar estatísticas das bandeiras
                  </p>
                </div>
              )}
            </div>

          {/* Monitor de Imprensa - Compacto */}
          <div className="bg-surface rounded-2xl border border-card p-4 relative overflow-hidden flex flex-col">
            {/* Linha vertical de destaque - cinza institucional */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary opacity-15" />
            
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Activity className="w-4 h-4 text-secondary" />
                Monitor de Imprensa
              </h2>
              <button
                onClick={() => setAlertasTelaCheia(true)}
                className="p-1.5 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
                title="Ver todos"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Headline interpretativa — tom de vigilância */}
            {monitorInsight && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  monitorInsight.tone === 'positive' ? 'bg-emerald-500' 
                  : monitorInsight.tone === 'negative' ? 'bg-red-500' 
                  : monitorInsight.tone === 'warning' ? 'bg-amber-500' 
                  : 'bg-gray-400'
                }`} />
                <p className="text-[10px] text-secondary leading-tight truncate">
                  {monitorInsight.headline}
                </p>
              </div>
            )}

            <div className="space-y-1.5 max-h-[200px] overflow-y-auto flex-1">
              {loadingAlerts ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-background rounded-lg p-2.5 animate-pulse">
                      <div className="h-3 bg-surface rounded w-3/4 mb-1" />
                      <div className="h-2 bg-surface rounded w-1/2" />
                    </div>
                  ))}
                </>
              ) : monitorNews.length > 0 ? (
                monitorNews.slice(0, 4).map((item) => {
                  const isHighRisk = item.risk_level === 'high'
                  const sentimentDot = item.sentiment === 'positive' ? 'bg-emerald-500' 
                    : item.sentiment === 'negative' ? 'bg-red-500' 
                    : 'bg-gray-400'
                  const dateStr = item.published_at || item.collected_at
                  const dateFormatted = dateStr 
                    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(
                        new Date(typeof dateStr === 'string' ? dateStr : new Date())
                      )
                    : ''

                  return (
                    <a
                      key={item.id}
                      href={item.url || '/dashboard/noticias'}
                      target={item.url ? '_blank' : '_self'}
                      rel="noopener noreferrer"
                      className={`block p-2.5 rounded-lg transition-all duration-200 ease-out hover:shadow-sm hover:-translate-y-[1px] fade-in ${
                        isHighRisk 
                          ? 'bg-red-500/[0.03] border border-red-500/10 hover:border-red-500/20' 
                          : 'bg-background hover:bg-background/80'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${sentimentDot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-text-primary leading-tight line-clamp-2">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-secondary">
                            <span className="truncate max-w-[80px]">{item.source}</span>
                            {dateFormatted && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span>{dateFormatted}</span>
                              </>
                            )}
                            {isHighRisk && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span className="text-red-500 font-medium">Risco Alto</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </a>
                  )
                })
              ) : (
                <div className="text-center py-3 flex-1 flex items-center justify-center">
                  <p className="text-xs text-secondary">Nenhuma notícia destacada</p>
                </div>
              )}
            </div>
          </div>
        </div>
        </AnimatedSection>
      </div>

      {/* Modal de Análise de Territórios em Tela Cheia */}
      {analiseTerritoriosTelaCheia && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
              <Activity className="w-6 h-6 text-accent-gold" />
              Análise de Territórios
            </h2>
            <button
              onClick={() => setAnaliseTerritoriosTelaCheia(false)}
              className="p-2 rounded-lg hover:bg-background transition-colors"
              title="Fechar tela cheia"
            >
              <X className="w-6 h-6 text-secondary" />
            </button>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            <div className="w-full max-w-7xl mx-auto">
              {/* Replicar conteúdo da seção Análise de Territórios aqui */}
              {loadingTerritorios ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-background rounded-xl animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Estatísticas Gerais */}
                  {(() => {
                    const presencaKpi = kpisComMedia.find(k => k.id === 'presenca')
                    let cidadesAtivas = 0
                    let totalCidades = 224
                    
                    if (presencaKpi && typeof presencaKpi.value === 'string' && presencaKpi.value.includes('/')) {
                      const [cidades, total] = presencaKpi.value.split('/').map(v => parseInt(v.trim()) || 0)
                      cidadesAtivas = cidades
                      totalCidades = total || 224
                    }
                    
                    const cidadesVisitadas = territorioStats?.cidadesVisitadas || 0
                    const percentualCobertura = cidadesAtivas > 0 
                      ? Math.round((cidadesVisitadas / cidadesAtivas) * 100) 
                      : 0
                    
                    return (
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="relative p-6 rounded-2xl border-2 border-accent-gold/30 bg-gradient-to-br from-primary-soft to-surface">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-5 h-5 text-accent-gold" />
                            <p className="text-sm font-medium text-secondary">Cidades com Presença</p>
                          </div>
                          <p className="text-4xl font-bold text-text-primary">{cidadesAtivas}</p>
                          <p className="text-sm text-secondary mt-1">de {totalCidades} municípios</p>
                        </div>
                        <div className="relative p-6 rounded-2xl border border-card bg-surface">
                          <div className="flex items-center gap-2 mb-2">
                            <Activity className="w-5 h-5 text-blue-600" />
                            <p className="text-sm font-medium text-secondary">Cidades Visitadas</p>
                          </div>
                          <p className="text-4xl font-bold text-blue-600">{cidadesVisitadas}</p>
                          <p className="text-sm text-secondary mt-1">de {cidadesAtivas} com presença</p>
                        </div>
                        <div className="relative p-6 rounded-2xl border border-card bg-surface">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                            <p className="text-sm font-medium text-secondary">Cobertura</p>
                          </div>
                          <p className="text-4xl font-bold text-emerald-600">{percentualCobertura}%</p>
                          <p className="text-sm text-secondary mt-1">das cidades com presença</p>
                        </div>
                      </div>
                    )
                  })()}
                  
                  {/* Mapa de Presença Interativo */}
                  {showMapaPresenca && (() => {
                    return cidadesComLiderancas.length > 0 ? (
                      <div id="mapa-territorio-container" className="mb-8 relative">
                        <MapaPresenca
                          cidadesComPresenca={cidadesComLiderancas}
                          cidadesVisitadas={cidadesVisitadasLista}
                          totalCidades={224}
                          fullscreen={true}
                          territoriosQuentes={territoriosQuentes}
                          territoriosMornos={territoriosMornos}
                          territoriosFrios={territoriosFrios}
                          onFullscreen={() => {
                            const container = document.getElementById('mapa-territorio-container')
                            if (!container) return
                            if (document.fullscreenElement) {
                              document.exitFullscreen()
                            } else {
                              container.requestFullscreen().catch(() => {})
                            }
                          }}
                        />
                      </div>
                    ) : null
                  })()}
                  
                  {/* Territórios Quentes, Mornos e Frios */}
                  <div className="space-y-6">
                    {territoriosQuentes.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Flame className="w-5 h-5 text-emerald-500" />
                          <span className="text-base font-semibold text-emerald-600">Territórios Quentes</span>
                          <span className="text-sm text-secondary">({territoriosQuentes.length})</span>
                        </div>
                        <div className="space-y-2">
                          {territoriosQuentes.map((territorio) => (
                            <div
                              key={territorio.cidade}
                              className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold">
                                  {territorio.visitas}
                                </div>
                                <div>
                                  <p className="text-base font-medium text-text-primary">{territorio.cidade}</p>
                                  <p className="text-xs text-secondary">{territorio.motivo}</p>
                                </div>
                              </div>
                              {territorio.expectativaVotos && territorio.expectativaVotos > 0 && (
                                <span className="text-sm font-semibold text-emerald-600">
                                  {territorio.expectativaVotos.toLocaleString('pt-BR')} votos
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {territoriosMornos.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <ThermometerSun className="w-5 h-5 text-amber-500" />
                          <span className="text-base font-semibold text-amber-600">Territórios Mornos</span>
                          <span className="text-sm text-secondary">({territoriosMornos.length})</span>
                        </div>
                        <div className="space-y-2">
                          {territoriosMornos.map((territorio) => (
                            <div
                              key={territorio.cidade}
                              className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-400 text-white flex items-center justify-center text-sm font-bold">
                                  {territorio.visitas || 0}
                                </div>
                                <div>
                                  <p className="text-base font-medium text-text-primary">{territorio.cidade}</p>
                                  <p className="text-xs text-secondary">{territorio.motivo}</p>
                                </div>
                              </div>
                              {territorio.expectativaVotos && territorio.expectativaVotos > 0 && (
                                <span className="text-sm font-semibold text-amber-600">
                                  {territorio.expectativaVotos.toLocaleString('pt-BR')} votos
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {territoriosFrios.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <ThermometerSnowflake className="w-5 h-5 text-red-500" />
                          <span className="text-base font-semibold text-red-600">Territórios Frios (Alerta)</span>
                          <span className="text-sm text-secondary">({territoriosFrios.length})</span>
                        </div>
                        <div className="space-y-2">
                          {territoriosFrios.map((territorio) => (
                            <div
                              key={territorio.cidade}
                              className="p-3 rounded-lg border border-red-200 bg-red-50/50 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold">
                                  {territorio.visitas || 0}
                                </div>
                                <div>
                                  <p className="text-base font-medium text-text-primary">{territorio.cidade}</p>
                                  <p className="text-xs text-secondary">{territorio.motivo}</p>
                                </div>
                              </div>
                              {territorio.expectativaVotos && territorio.expectativaVotos > 0 && (
                                <span className="text-sm font-semibold text-red-600">
                                  {territorio.expectativaVotos.toLocaleString('pt-BR')} votos
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mapa em Tela Cheia */}
      {mapaTelaCheia && (() => {
        const handleFullscreenToggle = () => {
          const container = document.getElementById('mapa-fullscreen-container')
          if (!container) return

          if (document.fullscreenElement) {
            document.exitFullscreen()
          } else {
            container.requestFullscreen().catch(() => {})
          }
        }

        return (
          <div id="mapa-fullscreen-container" className="fixed inset-0 z-50 bg-background flex flex-col">
            <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
                <MapPin className="w-6 h-6 text-accent-gold" />
                Mapa de Presença Territorial
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFullscreenToggle}
                  className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
                  title="Tela cheia do navegador"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen()
                    }
                    setMapaTelaCheia(false)
                  }}
                  className="p-2 rounded-lg hover:bg-background transition-colors"
                  title="Fechar mapa"
                >
                  <X className="w-6 h-6 text-secondary" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {cidadesComLiderancas.length > 0 ? (
                <div className="w-full h-full">
                  <div className="w-full h-full bg-surface overflow-hidden">
                    <MapWrapperLeaflet 
                      cidadesComPresenca={cidadesComLiderancas}
                      cidadesVisitadas={cidadesVisitadasLista}
                      municipiosPiaui={municipiosPiaui}
                      eleitoresPorCidade={eleitoresPorCidade}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-secondary">Nenhuma cidade com liderança cadastrada</p>
                </div>
              )}
            </div>
            {/* Legenda fixa no rodapé */}
            <div className="bg-surface border-t border-card p-3 flex flex-wrap items-center justify-center gap-5 text-xs text-secondary">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-blue-700 flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span>Visitada</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-600 border border-blue-700"></div>
                <span>Com liderança</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-600 border border-red-800 opacity-70"></div>
                <span>Sem liderança (+ eleitores)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 border border-red-500 opacity-50"></div>
                <span>Sem liderança</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de Radar de Posicionamento em Tela Cheia */}
      {bandeirasTelaCheia && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
              <Target className="w-6 h-6 text-accent-gold" />
              Radar de Posicionamento
            </h2>
            <button
              onClick={() => setBandeirasTelaCheia(false)}
              className="p-2 rounded-lg hover:bg-background transition-colors"
              title="Fechar tela cheia"
            >
              <X className="w-6 h-6 text-secondary" />
            </button>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto">
              {loadingBandeiras ? (
                <div className="space-y-3">
                  <div className="h-40 bg-background rounded-2xl animate-pulse mb-4" />
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-48 bg-background rounded-xl animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : bandeirasInsights ? (
                <div className="space-y-6">

                  {/* ═══ HERO DO RADAR ═══ */}
                  <div className="bg-surface rounded-2xl border border-card overflow-hidden animate-reveal">
                    <div className="h-1 bg-gradient-to-r from-accent-gold via-amber-400 to-accent-gold" />
                    <div className="p-6 lg:p-8">
                      {/* Headline principal */}
                      <div className="mb-6">
                        <p className="text-xs text-secondary uppercase tracking-wider font-medium mb-1.5">
                          Principal narrativa do mês
                        </p>
                        <p className="text-2xl font-bold text-text-primary flex items-center gap-2.5">
                          <Crown className="w-6 h-6 text-accent-gold animate-breathe flex-shrink-0" />
                          {bandeirasInsights.top.theme}
                        </p>
                        <p className="text-sm text-secondary mt-2.5 leading-relaxed max-w-2xl">
                          {bandeirasInsights.mainSentence}
                        </p>
                      </div>

                      {/* Quick indicators */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-subtle-pulse flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Marca do mandato</p>
                            <p className="text-sm font-semibold text-text-primary truncate">{bandeirasInsights.top.theme}</p>
                          </div>
                        </div>
                        {bandeirasInsights.growing ? (
                          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                            <ArrowUpRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Em crescimento</p>
                              <p className="text-sm font-semibold text-text-primary truncate">{bandeirasInsights.growing.theme}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-500/5 border border-gray-500/10">
                            <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Em crescimento</p>
                              <p className="text-sm text-secondary truncate">Nenhuma pauta destacada</p>
                            </div>
                          </div>
                        )}
                        {bandeirasInsights.weakest ? (
                          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/10">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider">Precisa reforçar</p>
                              <p className="text-sm font-semibold text-text-primary truncate">{bandeirasInsights.weakest.theme}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-500/5 border border-gray-500/10">
                            <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Precisa reforçar</p>
                              <p className="text-sm text-secondary truncate">Todas as pautas ativas</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ═══ KPI CARDS ═══ */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative p-5 rounded-2xl border-2 border-accent-gold/30 bg-gradient-to-br from-amber-50 to-surface">
                      <div className="flex items-center gap-2 mb-2">
                        <Flag className="w-5 h-5 text-accent-gold" />
                        <p className="text-sm font-medium text-secondary">Bandeiras Ativas</p>
                      </div>
                      <p className="text-3xl font-bold text-accent-gold">{bandeirasStats?.totalBandeiras || 0}</p>
                    </div>
                    <div className="relative p-5 rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-50 to-surface">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <p className="text-sm font-medium text-secondary">Total de Menções</p>
                      </div>
                      <p className="text-3xl font-bold text-blue-600">{bandeirasInsights.totalUsage}</p>
                      <p className="text-xs text-secondary mt-1">últimos 30 dias</p>
                    </div>
                    <div className="relative p-5 rounded-2xl border-2 border-rose-500/30 bg-gradient-to-br from-rose-50 to-surface">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="w-5 h-5 text-rose-500" />
                        <p className="text-sm font-medium text-secondary">Curtidas Totais</p>
                      </div>
                      <p className="text-3xl font-bold text-rose-500">
                        {bandeirasInsights.enriched.reduce((s, b) => s + b.totalLikes, 0).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="relative p-5 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-surface">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-5 h-5 text-emerald-600" />
                        <p className="text-sm font-medium text-secondary">Visualizações</p>
                      </div>
                      <p className="text-3xl font-bold text-emerald-600">
                        {bandeirasInsights.enriched.reduce((s, b) => s + b.totalViews, 0).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {/* ═══ CARDS DETALHADOS POR BANDEIRA ═══ */}
                  {bandeirasInsights.enriched.length > 0 && (
                    <div>
                      <p className="text-base font-medium text-secondary mb-3">Desempenho por Bandeira</p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {bandeirasInsights.enriched.map((bandeira) => {
                          const isFirst = bandeira.rank === 1
                          const hasMetrics = bandeira.posts > 0
                          const trendColor = bandeira.trend === 'up' ? 'text-emerald-500' : bandeira.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                          const trendSymbol = bandeira.trend === 'up' ? '↑' : bandeira.trend === 'down' ? '↓' : '→'
                          const trendLabel = bandeira.trend === 'up' ? 'crescendo' : bandeira.trend === 'down' ? 'caindo' : 'estável'
                          const domColor = bandeira.dominanceLevel === 'dominant' ? 'bg-emerald-500' : bandeira.dominanceLevel === 'relevant' ? 'bg-amber-500' : 'bg-red-400'
                          const domBg = bandeira.dominanceLevel === 'dominant' ? 'bg-emerald-500/10' : bandeira.dominanceLevel === 'relevant' ? 'bg-amber-500/10' : 'bg-red-500/10'
                          const domTextColor = bandeira.dominanceLevel === 'dominant' ? 'text-emerald-600' : bandeira.dominanceLevel === 'relevant' ? 'text-amber-600' : 'text-red-500'
                          const domBorder = bandeira.dominanceLevel === 'dominant' ? 'border-emerald-500/30' : bandeira.dominanceLevel === 'relevant' ? 'border-amber-500/30' : 'border-red-500/30'
                          const domLabel = bandeira.dominanceLevel === 'dominant' ? 'Dominante' : bandeira.dominanceLevel === 'relevant' ? 'Relevante' : 'Baixa presença'
                          const engLabel = bandeira.engagementLevel === 'high' ? 'Alto engajamento' : bandeira.engagementLevel === 'medium' ? 'Engajamento médio' : 'Baixo engajamento'
                          const engColor = bandeira.engagementLevel === 'high' ? 'text-emerald-600' : bandeira.engagementLevel === 'medium' ? 'text-amber-600' : 'text-gray-500'
                          const engBg = bandeira.engagementLevel === 'high' ? 'bg-emerald-500/10' : bandeira.engagementLevel === 'medium' ? 'bg-amber-500/10' : 'bg-gray-500/10'

                          return (
                            <div
                              key={bandeira.theme}
                              className={`bg-surface rounded-2xl border overflow-hidden ${isFirst ? 'border-accent-gold/30' : 'border-card'} animate-reveal animate-reveal-${Math.min(bandeira.rank, 6)}`}
                            >
                              {/* Accent bar */}
                              <div className={`h-1 ${isFirst ? 'bg-gradient-to-r from-accent-gold via-amber-400 to-accent-gold' : bandeira.dominanceLevel === 'dominant' ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : bandeira.dominanceLevel === 'relevant' ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-red-300 to-red-400'}`} />

                              <div className="p-5">
                                {/* Header: Rank + Nome + Trend */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${isFirst ? 'bg-accent-gold text-white' : 'bg-background text-secondary border border-card'}`}>
                                      {isFirst ? <Crown className="w-4 h-4" /> : `#${bandeira.rank}`}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-base font-bold text-text-primary truncate">{bandeira.theme}</span>
                                        <span className={`text-xs font-medium flex-shrink-0 ${trendColor}`}>
                                          {trendSymbol} {trendLabel}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-secondary italic truncate mt-0.5">
                                        &ldquo;{bandeira.headline}&rdquo;
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Badges */}
                                <div className="flex items-center gap-2 mt-3 mb-3 flex-wrap">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border ${domBg} ${domTextColor} ${domBorder}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${domColor}`} />
                                    {domLabel}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full ${engBg} ${engColor}`}>
                                    <Zap className="w-3 h-3" />
                                    {engLabel}
                                  </span>
                                </div>

                                {/* Barra de dominância */}
                                <div className="mb-4">
                                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                                    <span className="text-secondary">Participação nas menções</span>
                                    <span className="font-semibold text-text-primary">{bandeira.dominancePercent.toFixed(1)}%</span>
                                  </div>
                                  <div className="h-2 bg-background rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full animate-grow ${domColor}`}
                                      style={{ width: `${Math.max(bandeira.dominancePercent, 2)}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Métricas primárias */}
                                <div className="flex items-center gap-3 flex-wrap text-sm mb-3">
                                  <div className="flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5 text-secondary" />
                                    <span className="font-semibold text-text-primary">{bandeira.usage_count}</span>
                                    <span className="text-xs text-secondary">menções</span>
                                    <span className={`text-xs font-bold ${trendColor}`}>{trendSymbol}</span>
                                  </div>
                                  <span className="text-gray-300">·</span>
                                  <div className="flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-secondary" />
                                    <span className="font-semibold text-text-primary">{bandeira.posts}</span>
                                    <span className="text-xs text-secondary">posts</span>
                                  </div>
                                  {bandeira.boostedCount > 0 && (
                                    <>
                                      <span className="text-gray-300">·</span>
                                      <span className="text-xs text-purple-600 font-medium">{bandeira.boostedCount} impulsionados</span>
                                    </>
                                  )}
                                </div>

                                {/* Métricas de engajamento detalhadas */}
                                {hasMetrics ? (
                                  <div className="grid grid-cols-4 gap-3 pt-3 border-t border-card">
                                    <div className="text-center">
                                      <div className="flex items-center justify-center gap-1 mb-1">
                                        <Eye className="w-3.5 h-3.5 text-secondary" />
                                        <span className="text-[10px] text-secondary uppercase">Views</span>
                                      </div>
                                      <p className="text-sm font-semibold text-text-primary">{bandeira.formattedViews}</p>
                                      <p className="text-[10px] text-secondary">média {bandeira.avgViews.toLocaleString('pt-BR')}/post</p>
                                    </div>
                                    <div className="text-center">
                                      <div className="flex items-center justify-center gap-1 mb-1">
                                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                                        <span className="text-[10px] text-secondary uppercase">Curtidas</span>
                                      </div>
                                      <p className="text-sm font-semibold text-rose-500">{bandeira.formattedLikes}</p>
                                      <p className="text-[10px] text-secondary">média {bandeira.avgLikes.toLocaleString('pt-BR')}/post</p>
                                    </div>
                                    <div className="text-center">
                                      <div className="flex items-center justify-center gap-1 mb-1">
                                        <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="text-[10px] text-secondary uppercase">Engajamento</span>
                                      </div>
                                      <p className="text-sm font-semibold text-blue-500">{bandeira.formattedEngagement}</p>
                                      <p className="text-[10px] text-secondary">média {bandeira.avgEngagement.toLocaleString('pt-BR')}/post</p>
                                    </div>
                                    <div className="text-center">
                                      <div className="flex items-center justify-center gap-1 mb-1">
                                        <Flame className="w-3.5 h-3.5 text-accent-gold" />
                                        <span className="text-[10px] text-secondary uppercase">Frequência</span>
                                      </div>
                                      <p className="text-[11px] font-medium text-secondary italic">{bandeira.frequencyLabel}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="pt-3 border-t border-card">
                                    <div className="flex items-center gap-2">
                                      <Flame className="w-3.5 h-3.5 text-accent-gold" />
                                      <span className="text-xs font-medium text-secondary italic">{bandeira.frequencyLabel}</span>
                                    </div>
                                    <p className="text-xs text-secondary mt-1 opacity-60">Sem dados de desempenho do Instagram</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-secondary text-center">Erro ao carregar dados do radar</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal do Monitor de Imprensa em Tela Cheia */}
      {alertasTelaCheia && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
              <Activity className="w-5 h-5 text-secondary" />
              Monitor de Imprensa
            </h2>
            <button
              onClick={() => setAlertasTelaCheia(false)}
              className="p-2 rounded-lg hover:bg-background transition-colors"
              title="Fechar tela cheia"
            >
              <X className="w-6 h-6 text-secondary" />
            </button>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-4xl mx-auto">
              {/* Headline interpretativa */}
              {monitorInsight && monitorInsight.total > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-surface border border-card animate-reveal">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      monitorInsight.tone === 'positive' ? 'bg-emerald-500' 
                      : monitorInsight.tone === 'negative' ? 'bg-red-500' 
                      : monitorInsight.tone === 'warning' ? 'bg-amber-500' 
                      : 'bg-gray-400'
                    }`} />
                    <p className="text-sm font-medium text-text-primary">{monitorInsight.headline}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-secondary">
                    {monitorInsight.pos > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {monitorInsight.pos} positiva{monitorInsight.pos !== 1 ? 's' : ''}
                      </span>
                    )}
                    {monitorInsight.neg > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {monitorInsight.neg} negativa{monitorInsight.neg !== 1 ? 's' : ''}
                      </span>
                    )}
                    {monitorInsight.neu > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        {monitorInsight.neu} neutra{monitorInsight.neu !== 1 ? 's' : ''}
                      </span>
                    )}
                    {monitorInsight.highRisk > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        {monitorInsight.highRisk} risco alto
                      </span>
                    )}
                  </div>
                </div>
              )}

              {loadingAlerts ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-surface rounded-xl border border-card p-4 animate-pulse">
                      <div className="h-4 bg-background rounded w-3/4 mb-2" />
                      <div className="h-3 bg-background rounded w-1/2 mb-2" />
                      <div className="h-3 bg-background rounded w-1/4" />
                    </div>
                  ))}
                </div>
              ) : monitorNews.length > 0 ? (
                <div className="space-y-3">
                  {monitorNews.map((item) => {
                    const isHighRisk = item.risk_level === 'high'
                    const sentimentDot = item.sentiment === 'positive' ? 'bg-emerald-500'
                      : item.sentiment === 'negative' ? 'bg-red-500'
                      : 'bg-gray-400'
                    const sentimentLabel = item.sentiment === 'positive' ? 'Positivo'
                      : item.sentiment === 'negative' ? 'Negativo'
                      : 'Neutro'
                    const sentimentBadge = item.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : item.sentiment === 'negative' ? 'bg-red-500/10 text-red-600 border-red-500/20'
                      : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                    const riskLabel = item.risk_level === 'high' ? 'Alto'
                      : item.risk_level === 'medium' ? 'Médio'
                      : 'Baixo'
                    const riskBadge = item.risk_level === 'high' ? 'bg-red-500/10 text-red-600'
                      : item.risk_level === 'medium' ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-emerald-500/10 text-emerald-600'
                    const dateStr = item.published_at || item.collected_at
                    const dateFormatted = dateStr
                      ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
                          new Date(typeof dateStr === 'string' ? dateStr : new Date())
                        )
                      : ''

                    return (
                      <a
                        key={item.id}
                        href={item.url || '/dashboard/noticias'}
                        target={item.url ? '_blank' : '_self'}
                        rel="noopener noreferrer"
                        className={`block p-4 rounded-xl border transition-all duration-200 ease-out hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:-translate-y-[1px] fade-in ${
                          isHighRisk
                            ? 'bg-red-500/[0.02] border-red-500/15 hover:border-red-500/25'
                            : 'bg-surface border-card hover:border-card'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sentimentDot}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text-primary leading-snug mb-1.5">
                              {item.title}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-secondary mb-2.5">
                              <span>{item.source}</span>
                              {dateFormatted && (
                                <>
                                  <span className="text-gray-300">·</span>
                                  <span>{dateFormatted}</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${sentimentBadge}`}>
                                {sentimentLabel}
                              </span>
                              {item.risk_level && (
                                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${riskBadge}`}>
                                  Risco {riskLabel}
                                </span>
                              )}
                              {item.theme && (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-accent-gold/10 text-accent-gold">
                                  {item.theme}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </a>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-10 h-10 text-secondary mx-auto mb-3 opacity-40" />
                  <p className="text-secondary text-sm">Nenhuma notícia destacada para o monitor.</p>
                  <p className="text-xs text-secondary mt-1">Use o ícone de radar na página Notícias & Crises para destacar.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Insight em Tela Cheia */}
      {insightTelaCheia && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-accent-gold" />
              Leitura Rápida
            </h2>
            <button
              onClick={() => setInsightTelaCheia(false)}
              className="p-2 rounded-lg hover:bg-background transition-colors"
              title="Fechar tela cheia"
            >
              <X className="w-6 h-6 text-secondary" />
            </button>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-r from-primary-soft to-surface rounded-2xl border border-accent-gold/20 p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-accent-gold-soft flex-shrink-0">
                    <Lightbulb className="w-8 h-8 text-accent-gold" />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg text-secondary leading-relaxed">
                      {(() => {
                        const presencaKpi = kpisComMedia.find(k => k.id === 'presenca')
                        const baseKpi = kpisComMedia.find(k => k.id === 'base')
                        const riscoKpi = kpisComMedia.find(k => k.id === 'risco')
                        
                        const insights: string[] = []
                        
                        if (presencaKpi && presencaKpi.variation && presencaKpi.variation > 0) {
                          insights.push(`Presença territorial cresceu ${presencaKpi.variation}% no último mês`)
                        }
                        
                        if (riscoKpi && riscoKpi.status === 'error') {
                          insights.push(`há risco de saturação em territórios-chave`)
                        }
                        
                        if (baseKpi && baseKpi.value) {
                          insights.push(`Base ativa com ${baseKpi.value} lideranças mapeadas`)
                        }
                        
                        return insights.length > 0 
                          ? insights.join(', ') + '.'
                          : 'Análise estratégica em tempo real dos indicadores de performance.'
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gráfico em Tela Cheia */}
      {graficoPollsTelaCheia && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-text-primary">Histórico de Pesquisas de Intenção de Votos</h2>
              {candidatoPadrao && (
                <span className="text-sm text-secondary">{candidatoPadrao}</span>
              )}
            </div>
            <button
              onClick={() => setGraficoPollsTelaCheia(false)}
              className="p-2 rounded-lg hover:bg-background transition-colors"
              title="Fechar tela cheia"
            >
              <X className="w-6 h-6 text-secondary" />
            </button>
          </div>

          {/* Gráfico em tela cheia */}
          <div className="flex-1 p-6 overflow-auto">
            {loadingPolls ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-full h-full space-y-4">
                  <div className="h-8 bg-surface rounded-lg animate-pulse" />
                  <div className="h-48 bg-surface rounded-lg animate-pulse" />
                </div>
              </div>
            ) : pollsData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-secondary">Nenhuma pesquisa encontrada</p>
              </div>
            ) : (
              <div className="h-full min-h-[600px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={pollsData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <defs>
                      <linearGradient id="colorIntencaoFullscreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgb(var(--accent-gold))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="rgb(var(--accent-gold))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-card))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="rgb(var(--text-muted))" 
                      fontSize={14}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke="rgb(var(--text-muted))" 
                      fontSize={14}
                      domain={[0, 100]}
                      label={{ value: 'Intenção (%)', angle: -90, position: 'insideLeft', style: { fontSize: 14 } }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgb(var(--bg-surface))',
                        border: '1px solid rgb(var(--border-card))',
                        borderRadius: '8px',
                        padding: '12px',
                      }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length > 0) {
                          const data = payload[0].payload as { date: string; intencao: number; instituto?: string; cidade?: string }
                          const intencaoPercent = data.intencao || 0
                          const cidade = data.cidade && data.cidade !== 'Estado' && data.cidade !== 'Cidade não encontrada' ? data.cidade : null
                          
                          // Calcular feedback comparativo
                          let feedbackText = null
                          if (cidade) {
                            const eleitorado = getEleitoradoByCity(cidade)
                            const expectativaVotos = expectativasPorCidade[cidade] || 0
                            
                            if (eleitorado && eleitorado > 0) {
                              const votosProporcionais = Math.round((intencaoPercent / 100) * eleitorado)
                              
                              if (expectativaVotos > 0) {
                                const diferenca = votosProporcionais - expectativaVotos
                                const percentualDiferenca = ((diferenca / expectativaVotos) * 100).toFixed(1)
                                
                                let status = 'neutral'
                                let statusText = 'dentro do padrão'
                                
                                if (Math.abs(parseFloat(percentualDiferenca)) <= 10) {
                                  status = 'success'
                                  statusText = 'dentro do padrão'
                                } else if (diferenca > 0) {
                                  status = 'success'
                                  statusText = `acima do esperado (+${Math.abs(parseFloat(percentualDiferenca))}%)`
                                } else {
                                  status = 'error'
                                  statusText = `abaixo do esperado (${percentualDiferenca}%)`
                                }
                                
                                feedbackText = {
                                  cidade,
                                  eleitorado,
                                  intencaoPercent,
                                  votosProporcionais,
                                  expectativaVotos,
                                  diferenca,
                                  status,
                                  statusText,
                                }
                              } else {
                                feedbackText = {
                                  cidade,
                                  eleitorado,
                                  intencaoPercent,
                                  votosProporcionais,
                                  expectativaVotos: null,
                                  status: 'neutral',
                                  statusText: 'expectativa não disponível',
                                }
                              }
                            }
                          }
                          
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[280px]">
                              <p className="font-semibold text-text-primary mb-2">{label}</p>
                              <p className="text-sm text-text-primary mb-1">
                                <span className="font-medium">Intenção de Voto:</span>{' '}
                                <span className="text-accent-gold">{intencaoPercent}%</span>
                              </p>
                              {data.instituto && data.instituto !== 'Não informado' && (
                                <p className="text-sm text-secondary mb-1">
                                  <span className="font-medium">Instituto:</span> {data.instituto}
                                </p>
                              )}
                              {cidade && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <p className="text-sm font-medium text-text-primary mb-2">Análise Comparativa - {cidade}</p>
                                  {feedbackText ? (
                                    <>
                                      <p className="text-xs text-secondary mb-1">
                                        <span className="font-medium">Eleitorado:</span> {feedbackText.eleitorado.toLocaleString('pt-BR')} eleitores
                                      </p>
                                      <p className="text-xs text-secondary mb-1">
                                        <span className="font-medium">Votos Proporcionais:</span> {feedbackText.votosProporcionais.toLocaleString('pt-BR')} votos ({intencaoPercent}% × {feedbackText.eleitorado.toLocaleString('pt-BR')})
                                      </p>
                                      {feedbackText.expectativaVotos !== null && (
                                        <>
                                          <p className="text-xs text-secondary mb-1">
                                            <span className="font-medium">Expectativa (Território & Base):</span> {feedbackText.expectativaVotos.toLocaleString('pt-BR')} votos
                                          </p>
                                          <p className={`text-xs font-medium mt-2 pt-2 border-t border-gray-100 ${
                                            feedbackText.status === 'success' ? 'text-green-600' :
                                            feedbackText.status === 'error' ? 'text-red-600' :
                                            'text-gray-600'
                                          }`}>
                                            Status: {feedbackText.statusText}
                                          </p>
                                        </>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-xs text-secondary">Dados de eleitorado não disponíveis para esta cidade</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="intencao"
                      stroke="rgb(var(--accent-gold))"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorIntencaoFullscreen)"
                      name="Intenção de Voto"
                      dot={(props: any) => {
                        const { cx, cy, payload } = props
                        if (!payload) return <circle cx={cx} cy={cy} r={5} fill="rgb(var(--accent-gold))" />
                        
                        const instituto = payload.instituto || ''
                        const cidade = payload.cidade || ''
                        const value = payload.intencao || 0
                        
                        const infoParts = []
                        if (instituto && instituto !== 'Não informado') {
                          infoParts.push(instituto)
                        }
                        if (cidade && cidade !== 'Estado' && cidade !== 'Cidade não encontrada') {
                          infoParts.push(cidade)
                        }
                        const infoText = infoParts.length > 0 ? infoParts.join(' - ') : ''
                        
                        return (
                          <g>
                            <circle cx={cx} cy={cy} r={5} fill="rgb(var(--accent-gold))" />
                            <text
                              x={cx}
                              y={cy - 25}
                              fill="rgb(var(--accent-gold))"
                              fontSize="14"
                              fontWeight="600"
                              textAnchor="middle"
                            >
                              {`${value}%`}
                            </text>
                            {infoText && (
                              <text
                                x={cx}
                                y={cy - 10}
                                fill="rgb(var(--text-muted))"
                                fontSize="11"
                                fontWeight="400"
                                textAnchor="middle"
                              >
                                {infoText}
                              </text>
                            )}
                          </g>
                        )
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agente de IA - montado com delay para não bloquear navegação */}
      {agenteMontado && (
        <AIAgent
          loadingKPIs={loading}
          loadingPolls={loadingPolls}
          loadingTerritorios={loadingTerritorios}
          loadingAlerts={loadingAlerts}
          loadingBandeiras={loadingBandeiras}
          kpisCount={kpis.length}
          expectativa2026={kpis.find(k => k.id === 'ife')?.value}
          presencaTerritorial={kpis.find(k => k.id === 'presenca')?.value?.toString()}
          pollsCount={pollsData.length}
          candidatoPadrao={candidatoPadrao}
          territoriosFriosCount={territoriosFrios.length}
          alertsCriticosCount={monitorNews.filter(n => n.risk_level === 'high' || n.sentiment === 'negative').length}
          bandeirasCount={bandeirasStats?.totalBandeiras || 0}
          bandeirasPerformance={bandeirasStats?.totalPerformance || 0}
          criticalAlerts={monitorNews.filter(n => n.risk_level === 'high' || n.sentiment === 'negative').map(n => ({ id: n.id, title: n.title, actionUrl: n.url || '/dashboard/noticias' }))}
          territoriosFrios={territoriosFrios}
        />
      )}
    </div>
  )
}

