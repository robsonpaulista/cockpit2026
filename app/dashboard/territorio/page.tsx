'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { GoogleSheetsConfigModal } from '@/components/google-sheets-config-modal'
import { Users, Settings, RefreshCw, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { KPI } from '@/types'

interface Lideranca {
  [key: string]: any
}

interface SheetsConfig {
  spreadsheetId: string
  sheetName: string
  range?: string
  serviceAccountEmail: string
  credentials: string
}

export default function TerritorioPage() {
  const [liderancas, setLiderancas] = useState<Lideranca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState<SheetsConfig | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())
  const [filtroCidade, setFiltroCidade] = useState<string>('')
  const [filtroNome, setFiltroNome] = useState<string>('')
  const [filtroCargo, setFiltroCargo] = useState<string>('')

  useEffect(() => {
    // Carregar configuração salva
    const savedConfig = localStorage.getItem('territorio_sheets_config')
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        setConfig(parsed)
        fetchData(parsed)
      } catch (e) {
        console.error('Erro ao carregar configuração:', e)
        setLoading(false)
      }
    } else {
      setLoading(false)
      setShowConfig(true) // Mostrar modal se não houver configuração
    }
  }, [])

  const fetchData = async (sheetsConfig: SheetsConfig) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/territorio/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: sheetsConfig.spreadsheetId,
          sheetName: sheetsConfig.sheetName,
          range: sheetsConfig.range,
          serviceAccountEmail: sheetsConfig.serviceAccountEmail,
          credentials: sheetsConfig.credentials,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setLiderancas(data.records || [])
        setHeaders(data.headers || [])
      } else {
        setError(data.error || 'Erro ao buscar dados')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com Google Sheets')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = (newConfig: SheetsConfig) => {
    setConfig(newConfig)
    localStorage.setItem('territorio_sheets_config', JSON.stringify(newConfig))
    fetchData(newConfig)
  }

  // Identificar colunas importantes
  const liderancaAtualCol = headers.find((h) =>
    /liderança atual|lideranca atual|atual\?/i.test(h)
  )
  const expectativaVotosCol = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    if (/jadyel|nome|pessoa|candidato/i.test(normalized)) {
      return false
    }
    return /^expectativa\s+de\s+votos\s+2026$/i.test(h) || 
           /expectativa\s+de\s+votos\s+2026/i.test(h) ||
           (/expectativa.*votos.*2026/i.test(h) && !/jadyel|nome|pessoa|candidato/i.test(h))
  })

  // Função para normalizar números
  const normalizeNumber = (value: any): number => {
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
        if (parts[1].length === 3) {
          cleaned = cleaned.replace(/,/g, '')
        } else if (parts[1].length <= 2) {
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

  // Identificar colunas para filtros
  const nomeCol = headers.find((h) =>
    /nome|name|lider|pessoa/i.test(h)
  ) || headers[0] || 'Coluna 1'
  const cidadeCol = headers.find((h) =>
    /cidade|city|município|municipio/i.test(h)
  ) || headers[1] || 'Coluna 2'
  const cargoCol = headers.find((h) =>
    /cargo.*2024|cargo/i.test(h)
  )

  // Filtrar lideranças: incluir "Liderança Atual?" = SIM OU que tenham "Expectativa de Votos 2026"
  const liderancasFiltradas = (() => {
    if (liderancas.length === 0) return []

    if (!liderancaAtualCol && !expectativaVotosCol) {
      // Se não encontrar nenhuma das colunas, retorna todos
      return liderancas
    }

    let filtradas = liderancas.filter((l) => {
      // Se tem "Liderança Atual?" = SIM, incluir
      if (liderancaAtualCol) {
        const value = String(l[liderancaAtualCol] || '').trim().toUpperCase()
        if (value === 'SIM' || value === 'YES' || value === 'TRUE' || value === '1') {
          return true
        }
      }

      // Se tem "Expectativa de Votos 2026" com valor, incluir também
      if (expectativaVotosCol) {
        const expectativaValue = normalizeNumber(l[expectativaVotosCol])
        if (expectativaValue > 0) {
          return true
        }
      }

      return false
    })

    // Aplicar filtros adicionais (Cidade, Nome, Cargo)
    if (filtroCidade) {
      filtradas = filtradas.filter((l) => {
        const cidade = String(l[cidadeCol] || '').toLowerCase()
        return cidade.includes(filtroCidade.toLowerCase())
      })
    }

    if (filtroNome) {
      filtradas = filtradas.filter((l) => {
        const nome = String(l[nomeCol] || '').toLowerCase()
        return nome.includes(filtroNome.toLowerCase())
      })
    }

    if (filtroCargo && cargoCol) {
      filtradas = filtradas.filter((l) => {
        const cargo = String(l[cargoCol] || '').toLowerCase()
        return cargo.includes(filtroCargo.toLowerCase())
      })
    }

    return filtradas
  })()

  // Calcular KPIs baseados nos dados filtrados
  const calcularKPIs = (): KPI[] => {
    const dadosParaKPIs = liderancasFiltradas.length > 0 ? liderancasFiltradas : liderancas

    if (dadosParaKPIs.length === 0) {
      return [
        {
          id: 'liderancas',
          label: 'Lideranças Atuais',
          value: 0,
          status: 'neutral',
        },
        {
          id: 'total',
          label: 'Total de Registros',
          value: liderancas.length,
          status: 'neutral',
        },
      ]
    }

    // Tentar identificar colunas comuns (nomeCol e cidadeCol já foram definidos no escopo superior)
    const statusCol = headers.find((h) =>
      /status|ativo|situação/i.test(h)
    )

    const ativos = statusCol
      ? dadosParaKPIs.filter((l) =>
          /ativo|active|sim|yes|true/i.test(String(l[statusCol] || ''))
        ).length
      : dadosParaKPIs.length

    // Função para normalizar números (tratar vírgula como separador de milhar)
    const normalizeNumber = (value: any): number => {
      if (typeof value === 'number') return value
      
      const str = String(value).trim()
      if (!str) return 0
      
      // Remover espaços e caracteres não numéricos exceto vírgula e ponto
      let cleaned = str.replace(/[^\d.,]/g, '')
      
      // Se tem vírgula e ponto
      if (cleaned.includes(',') && cleaned.includes('.')) {
        // Formato: 1.234,56 ou 1,234.56
        // Se vírgula vem depois do ponto, é separador decimal (BR)
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
          cleaned = cleaned.replace(/\./g, '').replace(',', '.')
        } else {
          // Se ponto vem depois da vírgula, vírgula é separador de milhar
          cleaned = cleaned.replace(/,/g, '')
        }
      } else if (cleaned.includes(',')) {
        // Apenas vírgula: verificar se é separador de milhar ou decimal
        const parts = cleaned.split(',')
        if (parts.length === 2) {
          // Se tem exatamente 3 dígitos após vírgula = separador de milhar (ex: 4,000 = 4000)
          if (parts[1].length === 3) {
            cleaned = cleaned.replace(/,/g, '')
          } else if (parts[1].length <= 2) {
            // 1-2 dígitos após vírgula = separador decimal (ex: 4,50 = 4.50)
            cleaned = cleaned.replace(',', '.')
          } else {
            // Mais de 3 dígitos = separador de milhar
            cleaned = cleaned.replace(/,/g, '')
          }
        } else {
          // Múltiplas vírgulas = separador de milhar
          cleaned = cleaned.replace(/,/g, '')
        }
      }
      
      const numValue = parseFloat(cleaned)
      return isNaN(numValue) ? 0 : numValue
    }

    // Calcular total de expectativa de votos (usar expectativaVotosCol já definido no escopo superior)
    let totalExpectativaVotos = 0
    if (expectativaVotosCol) {
      totalExpectativaVotos = dadosParaKPIs.reduce((sum, l) => {
        const value = l[expectativaVotosCol]
        return sum + normalizeNumber(value)
      }, 0)
    }

    return [
  {
    id: 'liderancas',
        label: 'Lideranças Atuais',
        value: liderancasFiltradas.length,
    status: 'success',
  },
  {
        id: 'total',
        label: 'Total de Registros',
        value: liderancas.length,
    status: 'success',
  },
      ...(expectativaVotosCol && totalExpectativaVotos > 0
        ? [
            {
              id: 'expectativa-votos',
              label: 'Expectativa 2026',
              value: Math.round(totalExpectativaVotos).toLocaleString('pt-BR'),
              status: 'success' as const,
            },
          ]
        : []),
      {
        id: 'cidades',
        label: 'Cidades Únicas',
        value: cidadeCol
          ? new Set(dadosParaKPIs.map((l) => l[cidadeCol]).filter(Boolean)).size
          : 0,
    status: 'success',
  },
]
  }

  const kpis = calcularKPIs()

  // Identificar colunas para exibição (nomeCol, cidadeCol e cargoCol já foram definidos no escopo superior)
  const scoreCol = headers.find((h) =>
    /score|pontuação|pontuacao|nota/i.test(h)
  )
  const statusCol = headers.find((h) =>
    /status|ativo|situação/i.test(h)
  )
  const cargo2024Col = headers.find((h) =>
    /cargo.*2024/i.test(h)
  )
  // liderancaAtualCol e expectativaVotosCol já foram definidos no escopo superior

  return (
    <div className="min-h-screen bg-background">
      <Header title="Território & Base" subtitle="CRM Político - Organize articulação e apoio real" />

      <div className="px-4 py-6 lg:px-6">
        {/* Botão de Configuração */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {config && (
              <button
                onClick={() => fetchData(config)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-background transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            )}
          </div>
          <button
            onClick={() => setShowConfig(true)}
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {config ? 'Configurar Planilha' : 'Conectar Planilha'}
          </button>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-status-error/30 bg-status-error/10 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-status-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-status-error">Erro ao carregar dados</p>
              <p className="text-xs text-text-muted mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* KPIs */}
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {kpis.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        {/* Filtros */}
        {config && liderancas.length > 0 && (
          <div className="mb-6 bg-surface rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold text-text-strong mb-4">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filtro por Cidade */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">
                  Cidade
                </label>
                <input
                  type="text"
                  value={filtroCidade}
                  onChange={(e) => setFiltroCidade(e.target.value)}
                  placeholder="Filtrar por cidade..."
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
                />
              </div>

              {/* Filtro por Nome */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">
                  Liderança (Nome)
                </label>
                <input
                  type="text"
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  placeholder="Filtrar por nome..."
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
                />
              </div>

              {/* Filtro por Cargo */}
              {cargoCol && (
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={filtroCargo}
                    onChange={(e) => setFiltroCargo(e.target.value)}
                    placeholder="Filtrar por cargo..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
                  />
                </div>
              )}
            </div>
            {(filtroCidade || filtroNome || filtroCargo) && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {liderancasFiltradas.length} resultado{liderancasFiltradas.length !== 1 ? 's' : ''} encontrado{liderancasFiltradas.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => {
                    setFiltroCidade('')
                    setFiltroNome('')
                    setFiltroCargo('')
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lista de Lideranças */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-text-strong">
                {config ? 'Lideranças Atuais' : 'Lideranças'}
              </h2>
              {config && (liderancaAtualCol || expectativaVotosCol) && (
                <p className="text-xs text-text-muted mt-1">
                  Mostrando lideranças com "Liderança Atual?" = SIM ou com "Expectativa de Votos 2026"
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {config && liderancasFiltradas.length > 0 && (() => {
                // Contar cidades únicas
                const cidadesUnicas = new Set(liderancasFiltradas.map(l => l[cidadeCol] || 'Sem cidade')).size
                const todasExpandidas = expandedCities.size === cidadesUnicas && cidadesUnicas > 0
                
                return (
                  <button
                    onClick={() => {
                      if (todasExpandidas) {
                        // Recolher todas
                        setExpandedCities(new Set())
                      } else {
                        // Expandir todas
                        const todasCidades = new Set(liderancasFiltradas.map(l => l[cidadeCol] || 'Sem cidade'))
                        setExpandedCities(todasCidades)
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-background transition-colors flex items-center gap-2"
                  >
                    {todasExpandidas ? (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        Recolher Todas
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-3 h-3" />
                        Expandir Todas
                      </>
                    )}
                  </button>
                )
              })()}
              {config && (
                <div className="text-right">
                  <span className="text-sm font-semibold text-text-strong block">
                    {liderancasFiltradas.length}
                  </span>
                  <span className="text-xs text-text-muted">
                    de {liderancas.length} registros
                  </span>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-background rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !config ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-muted mb-4">
                Configure uma planilha do Google Sheets para começar
              </p>
              <button
                onClick={() => setShowConfig(true)}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Conectar Planilha
              </button>
            </div>
          ) : liderancas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted">Nenhum dado encontrado na planilha</p>
            </div>
          ) : liderancasFiltradas.length === 0 && liderancaAtualCol ? (
            <div className="text-center py-12">
              <p className="text-text-muted mb-2">
                Nenhuma liderança atual encontrada
              </p>
              <p className="text-xs text-text-muted">
                Verifique se há registros com "Liderança Atual?" = SIM na planilha
              </p>
            </div>
          ) : (() => {
            // Função para normalizar números
            const normalizeNumber = (value: any): number => {
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
                  if (parts[1].length === 3) {
                    cleaned = cleaned.replace(/,/g, '')
                  } else if (parts[1].length <= 2) {
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

            // Agrupar lideranças por cidade
            const liderancasPorCidade = liderancasFiltradas.reduce((acc, lider) => {
              const cidade = lider[cidadeCol] || 'Sem cidade'
              if (!acc[cidade]) {
                acc[cidade] = []
              }
              acc[cidade].push(lider)
              return acc
            }, {} as Record<string, typeof liderancasFiltradas>)

            // Ordenar cidades por total de expectativa de votos (decrescente)
            const cidadesOrdenadas = Object.keys(liderancasPorCidade).sort((a, b) => {
              const totalA = liderancasPorCidade[a].reduce((sum, l) => {
                return sum + (expectativaVotosCol ? normalizeNumber(l[expectativaVotosCol]) : 0)
              }, 0)
              const totalB = liderancasPorCidade[b].reduce((sum, l) => {
                return sum + (expectativaVotosCol ? normalizeNumber(l[expectativaVotosCol]) : 0)
              }, 0)
              return totalB - totalA
            })

            return (
          <div className="space-y-3">
                {cidadesOrdenadas.map((cidade) => {
                  const liderancasCidade = liderancasPorCidade[cidade]
                  const totalExpectativaCidade = liderancasCidade.reduce((sum, l) => {
                    return sum + (expectativaVotosCol ? normalizeNumber(l[expectativaVotosCol]) : 0)
                  }, 0)
                  const isExpanded = expandedCities.has(cidade)

                  return (
                    <div
                      key={cidade}
                      className="rounded-xl border border-border overflow-hidden"
                    >
                      {/* Cabeçalho da Cidade */}
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedCities)
                          if (isExpanded) {
                            newExpanded.delete(cidade)
                          } else {
                            newExpanded.add(cidade)
                          }
                          setExpandedCities(newExpanded)
                        }}
                        className="w-full p-4 bg-background hover:bg-background/80 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-text-muted" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-text-muted" />
                          )}
                    <div className="p-2 rounded-lg bg-primary-soft">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-semibold text-text-strong">{cidade}</p>
                            <p className="text-xs text-text-muted">
                              {liderancasCidade.length} liderança{liderancasCidade.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        {expectativaVotosCol && totalExpectativaCidade > 0 && (
                          <div className="text-right">
                            <p className="text-xs text-text-muted mb-0.5">Total Esperado</p>
                            <p className="text-sm font-semibold text-primary">
                              {Math.round(totalExpectativaCidade).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        )}
                      </button>

                      {/* Lista de Lideranças da Cidade */}
                      {isExpanded && (
                        <div className="border-t border-border bg-surface">
                          {liderancasCidade.map((lider, idx) => {
                            const numValue = expectativaVotosCol && lider[expectativaVotosCol]
                              ? normalizeNumber(lider[expectativaVotosCol])
                              : 0

                            // Verificar se é liderança atual (SIM) ou apenas tem expectativa de votos
                            const isLiderancaAtual = liderancaAtualCol && 
                              /sim|yes|true|1/i.test(String(lider[liderancaAtualCol] || '').trim())
                            const hasExpectativa = numValue > 0
                            const isDestaque = hasExpectativa && !isLiderancaAtual

                            return (
                              <div
                                key={idx}
                                className={`p-4 border-b border-border last:border-b-0 hover:bg-background/50 transition-colors ${
                                  isDestaque ? 'bg-status-warning/5 border-l-4 border-l-status-warning' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className="p-2 rounded-lg bg-primary-soft/50">
                                      <Users className="w-3 h-3 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-text-strong truncate">
                                          {lider[nomeCol] || 'Sem nome'}
                                        </p>
                                        {isDestaque && (
                                          <span className="px-2 py-0.5 text-xs font-medium bg-status-warning/20 text-status-warning rounded-lg">
                                            Sem Liderança Atual
                                          </span>
                                        )}
                                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                                    {expectativaVotosCol && lider[expectativaVotosCol] && (
                                      <div className="text-right">
                                        <p className="text-xs text-text-muted mb-0.5">Expectativa de Votos 2026</p>
                                        <p className="text-sm font-semibold text-primary">
                                          {numValue.toLocaleString('pt-BR')}
                                        </p>
                                      </div>
                                    )}
                                    {scoreCol && lider[scoreCol] && (
                    <div className="text-right">
                                        <p className="text-xs text-text-muted mb-0.5">Score</p>
                                        <p className="text-sm font-semibold text-text-strong">
                                          {lider[scoreCol]}
                                        </p>
                    </div>
                                    )}
                                    {statusCol && lider[statusCol] && (
                                      <span
                                        className={`px-2 py-1 text-xs rounded-lg ${
                                          /ativo|active|sim/i.test(String(lider[statusCol]))
                                            ? 'bg-status-success/10 text-status-success'
                                            : 'bg-text-muted/10 text-text-muted'
                                        }`}
                                      >
                                        {lider[statusCol]}
                                      </span>
                                    )}
                  </div>
                </div>
                                {/* Mostrar outras colunas importantes */}
                                {headers.length > 3 && (() => {
                                  // Filtrar e priorizar colunas
                                  const outrasColunas = headers
                                    .filter((h) => 
                                      h !== nomeCol && 
                                      h !== cidadeCol && 
                                      h !== scoreCol && 
                                      h !== statusCol &&
                                      h !== expectativaVotosCol &&
                                      h !== liderancaAtualCol &&
                                      !/cargo.*2020/i.test(h) // Excluir Cargo 2020
                                    )
                                    // Priorizar Cargo 2024
                                    .sort((a, b) => {
                                      const aIsCargo2024 = /cargo.*2024/i.test(a)
                                      const bIsCargo2024 = /cargo.*2024/i.test(b)
                                      if (aIsCargo2024 && !bIsCargo2024) return -1
                                      if (!aIsCargo2024 && bIsCargo2024) return 1
                                      return 0
                                    })
                                    .slice(0, 3)

                                  if (outrasColunas.length === 0) return null

                                  return (
                                    <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
                                      {outrasColunas.map((header) => (
                                        <div key={header} className="text-xs">
                                          <span className="text-text-muted">{header}:</span>{' '}
                                          <span className="text-text-strong">{lider[header] || '-'}</span>
              </div>
            ))}
          </div>
                                  )
                                })()}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Modal de Configuração */}
      {showConfig && (
        <GoogleSheetsConfigModal
          onClose={() => setShowConfig(false)}
          onSave={handleSaveConfig}
          currentConfig={config || undefined}
        />
      )}
    </div>
  )
}

