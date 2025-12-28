'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { AlertCard } from '@/components/alert-card'
import { ActionCard } from '@/components/action-card'
import { AIAgent } from '@/components/ai-agent'
import { mockKPIs, mockAlerts, mockActions } from '@/lib/mock-data'
import { KPI, Alert, NewsItem } from '@/types'
import { TrendingUp, MapPin, Flag, MessageSquare, ThermometerSun, ThermometerSnowflake, Flame, Activity, Newspaper, ExternalLink } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const trendData = [
  { date: '01/10', ife: 65, sentimento: 60 },
  { date: '08/10', ife: 68, sentimento: 62 },
  { date: '15/10', ife: 70, sentimento: 65 },
  { date: '22/10', ife: 71, sentimento: 66 },
  { date: '29/10', ife: 72, sentimento: 68 },
]

const topicsData = [
  { tema: 'Saúde', mencoes: 45, sentimento: 72 },
  { tema: 'Educação', mencoes: 38, sentimento: 68 },
  { tema: 'Segurança', mencoes: 32, sentimento: 65 },
  { tema: 'Economia', mencoes: 28, sentimento: 70 },
  { tema: 'Infraestrutura', mencoes: 22, sentimento: 75 },
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
  const [cidadesNaoVisitadasLista, setCidadesNaoVisitadasLista] = useState<Array<{ cidade: string; motivo: string; expectativaVotos?: number }>>([])
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
  const [ultimasNoticias, setUltimasNoticias] = useState<NewsItem[]>([])
  const [loadingNoticias, setLoadingNoticias] = useState(true)
  const [paginaNoticias, setPaginaNoticias] = useState(0)
  const noticiasPorPagina = 5

  // Buscar últimas notícias do candidato
  const fetchUltimasNoticias = async () => {
    setLoadingNoticias(true)
    try {
      const response = await fetch('/api/noticias/candidato?limit=10')
      if (response.ok) {
        const data = await response.json()
        setUltimasNoticias(data)
      } else {
        setUltimasNoticias([])
      }
    } catch (error) {
      setUltimasNoticias([])
    } finally {
      setLoadingNoticias(false)
    }
  }

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
    
    // Buscar últimas notícias do candidato
    fetchUltimasNoticias()
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
        const savedConfig = localStorage.getItem('territorio_sheets_config')
        if (savedConfig) {
          const config = JSON.parse(savedConfig)
          const response = await fetch('/api/dashboard/territorios-frios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ territorioConfig: config }),
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

            // Cidades não visitadas
            setCidadesNaoVisitadasLista(
              data.cidadesNaoVisitadasLista?.map((t: any) => ({
                cidade: t.cidade,
                motivo: t.motivo,
                expectativaVotos: t.expectativaVotos,
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
        
        setKpis([
          {
            id: 'ife',
            label: 'Expectativa 2026',
            value: expectativa2026 !== null ? expectativa2026.toLocaleString('pt-BR') : data.ife.value,
            variation: data.ife.variation,
            status: data.ife.status,
          },
            {
              id: 'presenca',
              label: 'Presença Territorial',
              value: cidadesUnicas !== null ? `${cidadesUnicas}/224` : data.presenca.value,
              variation: data.presenca.variation,
              status: data.presenca.status,
            },
            {
              id: 'base',
              label: 'Capilaridade da Base',
              value: territorioKPIs?.liderancas !== null && territorioKPIs?.liderancas !== undefined 
                ? territorioKPIs.liderancas 
                : data.base.value,
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
              label: 'Sentimento Público',
              value: `${data.sentimento.value}%`,
              variation: data.sentimento.variation,
              status: data.sentimento.status,
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

  return (
    <div className="min-h-screen bg-background">
      <Header title="Visão Geral" subtitle="Dashboard Executivo - Visão estratégica em 30 segundos" showFilters={false} />

      <div className="px-4 py-6 lg:px-6">
        {/* Linha 1 - KPIs Centrais */}
        <section className="mb-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 bg-surface rounded-2xl border border-border animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {kpis.map((kpi) => (
                <KPICard key={kpi.id} kpi={kpi} href={`/${kpi.id}`} />
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Linha 2 - Leitura Estratégica */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gráfico de Histórico de Pesquisas */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text-strong">Histórico de Pesquisas de Intenção de Votos</h2>
                {candidatoPadrao && (
                  <span className="text-sm text-text-muted">{candidatoPadrao}</span>
                )}
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
                          <stop offset="5%" stopColor="#1E4ED8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#1E4ED8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
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
                        }}
                        formatter={(value: number) => [`${value}%`, 'Intenção de Voto']}
                      />
                      <Area
                        type="monotone"
                        dataKey="intencao"
                        stroke="#1E4ED8"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorIntencao)"
                        name="Intenção de Voto"
                        dot={(props: any) => {
                          const { cx, cy, payload } = props
                          if (!payload) return <circle cx={cx} cy={cy} r={4} fill="#1E4ED8" />
                          
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
                              <circle cx={cx} cy={cy} r={4} fill="#1E4ED8" />
                              <text
                                x={cx}
                                y={cy - 20}
                                fill="#1E4ED8"
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
                  <div className="flex items-center justify-center h-full text-text-muted">
                    {candidatoPadrao 
                      ? 'Nenhuma pesquisa encontrada para este candidato'
                      : 'Selecione um candidato padrão na página Pesquisa & Relato'}
                  </div>
                )}
              </div>
            </div>

            {/* Análise de Territórios */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text-strong flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Análise de Territórios
                </h2>
              </div>

              {loadingTerritorios ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-background rounded-xl animate-pulse" />
                    ))}
                  </div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-3 rounded-xl border border-border bg-surface animate-pulse">
                      <div className="h-4 bg-background rounded w-1/3 mb-2" />
                      <div className="h-3 bg-background rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Estatísticas Gerais */}
                  {territorioStats && (
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{territorioStats.cidadesVisitadas}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">Cidades Visitadas</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-blue-600">{territorioStats.totalVisitas}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">Total de Visitas</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{territorioStats.percentualCobertura}%</p>
                        <p className="text-[10px] text-text-muted mt-0.5">Cobertura</p>
                      </div>
                    </div>
                  )}

                  {/* Tabs de Territórios */}
                  <div className="space-y-4">
                    {/* Territórios Quentes */}
                    {territoriosQuentes.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Flame className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-semibold text-emerald-600">Territórios Quentes</span>
                          <span className="text-[10px] text-text-muted">({territoriosQuentes.length})</span>
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
                                  <p className="text-sm font-medium text-text-strong">{territorio.cidade}</p>
                                  <p className="text-[10px] text-text-muted">{territorio.motivo}</p>
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
                          <span className="text-[10px] text-text-muted">({territoriosMornos.length})</span>
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
                                  <p className="text-sm font-medium text-text-strong">{territorio.cidade}</p>
                                  <p className="text-[10px] text-text-muted">{territorio.motivo}</p>
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
                          <span className="text-[10px] text-text-muted">({territoriosFrios.length})</span>
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
                                  <p className="text-sm font-medium text-text-strong">{territorio.cidade}</p>
                                  <p className="text-[10px] text-text-muted">{territorio.motivo}</p>
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
                      <div className="text-center py-2 mb-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium">
                          <Flame className="w-3.5 h-3.5" />
                          Nenhum território em estado crítico
                        </div>
                      </div>
                    )}

                    {/* Cidades Não Visitadas - sempre mostrar */}
                    {cidadesNaoVisitadasLista.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="text-xs font-semibold text-gray-600">Cidades Não Visitadas</span>
                          <span className="text-[10px] text-text-muted">({cidadesNaoVisitadasLista.length})</span>
                        </div>
                        <div className="space-y-2">
                          {cidadesNaoVisitadasLista.slice(0, 5).map((cidade) => (
                            <div
                              key={cidade.cidade}
                              className="p-2.5 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-bold">
                                  0
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-text-strong">{cidade.cidade}</p>
                                  <p className="text-[10px] text-text-muted">{cidade.motivo}</p>
                                </div>
                              </div>
                              {cidade.expectativaVotos && cidade.expectativaVotos > 0 && (
                                <span className="text-xs font-semibold text-gray-600">
                                  {cidade.expectativaVotos.toLocaleString('pt-BR')} votos
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

            {/* Top 5 Temas Emergentes */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-lg font-semibold text-text-strong mb-4">Top 5 Temas Emergentes</h2>
              <div className="space-y-3">
                {topicsData.map((topic, index) => (
                  <div
                    key={topic.tema}
                    className="flex items-center justify-between p-3 rounded-xl bg-background hover:bg-primary-soft transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-strong">{topic.tema}</p>
                        <p className="text-xs text-text-muted">{topic.mencoes} menções</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-text-strong">{topic.sentimento}%</p>
                        <p className="text-xs text-text-muted">Sentimento</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna Direita - Ações e Alertas */}
          <div className="space-y-6">
            {/* Alertas Críticos */}
            <div>
              <h2 className="text-lg font-semibold text-text-strong mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-status-error" />
                Alertas Críticos
              </h2>
              <div className="space-y-3">
                {loadingAlerts ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-surface rounded-xl border border-border p-4 animate-pulse">
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
                    <p className="text-sm text-text-muted">Nenhum alerta crítico no momento</p>
                  </div>
                )}
              </div>
            </div>

            {/* Últimas Notícias do Candidato */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-text-strong flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-primary" />
                  Últimas Notícias
                </h2>
                {ultimasNoticias.length > noticiasPorPagina && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPaginaNoticias(Math.max(0, paginaNoticias - 1))}
                      disabled={paginaNoticias === 0}
                      className="p-1.5 rounded-lg hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-xs text-text-muted px-1">
                      {paginaNoticias + 1}/{Math.ceil(ultimasNoticias.length / noticiasPorPagina)}
                    </span>
                    <button
                      onClick={() => setPaginaNoticias(Math.min(Math.ceil(ultimasNoticias.length / noticiasPorPagina) - 1, paginaNoticias + 1))}
                      disabled={paginaNoticias >= Math.ceil(ultimasNoticias.length / noticiasPorPagina) - 1}
                      className="p-1.5 rounded-lg hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {loadingNoticias ? (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="bg-surface rounded-xl border border-border p-3 animate-pulse">
                        <div className="h-3 bg-background rounded w-3/4 mb-2" />
                        <div className="h-2 bg-background rounded w-1/2" />
                      </div>
                    ))}
                  </>
                ) : ultimasNoticias.length > 0 ? (
                  <div className="bg-surface rounded-xl border border-border divide-y divide-border overflow-hidden">
                    {ultimasNoticias
                      .slice(paginaNoticias * noticiasPorPagina, (paginaNoticias + 1) * noticiasPorPagina)
                      .map((noticia) => {
                        const sentimentColor = noticia.sentiment === 'positive' 
                          ? 'bg-emerald-500' 
                          : noticia.sentiment === 'negative' 
                            ? 'bg-red-500' 
                            : 'bg-slate-400'
                        
                        const dataPublicacao = noticia.published_at || noticia.collected_at
                        const dataFormatada = dataPublicacao 
                          ? new Date(dataPublicacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                          : ''
                        
                        return (
                          <a
                            key={noticia.id}
                            href={noticia.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 p-3 hover:bg-background/50 transition-colors group"
                          >
                            <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${sentimentColor}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-text-strong line-clamp-2 group-hover:text-primary transition-colors">
                                {noticia.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-text-muted">{noticia.source}</span>
                                {dataFormatada && (
                                  <>
                                    <span className="text-[10px] text-text-muted">·</span>
                                    <span className="text-[10px] text-text-muted">{dataFormatada}</span>
                                  </>
                                )}
                                {noticia.theme && (
                                  <>
                                    <span className="text-[10px] text-text-muted">·</span>
                                    <span className="text-[10px] text-primary font-medium">{noticia.theme}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {noticia.url && (
                              <ExternalLink className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                            )}
                          </a>
                        )
                      })}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-surface rounded-xl border border-border">
                    <p className="text-sm text-text-muted">Nenhuma notícia coletada</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bandeiras de Campanha - Usos e Performance */}
            <div>
              <h2 className="text-lg font-semibold text-text-strong mb-4 flex items-center gap-2">
                <Flag className="w-5 h-5 text-primary" />
                Bandeiras de Campanha
              </h2>
              {loadingBandeiras ? (
                <div className="bg-surface rounded-xl border border-border p-4 animate-pulse space-y-3">
                  <div className="h-4 bg-background rounded w-3/4" />
                  <div className="h-4 bg-background rounded w-1/2" />
                  <div className="h-4 bg-background rounded w-2/3" />
                </div>
              ) : bandeirasStats ? (
                <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
                  {/* KPIs principais */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <span className="text-xs text-blue-600 font-medium">Total de Usos</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">{bandeirasStats.totalUsos}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">Performance Média</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">{bandeirasStats.totalPerformance}%</p>
                    </div>
                  </div>

                  {/* Top 3 Bandeiras */}
                  {bandeirasStats.topBandeiras.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-text-muted mb-2">Top 3 Bandeiras por Uso</p>
                      <div className="space-y-2">
                        {bandeirasStats.topBandeiras.map((bandeira, index) => (
                          <div
                            key={bandeira.theme}
                            className="flex items-center justify-between p-2 bg-background rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-semibold">
                                {index + 1}
                              </div>
                              <span className="text-sm text-text-strong">{bandeira.theme}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-text-muted">{bandeira.usage_count} usos</span>
                              <span className="text-text-muted">{bandeira.performance_score}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {bandeirasStats.totalBandeiras === 0 && (
                    <p className="text-sm text-text-muted text-center py-2">
                      Nenhuma bandeira ativa cadastrada
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-surface rounded-xl border border-border p-4">
                  <p className="text-sm text-text-muted text-center">
                    Erro ao carregar estatísticas das bandeiras
                  </p>
                </div>
              )}
            </div>

            {/* Pendências Jurídicas */}
            <div>
              <h2 className="text-lg font-semibold text-text-strong mb-4 flex items-center gap-2">
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
              <h2 className="text-lg font-semibold text-text-strong mb-4">
                Ações Recomendadas Automáticas
              </h2>
              <div className="space-y-3">
                {mockActions.map((action) => (
                  <ActionCard key={action.id} action={action} />
                ))}
              </div>
            </div>

            {/* Próximas 24h */}
            <div className="bg-primary-soft rounded-2xl border border-primary/30 p-6">
              <h2 className="text-lg font-semibold text-text-strong mb-4">Próximas 24h</h2>
              <div className="space-y-3">
                {[
                  { hora: '09:00', evento: 'Agenda: Visita a São Paulo', tipo: 'Agenda' },
                  { hora: '14:00', evento: 'Entrevista - TV Local', tipo: 'Mídia' },
                  { hora: '16:00', evento: 'Reunião - Coordenação', tipo: 'Reunião' },
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="text-sm font-medium text-primary">{item.hora}</div>
                    <div className="flex-1">
                      <p className="text-sm text-text-strong">{item.evento}</p>
                      <p className="text-xs text-text-muted">{item.tipo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

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

