'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { KPIHeroCard } from '@/components/kpi-hero-card'
import { AlertCard } from '@/components/alert-card'
import { ActionCard } from '@/components/action-card'
import { AIAgent } from '@/components/ai-agent'
import { MapaPresenca } from '@/components/mapa-presenca'
import dynamic from 'next/dynamic'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { mockKPIs, mockAlerts, mockActions } from '@/lib/mock-data'

// Dynamic import do wrapper Leaflet (client-only)
const MapWrapperLeaflet = dynamic(
  () => import('@/components/mapa-wrapper-leaflet').then(mod => mod.MapWrapperLeaflet),
  { ssr: false }
)
import { KPI, Alert, NewsItem } from '@/types'
import { TrendingUp, MapPin, Flag, MessageSquare, ThermometerSun, ThermometerSnowflake, Flame, Activity, Maximize2, X, Lightbulb } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getEleitoradoByCity } from '@/lib/eleitores'

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
  const [territorioStats, setTerritorioStats] = useState<{
    totalCidades: number
    cidadesVisitadas: number
    cidadesNaoVisitadas: number
    totalVisitas: number
    totalExpectativa: number
    percentualCobertura: number
  } | null>(null)
  const [loadingTerritorios, setLoadingTerritorios] = useState(true)
  const [criticalAlerts, setCriticalAlerts] = useState<Alert[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)
  const [bandeirasStats, setBandeirasStats] = useState<{
    totalUsos: number
    totalPerformance: number
    totalBandeiras: number
    topBandeiras: Array<{ theme: string; usage_count: number; performance_score: number }>
  } | null>(null)
  const [loadingBandeiras, setLoadingBandeiras] = useState(true)
  const [projecaoChapa, setProjecaoChapa] = useState<number>(0)
  const [graficoPollsTelaCheia, setGraficoPollsTelaCheia] = useState(false)
  const [analiseTerritoriosTelaCheia, setAnaliseTerritoriosTelaCheia] = useState(false)
  const [showMapaPresenca, setShowMapaPresenca] = useState(true)
  const [mapaTelaCheia, setMapaTelaCheia] = useState(false)
  const [bandeirasTelaCheia, setBandeirasTelaCheia] = useState(false)
  const [alertasTelaCheia, setAlertasTelaCheia] = useState(false)
  const [insightTelaCheia, setInsightTelaCheia] = useState(false)
  const [expectativasPorCidade, setExpectativasPorCidade] = useState<Record<string, number>>({})

  // Calcular média das pesquisas diretamente a partir dos dados do gráfico
  const mediaPesquisas = pollsData.length > 0
    ? Math.round((pollsData.reduce((sum, poll) => sum + (poll.intencao || 0), 0) / pollsData.length) * 10) / 10
    : null

  const fetchCriticalAlerts = async () => {
    setLoadingAlerts(true)
    try {
      const response = await fetch('/api/noticias?sentiment=negative&risk_level=high&limit=5')
      if (response.ok) {
        const news: NewsItem[] = await response.json()
        // Converter notícias para o formato de Alert
        const alerts: Alert[] = news.map((item) => {
          const dateStr = item.published_at || item.collected_at
          const timestamp = dateStr 
            ? new Date(typeof dateStr === 'string' ? dateStr : dateStr.toString())
            : new Date()
          
          return {
            id: item.id,
            type: 'critical' as const,
            title: item.title.length > 60 ? `${item.title.substring(0, 60)}...` : item.title,
            description: item.theme 
              ? `Notícia sobre ${item.theme} em portal local`
              : `Notícia crítica em portal local`,
            timestamp,
            actionUrl: item.url || `/dashboard/noticias`,
          }
        })
        setCriticalAlerts(alerts)
      } else {
        // Se não houver notícias críticas, deixar vazio
        setCriticalAlerts([])
      }
    } catch (error) {
      // Em caso de erro, deixar vazio ao invés de usar mock
      setCriticalAlerts([])
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
    
    // Buscar alertas críticos (notícias negativas com risco alto)
    fetchCriticalAlerts()
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
    } else {
      setPollsData([])
      setLoadingPolls(false)
    }
  }, [candidatoPadrao])

  // Buscar Análise de Territórios
  useEffect(() => {
    const fetchTerritorios = async () => {
      setLoadingTerritorios(true)
      try {
        let config = null
        
        // 1. Primeiro verificar configuração do servidor
        try {
          const serverConfigRes = await fetch('/api/territorio/config')
          const serverConfig = await serverConfigRes.json()
          if (serverConfig.configured) {
            config = {} // Servidor usa variáveis de ambiente
          }
        } catch (e) {
          // Continuar para localStorage
        }
        
        // 2. Fallback: localStorage
        if (!config && typeof window !== 'undefined') {
          const savedConfig = localStorage.getItem('territorio_sheets_config')
          if (savedConfig) {
            config = JSON.parse(savedConfig)
          }
        }
        
        if (config) {
          const response = await fetch('/api/dashboard/territorios-frios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              territorioConfig: config.spreadsheetId ? config : {} 
            }),
          })
          
          if (response.ok) {
            const data = await response.json()
            
            // Territórios frios
            setTerritoriosFrios(
              data.territoriosFrios?.map((t: any) => ({
                cidade: t.cidade,
                motivo: t.motivo,
                expectativaVotos: t.expectativaVotos,
                visitas: t.visitas,
              })) || []
            )
            
            // Territórios quentes
            setTerritoriosQuentes(
              data.territoriosQuentes?.map((t: any) => ({
                cidade: t.cidade,
                motivo: t.motivo,
                expectativaVotos: t.expectativaVotos,
                visitas: t.visitas,
              })) || []
            )
            
            // Territórios mornos
            setTerritoriosMornos(
              data.territoriosMornos?.map((t: any) => ({
                cidade: t.cidade,
                motivo: t.motivo,
                expectativaVotos: t.expectativaVotos,
                visitas: t.visitas,
              })) || []
            )
            
            // Estatísticas
            if (data.estatisticas) {
              setTerritorioStats(data.estatisticas)
            }
          }
        }
      } catch (error) {
        // Erro silencioso
      } finally {
        setLoadingTerritorios(false)
      }
    }

    fetchTerritorios()
  }, [])

  // Buscar estatísticas das bandeiras
  useEffect(() => {
    const fetchBandeirasStats = async () => {
      setLoadingBandeiras(true)
      try {
        // Buscar todas as narrativas ativas
        const response = await fetch('/api/narrativas?status=ativa')
        if (response.ok) {
          const narrativas = await response.json()
          
          // Buscar estatísticas para cada narrativa
          const statsPromises = narrativas.map(async (narrativa: any) => {
            try {
              const statsResponse = await fetch(`/api/narrativas/stats?theme=${encodeURIComponent(narrativa.theme)}`)
              if (statsResponse.ok) {
                const stats = await statsResponse.json()
                return {
                  theme: narrativa.theme,
                  usage_count: stats.usage_count || 0,
                  performance_score: stats.performance_score || 0,
                }
              }
            } catch (error) {
              console.error(`Erro ao buscar stats para ${narrativa.theme}:`, error)
            }
            return {
              theme: narrativa.theme,
              usage_count: 0,
              performance_score: 0,
            }
          })

          const allStats = await Promise.all(statsPromises)
          
          // Calcular totais
          const totalUsos = allStats.reduce((sum, stat) => sum + stat.usage_count, 0)
          const totalPerformance = allStats.length > 0
            ? Math.round(allStats.reduce((sum, stat) => sum + stat.performance_score, 0) / allStats.length)
            : 0
          
          // Top 3 bandeiras por uso
          const topBandeiras = allStats
            .sort((a, b) => b.usage_count - a.usage_count)
            .slice(0, 3)

          setBandeirasStats({
            totalUsos,
            totalPerformance,
            totalBandeiras: narrativas.length,
            topBandeiras,
          })
        }
      } catch (error) {
        console.error('Erro ao buscar estatísticas das bandeiras:', error)
      } finally {
        setLoadingBandeiras(false)
      }
    }

    fetchBandeirasStats()
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

    // Buscar projeção de chapas (eleitos do Republicanos)
    const fetchProjecaoChapa = async () => {
      try {
        const response = await fetch('/api/chapas/projecao-republicanos')
        if (response.ok) {
          const data = await response.json()
          return data.eleitos || 0
        }
      } catch (error) {
        // Erro silencioso
      }
      return 0
    }

    // Buscar KPIs da API
    Promise.all([
      fetch('/api/dashboard/kpis').then((res) => res.json()),
      fetchTerritorioKPIs(),
      fetchProjecaoChapa(),
    ]).then(([data, territorioKPIs, projecaoEleitos]) => {
      setProjecaoChapa(projecaoEleitos)
      if (data.ife) {
        // Se temos KPIs do território, usar os valores calculados (mesmos da página Território & Base)
        const expectativa2026 = territorioKPIs?.expectativa2026 ?? null
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
              label: 'Base Ativa no Território',
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
              label: 'Projeção Chapa Federal',
              value: projecaoEleitos,
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
              value: data.risco.value,
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
      <Header title="" subtitle="Visão estratégica Dep Federal Jadyel Alencar eleições 2026" showFilters={false} />

      <div className="px-4 py-6 lg:px-6">
        {/* KPI Hero - Expectativa 2026 */}
        <section className="mb-6">
          {loading ? (
            <div className="h-40 bg-surface rounded-2xl border border-card animate-pulse" />
          ) : (
            (() => {
              const heroKpi = kpisComMedia.find(k => k.id === 'ife')
              if (!heroKpi) return null
              
              const variationText = heroKpi.variation !== undefined && heroKpi.variation !== 0
                ? `${heroKpi.variation > 0 ? '+' : ''}${heroKpi.variation}% vs última medição`
                : undefined
              
              return (
                <KPIHeroCard 
                  kpi={heroKpi} 
                  subtitle={variationText}
                  href="/ife"
                />
              )
            })()
          )}
        </section>

        {/* KPIs Secundários */}
        <section className="mb-8">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-28 bg-surface rounded-2xl border border-card animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {kpisComMedia.filter(kpi => kpi.id !== 'ife').map((kpi) => (
                <KPICard key={kpi.id} kpi={kpi} href={`/${kpi.id}`} />
              ))}
            </div>
          )}
        </section>

        {/* Bloco de Leitura Rápida / Insight */}
        {!loading && (
          <section className="mb-8">
            <div className="bg-gradient-to-r from-primary-soft to-surface rounded-2xl border border-accent-gold/20 p-5 relative">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-accent-gold-soft flex-shrink-0">
                  <Lightbulb className="w-5 h-5 text-accent-gold" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                      💡 Leitura Rápida
                    </h3>
                    <button
                      onClick={() => setInsightTelaCheia(true)}
                      className="p-1.5 rounded-lg hover:bg-background/50 transition-colors text-secondary hover:text-primary"
                      title="Visualizar em tela cheia"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-secondary leading-relaxed">
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
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Linha 2 - Leitura Estratégica */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gráfico de Histórico de Pesquisas */}
            <div className="bg-surface rounded-2xl border border-card p-6 relative overflow-hidden">
              {/* Linha vertical de destaque */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-gold opacity-20" />
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-primary">Histórico de Pesquisas de Intenção de Votos</h2>
                  {candidatoPadrao && (
                    <span className="text-sm text-secondary bg-accent-gold-soft px-2 py-0.5 rounded-full border border-accent-gold/20">
                      {candidatoPadrao}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {pollsData.length > 0 && (
                    <>
                      <span className="text-xs text-secondary bg-surface px-2 py-1 rounded border border-card">
                        Fonte própria
                      </span>
                      <button
                        onClick={() => setGraficoPollsTelaCheia(true)}
                        className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-primary"
                        title="Visualizar em tela cheia"
                      >
                        <Maximize2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="h-64">
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
                          <stop offset="5%" stopColor="#C6A15B" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#C6A15B" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" strokeWidth={1} opacity={0.5} />
                      <XAxis dataKey="date" stroke="#64748B" fontSize={12} />
                      <YAxis 
                        stroke="#64748B" 
                        fontSize={12}
                        domain={[0, 100]}
                        label={{ value: 'Intenção (%)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E5E7EB',
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
                                <p className="font-semibold text-primary mb-2">{label}</p>
                                <p className="text-sm text-primary mb-1">
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
                                    <p className="text-sm font-medium text-primary mb-2">Análise Comparativa - {cidade}</p>
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
                        stroke="#C6A15B"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorIntencao)"
                        name="Intenção de Voto"
                        dot={(props: any) => {
                          const { cx, cy, payload } = props
                          if (!payload) return <circle cx={cx} cy={cy} r={4} fill="#C6A15B" />
                          
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
                              <circle cx={cx} cy={cy} r={4} fill="#C6A15B" />
                              <text
                                x={cx}
                                y={cy - 20}
                                fill="#C6A15B"
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
                                  fill="#64748B"
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

            {/* Análise de Territórios */}
            <div className="bg-surface rounded-2xl border border-card p-6 relative overflow-hidden">
              {/* Linha vertical de destaque */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-gold opacity-20" />
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <Activity className="w-5 h-5 text-accent-gold" />
                    Análise de Territórios
                  </h2>
                  <span className="text-xs text-secondary bg-surface px-2 py-1 rounded border border-card">
                    Fonte própria
                  </span>
                </div>
                <button
                  onClick={() => setAnaliseTerritoriosTelaCheia(true)}
                  className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-primary"
                  title="Visualizar em tela cheia"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>

              {loadingTerritorios ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-background rounded-xl animate-pulse" />
                    ))}
                  </div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-3 rounded-xl border border-card bg-surface animate-pulse">
                      <div className="h-4 bg-background rounded w-1/3 mb-2" />
                      <div className="h-3 bg-background rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Estatísticas Gerais - Calculadas a partir do KPI Base Ativa no Território */}
                  {(() => {
                    // Pegar o KPI de presença (Base Ativa no Território) que mostra "X/224"
                    const presencaKpi = kpisComMedia.find(k => k.id === 'presenca')
                    let cidadesAtivas = 0
                    let totalCidades = 224
                    
                    if (presencaKpi && typeof presencaKpi.value === 'string' && presencaKpi.value.includes('/')) {
                      const [cidades, total] = presencaKpi.value.split('/').map(v => parseInt(v.trim()) || 0)
                      cidadesAtivas = cidades
                      totalCidades = total || 224
                    }
                    
                    // Usar dados da API para visitas
                    const cidadesVisitadas = territorioStats?.cidadesVisitadas || 0
                    const totalVisitas = territorioStats?.totalVisitas || 0
                    
                    // Calcular cobertura corretamente: (Cidades Visitadas / Cidades com Presença) * 100
                    // Isso mostra quantas das cidades onde temos presença foram visitadas
                    const percentualCobertura = cidadesAtivas > 0 
                      ? Math.round((cidadesVisitadas / cidadesAtivas) * 100) 
                      : 0
                    
                    return (
                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <div className="relative p-5 rounded-2xl border-2 border-accent-gold/30 bg-gradient-to-br from-primary-soft to-surface hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-accent-gold before:rounded-l-2xl">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-accent-gold" />
                            <p className="text-xs font-medium text-secondary">Cidades com Presença</p>
                          </div>
                          <p className="text-3xl font-bold text-primary group-hover:text-accent-gold transition-colors">{cidadesAtivas}</p>
                          <p className="text-xs text-secondary mt-1">de {totalCidades} municípios</p>
                        </div>
                        <div className="relative p-5 rounded-2xl border border-card bg-surface hover:shadow-lg hover:-translate-y-0.5 hover:border-accent-gold/30 transition-all duration-300 cursor-pointer group overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-blue-500 before:opacity-0 group-hover:opacity-100 before:rounded-l-2xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Activity className="w-4 h-4 text-blue-600" />
                            <p className="text-xs font-medium text-secondary">Cidades Visitadas</p>
                          </div>
                          <p className="text-3xl font-bold text-blue-600 group-hover:scale-105 transition-transform">{cidadesVisitadas}</p>
                          <p className="text-xs text-secondary mt-1">de {cidadesAtivas} com presença</p>
                        </div>
                        <div className="relative p-5 rounded-2xl border border-card bg-surface hover:shadow-lg hover:-translate-y-0.5 hover:border-emerald-500/30 transition-all duration-300 cursor-pointer group overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-emerald-500 before:opacity-0 group-hover:opacity-100 before:rounded-l-2xl">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            <p className="text-xs font-medium text-secondary">Cobertura</p>
                          </div>
                          <p className="text-3xl font-bold text-emerald-600 group-hover:scale-105 transition-transform">{percentualCobertura}%</p>
                          <p className="text-xs text-secondary mt-1">das cidades com presença</p>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Mapa de Presença Interativo - Oculto quando modal está aberto */}
                  {showMapaPresenca && !analiseTerritoriosTelaCheia && !mapaTelaCheia && (() => {
                    const presencaKpi = kpisComMedia.find(k => k.id === 'presenca')
                    let cidadesAtivas = 0
                    let totalCidades = 224
                    
                    if (presencaKpi && typeof presencaKpi.value === 'string' && presencaKpi.value.includes('/')) {
                      const [cidades, total] = presencaKpi.value.split('/').map(v => parseInt(v.trim()) || 0)
                      cidadesAtivas = cidades
                      totalCidades = total || 224
                    }

                    const cidadesComPresencaList = (() => {
                      // Se há cidades com presença ativa, usar essas
                      // Caso contrário, mostrar lista vazia (sem presença detectada)
                      const cidades = new Set<string>()
                      
                      // Cidades de territórios quentes
                      territoriosQuentes.forEach(t => cidades.add(t.cidade))
                      // Cidades de territórios mornos
                      territoriosMornos.forEach(t => cidades.add(t.cidade))
                      // Cidades de territórios ativos
                      if (territorioStats?.cidadesVisitadas) {
                        // Quando temos dados de cidadesVisitadas, significa que temos presença nessas cidades
                      }
                      
                      return Array.from(cidades)
                    })()

                    return cidadesAtivas > 0 ? (
                      <div className="mb-6">
                        <MapaPresenca
                          cidadesComPresenca={cidadesComPresencaList.length > 0 ? cidadesComPresencaList : Array.from({length: cidadesAtivas}, (_, i) => `Cidade ${i+1}`)}
                          totalCidades={totalCidades}
                          onFullscreen={() => setMapaTelaCheia(true)}
                        />
                      </div>
                    ) : null
                  })()}

                  {/* Tabs de Territórios */}
                  <div className="space-y-4">
                    {/* Territórios Quentes */}
                    {territoriosQuentes.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Flame className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-semibold text-emerald-600">Territórios Quentes</span>
                          <span className="text-[10px] text-secondary">({territoriosQuentes.length})</span>
                        </div>
                        <div className="space-y-2">
                          {territoriosQuentes.slice(0, 3).map((territorio) => (
                            <div
                              key={territorio.cidade}
                              className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                                  {territorio.visitas}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-primary">{territorio.cidade}</p>
                                  <p className="text-[10px] text-secondary">{territorio.motivo}</p>
                                </div>
                              </div>
                              {territorio.expectativaVotos && territorio.expectativaVotos > 0 && (
                                <span className="text-xs font-semibold text-emerald-600">
                                  {territorio.expectativaVotos.toLocaleString('pt-BR')} votos
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Territórios Mornos */}
                    {territoriosMornos.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <ThermometerSun className="w-4 h-4 text-amber-500" />
                          <span className="text-xs font-semibold text-amber-600">Territórios Mornos</span>
                          <span className="text-[10px] text-secondary">({territoriosMornos.length})</span>
                        </div>
                        <div className="space-y-2">
                          {territoriosMornos.slice(0, 3).map((territorio) => (
                            <div
                              key={territorio.cidade}
                              className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-amber-400 text-white flex items-center justify-center text-xs font-bold">
                                  {territorio.visitas || 0}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-primary">{territorio.cidade}</p>
                                  <p className="text-[10px] text-secondary">{territorio.motivo}</p>
                                </div>
                              </div>
                              {territorio.expectativaVotos && territorio.expectativaVotos > 0 && (
                                <span className="text-xs font-semibold text-amber-600">
                                  {territorio.expectativaVotos.toLocaleString('pt-BR')} votos
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Territórios Frios */}
                    {territoriosFrios.length > 0 ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <ThermometerSnowflake className="w-4 h-4 text-red-500" />
                          <span className="text-xs font-semibold text-red-600">Territórios Frios (Alerta)</span>
                          <span className="text-[10px] text-secondary">({territoriosFrios.length})</span>
                        </div>
                        <div className="space-y-2">
                          {territoriosFrios.slice(0, 4).map((territorio) => (
                            <div
                              key={territorio.cidade}
                              className="p-2.5 rounded-lg border border-red-200 bg-red-50/50 hover:bg-red-50 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
                                  {territorio.visitas || 0}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-primary">{territorio.cidade}</p>
                                  <p className="text-[10px] text-secondary">{territorio.motivo}</p>
                                </div>
                              </div>
                              {territorio.expectativaVotos && territorio.expectativaVotos > 0 && (
                                <span className="text-xs font-semibold text-red-600">
                                  {territorio.expectativaVotos.toLocaleString('pt-BR')} votos
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium">
                          <Flame className="w-3.5 h-3.5" />
                          Excelente! Nenhum território em estado crítico
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

          </div>

          {/* Coluna Direita - Ações e Alertas */}
          <div className="space-y-6">
            {/* Alertas Críticos */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-error" />
                  Alertas Críticos
                </h2>
                <button
                  onClick={() => setAlertasTelaCheia(true)}
                  className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-primary"
                  title="Visualizar em tela cheia"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                {loadingAlerts ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-surface rounded-xl border border-card p-4 animate-pulse">
                        <div className="h-4 bg-background rounded w-3/4 mb-2" />
                        <div className="h-3 bg-background rounded w-1/2 mb-2" />
                        <div className="h-3 bg-background rounded w-1/4" />
                      </div>
                    ))}
                  </>
                ) : criticalAlerts.length > 0 ? (
                  criticalAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-secondary">Nenhum alerta crítico no momento</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bandeiras de Campanha - Usos e Performance */}
            <div className="bg-surface rounded-2xl border border-card p-6 relative overflow-hidden">
              {/* Linha vertical de destaque */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-gold opacity-20" />
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <Flag className="w-5 h-5 text-accent-gold" />
                    Bandeiras de Campanha
                  </h2>
                  <span className="text-xs text-secondary bg-surface px-2 py-1 rounded border border-card">
                    Fonte própria
                  </span>
                </div>
                <button
                  onClick={() => setBandeirasTelaCheia(true)}
                  className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-primary"
                  title="Visualizar em tela cheia"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>
              {loadingBandeiras ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 bg-background rounded-xl animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : bandeirasStats ? (
                <div className="space-y-4">
                  {/* KPIs principais */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative p-5 rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-50 to-surface hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-blue-500 before:rounded-l-2xl">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <p className="text-xs font-medium text-secondary">Total de Usos</p>
                      </div>
                      <p className="text-3xl font-bold text-blue-600 group-hover:scale-105 transition-transform">{bandeirasStats.totalUsos}</p>
                      <p className="text-xs text-secondary mt-1">notícias/postagens</p>
                    </div>
                    <div className="relative p-5 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-surface hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-emerald-500 before:rounded-l-2xl">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <p className="text-xs font-medium text-secondary">Performance Média</p>
                      </div>
                      <p className="text-3xl font-bold text-emerald-600 group-hover:scale-105 transition-transform">{bandeirasStats.totalPerformance}%</p>
                      <p className="text-xs text-secondary mt-1">engajamento médio</p>
                    </div>
                  </div>

                  {/* Top 3 Bandeiras */}
                  {bandeirasStats.topBandeiras.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-secondary mb-2">Top 3 Bandeiras por Uso</p>
                      <div className="space-y-2">
                        {bandeirasStats.topBandeiras.map((bandeira, index) => (
                          <div
                            key={bandeira.theme}
                            className="flex items-center justify-between p-2 bg-background rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-accent-gold-soft text-accent-gold flex items-center justify-center text-xs font-semibold">
                                {index + 1}
                              </div>
                              <span className="text-sm text-primary">{bandeira.theme}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-secondary">{bandeira.usage_count} usos</span>
                              <span className="text-secondary">{bandeira.performance_score}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {bandeirasStats.totalBandeiras === 0 && (
                    <p className="text-sm text-secondary text-center py-2">
                      Nenhuma bandeira ativa cadastrada
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-surface rounded-xl border border-card p-4">
                  <p className="text-sm text-secondary text-center">
                    Erro ao carregar estatísticas das bandeiras
                  </p>
                </div>
              )}
            </div>

            {/* Pendências Jurídicas */}
            <div>
              <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-status-warning" />
                Pendências Jurídicas
              </h2>
              <div className="space-y-3">
                {mockAlerts.filter((a) => a.type === 'warning').map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </div>

            {/* Ações Recomendadas */}
            <div className="bg-beige rounded-2xl border border-beige-dark p-6">
              <h2 className="text-lg font-semibold text-primary mb-4">
                Ações Recomendadas Automáticas
              </h2>
              <div className="space-y-3">
                {mockActions.map((action) => (
                  <ActionCard key={action.id} action={action} />
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Modal de Análise de Territórios em Tela Cheia */}
      {analiseTerritoriosTelaCheia && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
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
                          <p className="text-4xl font-bold text-primary">{cidadesAtivas}</p>
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
                    const presencaKpi = kpisComMedia.find(k => k.id === 'presenca')
                    let cidadesAtivas = 0
                    let totalCidades = 224
                    
                    if (presencaKpi && typeof presencaKpi.value === 'string' && presencaKpi.value.includes('/')) {
                      const [cidades, total] = presencaKpi.value.split('/').map(v => parseInt(v.trim()) || 0)
                      cidadesAtivas = cidades
                      totalCidades = total || 224
                    }

                    const cidadesComPresencaList = (() => {
                      const cidades = new Set<string>()
                      territoriosQuentes.forEach(t => cidades.add(t.cidade))
                      territoriosMornos.forEach(t => cidades.add(t.cidade))
                      return Array.from(cidades)
                    })()

                    return cidadesAtivas > 0 ? (
                      <div className="mb-8">
                        <MapaPresenca
                          cidadesComPresenca={cidadesComPresencaList.length > 0 ? cidadesComPresencaList : Array.from({length: cidadesAtivas}, (_, i) => `Cidade ${i+1}`)}
                          totalCidades={totalCidades}
                          fullscreen={true}
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
                                  <p className="text-base font-medium text-primary">{territorio.cidade}</p>
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
                                  <p className="text-base font-medium text-primary">{territorio.cidade}</p>
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
                                  <p className="text-base font-medium text-primary">{territorio.cidade}</p>
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
        const presencaKpi = kpisComMedia.find(k => k.id === 'presenca')
        let cidadesAtivas = 0
        let totalCidades = 224
        
        if (presencaKpi && typeof presencaKpi.value === 'string' && presencaKpi.value.includes('/')) {
          const [cidades, total] = presencaKpi.value.split('/').map(v => parseInt(v.trim()) || 0)
          cidadesAtivas = cidades
          totalCidades = total || 224
        }

        const cidadesComPresencaList = (() => {
          const cidades = new Set<string>()
          territoriosQuentes.forEach(t => cidades.add(t.cidade))
          territoriosMornos.forEach(t => cidades.add(t.cidade))
          return Array.from(cidades)
        })()

        return (
          <div className="fixed inset-0 z-50 bg-background flex flex-col">
            <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
                <MapPin className="w-6 h-6 text-accent-gold" />
                Mapa de Presença Territorial
              </h2>
              <button
                onClick={() => setMapaTelaCheia(false)}
                className="p-2 rounded-lg hover:bg-background transition-colors"
                title="Fechar mapa"
              >
                <X className="w-6 h-6 text-secondary" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {cidadesAtivas > 0 ? (
                <div className="w-full h-full">
                  <div className="w-full h-full bg-surface overflow-hidden">
                    <MapWrapperLeaflet 
                      cidadesComPresenca={cidadesComPresencaList.length > 0 ? cidadesComPresencaList : Array.from({length: cidadesAtivas}, (_, i) => `Cidade ${i+1}`)}
                      municipiosPiaui={municipiosPiaui}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-secondary">Nenhuma cidade com presença ativa</p>
                </div>
              )}
            </div>
            {/* Legenda fixa no rodapé */}
            <div className="bg-surface border-t border-card p-3 flex items-center justify-center gap-6 text-xs text-secondary">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-accent-gold border border-accent-gold"></div>
                <span>Presença Ativa</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#E5DED4] border border-[#D4D0C8]"></div>
                <span>Sem Ação</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal de Bandeiras em Tela Cheia */}
      {bandeirasTelaCheia && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
              <Flag className="w-6 h-6 text-accent-gold" />
              Bandeiras de Campanha
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
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-32 bg-background rounded-xl animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : bandeirasStats ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative p-6 rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-50 to-surface">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <p className="text-sm font-medium text-secondary">Total de Usos</p>
                      </div>
                      <p className="text-4xl font-bold text-blue-600">{bandeirasStats.totalUsos}</p>
                      <p className="text-sm text-secondary mt-1">notícias/postagens</p>
                    </div>
                    <div className="relative p-6 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-surface">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-5 h-5 text-emerald-600" />
                        <p className="text-sm font-medium text-secondary">Performance Média</p>
                      </div>
                      <p className="text-4xl font-bold text-emerald-600">{bandeirasStats.totalPerformance}%</p>
                      <p className="text-sm text-secondary mt-1">engajamento médio</p>
                    </div>
                  </div>
                  
                  {bandeirasStats.topBandeiras.length > 0 && (
                    <div>
                      <p className="text-base font-medium text-secondary mb-3">Top Bandeiras por Uso</p>
                      <div className="space-y-2">
                        {bandeirasStats.topBandeiras.map((bandeira, index) => (
                          <div
                            key={bandeira.theme}
                            className="flex items-center justify-between p-3 bg-surface rounded-lg border border-card"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-accent-gold-soft text-accent-gold flex items-center justify-center text-sm font-semibold">
                                {index + 1}
                              </div>
                              <span className="text-base text-primary">{bandeira.theme}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-secondary">{bandeira.usage_count} usos</span>
                              <span className="text-secondary">{bandeira.performance_score}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-secondary text-center">Erro ao carregar estatísticas das bandeiras</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alertas em Tela Cheia */}
      {alertasTelaCheia && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-status-error" />
              Alertas Críticos
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
            <div className="max-w-5xl mx-auto">
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
              ) : criticalAlerts.length > 0 ? (
                <div className="space-y-3">
                  {criticalAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-secondary">Nenhum alerta crítico no momento</p>
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
            <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
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
              <h2 className="text-xl font-semibold text-primary">Histórico de Pesquisas de Intenção de Votos</h2>
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
                        <stop offset="5%" stopColor="#C6A15B" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#C6A15B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#64748B" 
                      fontSize={14}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke="#64748B" 
                      fontSize={14}
                      domain={[0, 100]}
                      label={{ value: 'Intenção (%)', angle: -90, position: 'insideLeft', style: { fontSize: 14 } }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E7EB',
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
                              <p className="font-semibold text-primary mb-2">{label}</p>
                              <p className="text-sm text-primary mb-1">
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
                                  <p className="text-sm font-medium text-primary mb-2">Análise Comparativa - {cidade}</p>
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
                      stroke="#C6A15B"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorIntencaoFullscreen)"
                      name="Intenção de Voto"
                      dot={(props: any) => {
                        const { cx, cy, payload } = props
                        if (!payload) return <circle cx={cx} cy={cy} r={5} fill="#C6A15B" />
                        
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
                            <circle cx={cx} cy={cy} r={5} fill="#C6A15B" />
                            <text
                              x={cx}
                              y={cy - 25}
                              fill="#C6A15B"
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
                                fill="#64748B"
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

      {/* Agente de IA */}
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
        alertsCriticosCount={criticalAlerts.length}
        bandeirasCount={bandeirasStats?.totalBandeiras || 0}
        bandeirasPerformance={bandeirasStats?.totalPerformance || 0}
        criticalAlerts={criticalAlerts.map(a => ({ id: a.id, title: a.title, actionUrl: a.actionUrl }))}
        territoriosFrios={territoriosFrios}
      />
    </div>
  )
}

