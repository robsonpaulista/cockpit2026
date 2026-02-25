'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { KPICard } from '@/components/kpi-card'
import { GoogleSheetsConfigModal } from '@/components/google-sheets-config-modal'
import { Users, Settings, RefreshCw, AlertCircle, ChevronDown, ChevronRight, Network, FileText, Briefcase, Check } from 'lucide-react'
import { MindMapModal } from '@/components/mind-map-modal'
import { CityDemandsModal } from '@/components/city-demands-modal'
import { ExecutiveBriefingModal } from '@/components/executive-briefing-modal'
import { MapaVotoCruzado } from '@/components/mapa-voto-cruzado'
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
  const [filtroDepEstadual, setFiltroDepEstadual] = useState<string[]>([])
  const [filtroFaixaVotos, setFiltroFaixaVotos] = useState<string>('')
  const [showDepDropdown, setShowDepDropdown] = useState(false)
  const [showMapaVotoCruzado, setShowMapaVotoCruzado] = useState(true)
  const [showMindMap, setShowMindMap] = useState(false)
  const [candidatoPadrao, setCandidatoPadrao] = useState<string>('')
  const [serverConfigured, setServerConfigured] = useState(false)
  const [showCityDemands, setShowCityDemands] = useState(false)
  const [selectedCityForDemands, setSelectedCityForDemands] = useState<string>('')
  const [showExecutiveBriefing, setShowExecutiveBriefing] = useState(false)
  const [selectedCityForBriefing, setSelectedCityForBriefing] = useState<string>('')
  const [selectedCityLiderancas, setSelectedCityLiderancas] = useState<Lideranca[]>([])
  const depDropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const initConfig = async () => {
      // 1. Verificar se há configuração no servidor (variáveis de ambiente)
      try {
        const serverConfigRes = await fetch('/api/territorio/config')
        const serverConfig = await serverConfigRes.json()
        
        if (serverConfig.configured) {
          // Usar configuração do servidor
          setServerConfigured(true)
          fetchDataFromServer()
          
          // Carregar candidato padrão
          const savedCandidato = localStorage.getItem('candidato_padrao')
          if (savedCandidato) setCandidatoPadrao(savedCandidato)
          return
        }
      } catch (e) {
        console.log('Servidor sem configuração, usando localStorage')
      }

      // 2. Fallback: Verificar localStorage
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

      // Carregar candidato padrão do localStorage
      const savedCandidato = localStorage.getItem('candidato_padrao')
      if (savedCandidato) {
        setCandidatoPadrao(savedCandidato)
      }
    }

    initConfig()
  }, [])

  useEffect(() => {
    if (!showDepDropdown) return

    const handleClickOutside = (event: MouseEvent) => {
      if (depDropdownRef.current && !depDropdownRef.current.contains(event.target as Node)) {
        setShowDepDropdown(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDepDropdown(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [showDepDropdown])

  // Buscar dados usando configuração do servidor
  const fetchDataFromServer = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/territorio/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Servidor usa variáveis de ambiente
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
  const cargoCol = (() => {
    // Priorizar "Cargo 2024" explicitamente
    const cargo2024 = headers.find(h => /cargo.*2024/i.test(h))
    if (cargo2024) return cargo2024
    // Fallback: Cargo Atual ou qualquer coluna de cargo (exceto 2020)
    return headers.find((h) => {
      const normalized = h.toLowerCase().trim()
      return /cargo.*atual|cargo/i.test(normalized) && 
             !/cargo.*2020/i.test(normalized) &&
             !/expectativa|votos|telefone|email|whatsapp|contato|endereco|endereço/i.test(normalized)
    })
  })()
  const depEstadualCol = headers.find((h) =>
    /dep.*estadual|deputad.*estadual/i.test(h)
  )

  const extrairDepEstadual = (lider: Lideranca): string => {
    const direto = depEstadualCol ? String(lider[depEstadualCol] || '').trim() : ''
    if (direto) return direto

    const cargoTexto = cargoCol ? String(lider[cargoCol] || '') : ''
    if (!cargoTexto) return ''

    const match = cargoTexto.match(/dep\.?\s*estadual\s*:?\s*([^·|]+?)(?:\s{2,}|·|$)/i)
    return match?.[1]?.trim() || ''
  }

  const deputadosEstaduaisUnicos = Array.from(
    new Set(
      liderancas
        .map((l) => extrairDepEstadual(l))
        .filter((n) => n.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const toggleDepEstadual = (dep: string) => {
    setFiltroDepEstadual((prev) =>
      prev.includes(dep) ? prev.filter((item) => item !== dep) : [...prev, dep]
    )
  }

  // Lista de cargos únicos para dropdown
  const cargosUnicos = cargoCol
    ? Array.from(new Set(
        liderancas
          .map(l => String(l[cargoCol] || '').trim())
          .filter(c => c.length > 0)
      )).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    : []

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
        const cargo = String(l[cargoCol] || '').trim()
        return cargo === filtroCargo
      })
    }

    if (filtroDepEstadual.length > 0) {
      filtradas = filtradas.filter((l) => {
        const dep = extrairDepEstadual(l)
        return filtroDepEstadual.includes(dep)
      })
    }

    // Aplicar filtro por faixa de votos esperados (considerando o total de cada cidade)
    if (filtroFaixaVotos && expectativaVotosCol) {
      // Agrupar por cidade e calcular total de votos por cidade
      const votosPorCidade = filtradas.reduce((acc, l) => {
        const cidade = l[cidadeCol] || 'Sem cidade'
        if (!acc[cidade]) {
          acc[cidade] = 0
        }
        acc[cidade] += normalizeNumber(l[expectativaVotosCol])
        return acc
      }, {} as Record<string, number>)

      // Filtrar cidades que estão na faixa selecionada
      const cidadesNaFaixa = Object.keys(votosPorCidade).filter((cidade) => {
        const totalVotos = votosPorCidade[cidade]
        
        switch (filtroFaixaVotos) {
          case 'ate-100':
            return totalVotos <= 100
          case 'ate-300':
            return totalVotos <= 300
          case 'ate-500':
            return totalVotos <= 500
          case 'acima-500':
            return totalVotos > 500
          case 'acima-1000':
            return totalVotos > 1000
          default:
            return true
        }
      })

      // Filtrar lideranças para manter apenas as das cidades na faixa
      filtradas = filtradas.filter((l) => {
        const cidade = l[cidadeCol] || 'Sem cidade'
        return cidadesNaFaixa.includes(cidade)
      })
    }

    return filtradas
  })()

  const mapaVotoCruzado = useMemo(() => {
    const porCidade: Record<string, {
      votos: number
      liderancas: number
      porDeputado: Record<string, { votos: number; liderancas: number }>
    }> = {}

    liderancasFiltradas.forEach((lider) => {
      const cidade = String(lider[cidadeCol] || '').trim() || 'Sem cidade'
      const dep = extrairDepEstadual(lider) || 'Não informado'
      const votos = expectativaVotosCol ? normalizeNumber(lider[expectativaVotosCol]) : 0

      if (!porCidade[cidade]) {
        porCidade[cidade] = { votos: 0, liderancas: 0, porDeputado: {} }
      }

      porCidade[cidade].votos += votos
      porCidade[cidade].liderancas += 1

      if (!porCidade[cidade].porDeputado[dep]) {
        porCidade[cidade].porDeputado[dep] = { votos: 0, liderancas: 0 }
      }
      porCidade[cidade].porDeputado[dep].votos += votos
      porCidade[cidade].porDeputado[dep].liderancas += 1
    })

    return Object.entries(porCidade)
      .map(([cidade, info]) => {
        const rankingDeputados = Object.entries(info.porDeputado)
          .map(([nome, dados]) => ({
            nome,
            votos: Math.round(dados.votos),
            liderancas: dados.liderancas,
          }))
          .sort((a, b) => (b.votos - a.votos) || (b.liderancas - a.liderancas))

        return {
          cidade,
          votos: Math.round(info.votos),
          liderancas: info.liderancas,
          deputadoDominante: rankingDeputados[0]?.nome || 'Não informado',
          rankingDeputados: rankingDeputados.slice(0, 5),
        }
      })
      .sort((a, b) => b.votos - a.votos)
  }, [liderancasFiltradas, cidadeCol, expectativaVotosCol, depEstadualCol, cargoCol])

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

  // Calcular totais por cargo - contar todas as lideranças, uma por uma
  const calcularTotaisPorCargo = () => {
    if (!cargoCol || liderancasFiltradas.length === 0) return []

    const totaisPorCargo: Record<string, number> = {}
    
    // Contar cada liderança por cargo (ignorar vazios)
    liderancasFiltradas.forEach((lider) => {
      const cargo = String(lider[cargoCol] || '').trim()
      if (!cargo) return // Ignorar lideranças sem cargo preenchido
      totaisPorCargo[cargo] = (totaisPorCargo[cargo] || 0) + 1
    })

    // Converter para array e ordenar por quantidade (decrescente)
    return Object.entries(totaisPorCargo)
      .map(([cargo, total]) => ({ cargo, total }))
      .sort((a, b) => b.total - a.total)
  }

  const totaisPorCargo = calcularTotaisPorCargo()

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

      <div className="px-4 py-6 lg:px-6">
        {/* Botão de Configuração */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(config || serverConfigured) && (
              <button
                onClick={() => {
                  if (serverConfigured) {
                    fetchDataFromServer()
                  } else if (config) {
                    fetchData(config)
                  }
                }}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium border border-card rounded-lg hover:bg-background transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            )}
          </div>
          <button
            onClick={() => setShowConfig(true)}
            className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {(config || serverConfigured) ? 'Configurar Planilha' : 'Conectar Planilha'}
          </button>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-status-error/30 bg-status-error/10 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-status-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-status-error">Erro ao carregar dados</p>
              <p className="text-xs text-secondary mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* KPIs - Só mostrar se houver configuração e dados */}
        {(config || serverConfigured) && liderancas.length > 0 && (
          <section className="mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpis.map((kpi) => (
                <KPICard key={kpi.id} kpi={kpi} />
              ))}
            </div>
            
            {/* Distribuição por Cargo - Compacto */}
            {totaisPorCargo.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-secondary">
                <span className="font-medium text-text-primary">Por cargo:</span>
                {totaisPorCargo.slice(0, 6).map((item, index) => (
                  <span key={item.cargo} className="inline-flex items-center">
                    <span className="font-semibold text-accent-gold">{item.total}</span>
                    <span className="ml-1">{item.cargo}</span>
                    {index < Math.min(totaisPorCargo.length - 1, 5) && <span className="ml-2">·</span>}
                  </span>
                ))}
                {totaisPorCargo.length > 6 && (
                  <span className="text-text-muted">+{totaisPorCargo.length - 6} outros</span>
                )}
              </div>
            )}
          </section>
        )}

        {/* Filtros */}
        {(config || serverConfigured) && liderancas.length > 0 && (
          <div className="mb-6 bg-surface rounded-2xl border border-card p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Filtro por Cidade */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-2">
                  Cidade
                </label>
                <input
                  type="text"
                  value={filtroCidade}
                  onChange={(e) => setFiltroCidade(e.target.value)}
                  placeholder="Filtrar por cidade..."
                  className="w-full px-3 py-2 text-sm border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
                />
              </div>

              {/* Filtro por Nome */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-2">
                  Liderança (Nome)
                </label>
                <input
                  type="text"
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  placeholder="Filtrar por nome..."
                  className="w-full px-3 py-2 text-sm border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
                />
              </div>

              {/* Filtro por Cargo */}
              {cargoCol && cargosUnicos.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    Cargo
                  </label>
                  <select
                    value={filtroCargo}
                    onChange={(e) => setFiltroCargo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
                  >
                    <option value="">Todos os cargos</option>
                    {cargosUnicos.map((cargo) => (
                      <option key={cargo} value={cargo}>{cargo}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtro por Deputado Estadual (voto cruzado) */}
              {deputadosEstaduaisUnicos.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    Dep. Estadual (Voto Cruzado)
                  </label>
                  <div className="relative" ref={depDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowDepDropdown((v) => !v)}
                      className="w-full px-3 py-2 text-sm border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface text-left flex items-center justify-between"
                    >
                      <span className="truncate">
                        {filtroDepEstadual.length > 0
                          ? filtroDepEstadual.length === deputadosEstaduaisUnicos.length
                            ? 'Todos selecionados'
                            : `${filtroDepEstadual.length} selecionado(s)`
                          : 'Todos os deputados'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-secondary transition-transform ${showDepDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showDepDropdown && (
                      <div className="absolute z-30 mt-1 w-full bg-surface border border-card rounded-lg shadow-lg overflow-hidden">
                        <div className="max-h-56 overflow-auto p-1">
                          {deputadosEstaduaisUnicos.map((dep) => {
                            const checked = filtroDepEstadual.includes(dep)
                            return (
                              <button
                                key={dep}
                                type="button"
                                onClick={() => toggleDepEstadual(dep)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-background text-left"
                              >
                                <span className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-accent-gold border-accent-gold' : 'border-card bg-white'}`}>
                                  {checked && <Check className="w-3 h-3 text-white" />}
                                </span>
                                <span className="truncate">{dep}</span>
                              </button>
                            )
                          })}
                        </div>
                        <div className="border-t border-card p-2 flex justify-between items-center">
                          <span className="text-[11px] text-secondary">{filtroDepEstadual.length} selecionado(s)</span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setFiltroDepEstadual(deputadosEstaduaisUnicos)}
                              className="text-[11px] text-accent-gold hover:underline disabled:opacity-50"
                              disabled={filtroDepEstadual.length === deputadosEstaduaisUnicos.length}
                            >
                              Selecionar todos
                            </button>
                            <button
                              type="button"
                              onClick={() => setFiltroDepEstadual([])}
                              className="text-[11px] text-accent-gold hover:underline"
                            >
                              Limpar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-secondary">
                    {filtroDepEstadual.length > 0
                      ? `${filtroDepEstadual.length} deputado(s) selecionado(s)`
                      : 'Selecione um ou mais deputados'}
                  </p>
                </div>
              )}

              {/* Filtro por Faixa de Votos Esperados */}
              {expectativaVotosCol && (
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    Faixa de Votos Esperados
                  </label>
                  <select
                    value={filtroFaixaVotos}
                    onChange={(e) => setFiltroFaixaVotos(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
                  >
                    <option value="">Todas as faixas</option>
                    <option value="ate-100">Até 100</option>
                    <option value="ate-300">Até 300</option>
                    <option value="ate-500">Até 500</option>
                    <option value="acima-500">Acima de 500</option>
                    <option value="acima-1000">Acima de 1000</option>
                  </select>
                </div>
              )}
            </div>
            {(filtroCidade || filtroNome || filtroCargo || filtroDepEstadual.length > 0 || filtroFaixaVotos) && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-secondary">
                  {liderancasFiltradas.length} resultado{liderancasFiltradas.length !== 1 ? 's' : ''} encontrado{liderancasFiltradas.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => {
                    setFiltroCidade('')
                    setFiltroNome('')
                    setFiltroCargo('')
                    setFiltroDepEstadual([])
                    setFiltroFaixaVotos('')
                  }}
                  className="text-xs text-accent-gold hover:underline"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {filtroDepEstadual.length > 0 && mapaVotoCruzado.length > 0 && (
          <div className="mb-6 bg-surface rounded-2xl border border-card p-4">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMapaVotoCruzado((v) => !v)}
                className="px-3 py-1.5 text-xs font-medium border border-card rounded-lg hover:bg-background transition-colors"
              >
                {showMapaVotoCruzado ? 'Ocultar mapa' : 'Mostrar mapa'}
              </button>
            </div>
            {showMapaVotoCruzado && (
              <div id="mapa-voto-cruzado-container">
                <MapaVotoCruzado
                  deputados={filtroDepEstadual}
                  cidades={mapaVotoCruzado}
                  onFullscreen={() => {
                    const container = document.getElementById('mapa-voto-cruzado-container')
                    if (!container) return
                    if (document.fullscreenElement) {
                      document.exitFullscreen()
                    } else {
                      container.requestFullscreen().catch(() => {})
                    }
                  }}
                />
              </div>
            )}
            {!showMapaVotoCruzado && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowMapaVotoCruzado(true)}
                  className="px-3 py-1.5 text-xs font-medium border border-card rounded-lg hover:bg-background transition-colors"
                >
                  Mostrar mapa de voto cruzado
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lista de Lideranças */}
        <div className="bg-surface rounded-2xl border border-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {(config || serverConfigured) ? 'Lideranças Atuais' : 'Lideranças'}
              </h2>
              {(config || serverConfigured) && (liderancaAtualCol || expectativaVotosCol) && (
                <p className="text-xs text-secondary mt-1">
                  Mostrando lideranças com "Liderança Atual?" = SIM ou com "Expectativa de Votos 2026"
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Botão Mapa Mental */}
              {(config || serverConfigured) && liderancasFiltradas.length > 0 && (
                <button
                  onClick={() => setShowMindMap(true)}
                  className="px-3 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors flex items-center gap-2"
                  title="Ver Mapa de Lideranças"
                >
                  <Network className="w-4 h-4" />
                  Mapa Mental
                </button>
              )}
              {(config || serverConfigured) && liderancasFiltradas.length > 0 && (() => {
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
                    className="px-3 py-1.5 text-xs font-medium border border-card rounded-lg hover:bg-background transition-colors flex items-center gap-2"
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
              {(config || serverConfigured) && (
                <div className="text-right">
                  <span className="text-sm font-semibold text-text-primary block">
                    {liderancasFiltradas.length}
                  </span>
                  <span className="text-xs text-secondary">
                    de {liderancas.length} registros
                  </span>
                </div>
              )}
            </div>
          </div>

          {filtroDepEstadual.length > 0 && (
            <div className="mb-4 p-3 rounded-xl border border-accent-gold-soft bg-accent-gold-soft/10">
              {(() => {
                const cidades = new Set(liderancasFiltradas.map((l) => String(l[cidadeCol] || 'Sem cidade')))
                const totalVotos = expectativaVotosCol
                  ? liderancasFiltradas.reduce((sum, l) => sum + normalizeNumber(l[expectativaVotosCol]), 0)
                  : 0

                return (
                  <p className="text-sm text-text-primary">
                    <span className="font-semibold">
                      Voto cruzado com {filtroDepEstadual.length} deputado(s):
                    </span>{' '}
                    {cidades.size} cidade{cidades.size !== 1 ? 's' : ''},{' '}
                    {liderancasFiltradas.length} liderança{liderancasFiltradas.length !== 1 ? 's' : ''}{' '}
                    {expectativaVotosCol ? `e ${Math.round(totalVotos).toLocaleString('pt-BR')} votos esperados em conjunto.` : '.'}
                  </p>
                )
              })()}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-background rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !(config || serverConfigured) ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-secondary mx-auto mb-4" />
              <p className="text-secondary mb-4">
                Configure uma planilha do Google Sheets para começar
              </p>
              <button
                onClick={() => setShowConfig(true)}
                className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors"
              >
                Conectar Planilha
              </button>
            </div>
          ) : liderancas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-secondary">Nenhum dado encontrado na planilha</p>
            </div>
          ) : liderancasFiltradas.length === 0 && liderancaAtualCol ? (
            <div className="text-center py-12">
              <p className="text-secondary mb-2">
                Nenhuma liderança atual encontrada
              </p>
              <p className="text-xs text-secondary">
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
              const totalA = liderancasPorCidade[a].reduce((sum: number, l: Lideranca) => {
                return sum + (expectativaVotosCol ? normalizeNumber(l[expectativaVotosCol]) : 0)
              }, 0)
              const totalB = liderancasPorCidade[b].reduce((sum: number, l: Lideranca) => {
                return sum + (expectativaVotosCol ? normalizeNumber(l[expectativaVotosCol]) : 0)
              }, 0)
              return totalB - totalA
            })

            return (
          <div className="space-y-3">
                {cidadesOrdenadas.map((cidade) => {
                  const liderancasCidade = liderancasPorCidade[cidade]
                  const totalExpectativaCidade = liderancasCidade.reduce((sum: number, l: Lideranca) => {
                    return sum + (expectativaVotosCol ? normalizeNumber(l[expectativaVotosCol]) : 0)
                  }, 0)
                  const isExpanded = expandedCities.has(cidade)

                  return (
                    <div
                      key={cidade}
                      className="rounded-xl border border-card overflow-hidden"
                    >
                      {/* Cabeçalho da Cidade */}
                      <div className="w-full p-4 bg-background flex items-center justify-between">
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
                          className="flex items-center gap-3 flex-1 hover:bg-background/80 transition-colors rounded-lg p-2 -m-2"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-secondary" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-secondary" />
                          )}
                          <div className="p-2 rounded-lg bg-accent-gold-soft">
                            <Users className="w-4 h-4 text-accent-gold" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-semibold text-text-primary">{cidade}</p>
                            <p className="text-xs text-secondary">
                              {liderancasCidade.length} liderança{liderancasCidade.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedCityForBriefing(cidade)
                              setSelectedCityLiderancas(liderancasCidade)
                              setShowExecutiveBriefing(true)
                            }}
                            className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-accent-gold"
                            title="Briefing Executivo"
                          >
                            <Briefcase className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedCityForDemands(cidade)
                              if (typeof window !== 'undefined') {
                                const liderancasFiltradasParaModal = liderancasCidade
                                  .map((lider: Lideranca) => String(lider[nomeCol] || '').trim())
                                  .filter((nome: string) => nome.length > 0)
                                sessionStorage.setItem(
                                  'territorio_demands_liderancas',
                                  JSON.stringify(liderancasFiltradasParaModal)
                                )
                              }
                              setShowCityDemands(true)
                            }}
                            className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-accent-gold"
                            title="Ver demandas desta cidade"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          {expectativaVotosCol && totalExpectativaCidade > 0 && (
                            <div className="text-right ml-2">
                              <p className="text-xs text-secondary mb-0.5">Total Esperado</p>
                              <p className="text-sm font-semibold text-accent-gold">
                                {Math.round(totalExpectativaCidade).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lista de Lideranças da Cidade */}
                      {isExpanded && (() => {
                        // Ordenar lideranças por expectativa de votos (decrescente)
                        const liderancasOrdenadas = [...liderancasCidade].sort((a, b) => {
                          const expectativaA = expectativaVotosCol ? normalizeNumber(a[expectativaVotosCol]) : 0
                          const expectativaB = expectativaVotosCol ? normalizeNumber(b[expectativaVotosCol]) : 0
                          return expectativaB - expectativaA
                        })

                        return (
                          <div className="border-t border-card bg-surface">
                            {liderancasOrdenadas.map((lider: Lideranca, idx: number) => {
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
                                className={`px-4 py-2.5 border-b border-card last:border-b-0 hover:bg-background/50 transition-colors ${
                                  isDestaque ? 'bg-status-warning/5 border-l-4 border-l-status-warning' : ''
                                }`}
                              >
                                {/* Identificar colunas inline (cargo, dep. estadual) — ordem: cargo primeiro */}
                                {(() => {
                                  const cargoInline = headers.find(h => /cargo.*2024/i.test(h) && h !== nomeCol && h !== cidadeCol && h !== expectativaVotosCol)
                                  const depEstadual = headers.find(h => /dep.*estadual|deputad.*estadual/i.test(h) && h !== nomeCol && h !== cidadeCol)
                                  const orderedCols = [cargoInline, depEstadual].filter(Boolean) as string[]
                                  const inlineInfo = orderedCols
                                    .map(h => lider[h] ? `${h}: ${lider[h]}` : null)
                                    .filter(Boolean)
                                    .join('  ·  ')

                                  return (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="p-1.5 rounded-lg bg-accent-gold-soft/50">
                                          <Users className="w-3 h-3 text-accent-gold" />
                                        </div>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <p className="text-sm font-semibold text-text-primary truncate">
                                            {lider[nomeCol] || 'Sem nome'}
                                          </p>
                                          {inlineInfo && (
                                            <span className="text-[11px] text-secondary truncate hidden sm:inline">
                                              {inlineInfo}
                                            </span>
                                          )}
                                          {isDestaque && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-status-warning/20 text-status-warning rounded-lg flex-shrink-0">
                                              Sem Lid. Atual
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 flex-shrink-0">
                                        {expectativaVotosCol && lider[expectativaVotosCol] && (
                                          <div className="text-right">
                                            <p className="text-[10px] text-secondary leading-tight">Previsão 2026</p>
                                            <p className="text-sm font-semibold text-accent-gold">
                                              {numValue.toLocaleString('pt-BR')}
                                            </p>
                                          </div>
                                        )}
                                        {scoreCol && lider[scoreCol] && (
                                          <div className="text-right">
                                            <p className="text-[10px] text-secondary leading-tight">Score</p>
                                            <p className="text-sm font-semibold text-text-primary">
                                              {lider[scoreCol]}
                                            </p>
                                          </div>
                                        )}
                                        {statusCol && lider[statusCol] && (
                                          <span
                                            className={`px-2 py-0.5 text-[10px] rounded-lg ${
                                              /ativo|active|sim/i.test(String(lider[statusCol]))
                                                ? 'bg-status-success/10 text-status-success'
                                                : 'bg-text-muted/10 text-secondary'
                                            }`}
                                          >
                                            {lider[statusCol]}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                            )
                          })}
                          </div>
                        )
                      })()}
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

      {/* Modal de Mapa Mental */}
      <MindMapModal
        isOpen={showMindMap}
        onClose={() => setShowMindMap(false)}
        liderancas={liderancasFiltradas}
        candidatoPadrao={candidatoPadrao || 'Candidato'}
        cidadeCol={cidadeCol || 'cidade'}
        nomeCol={nomeCol || 'nome'}
        expectativaVotosCol={expectativaVotosCol || null}
      />

      {/* Modal de Demandas por Cidade */}
      <CityDemandsModal
        isOpen={showCityDemands}
        onClose={() => {
          setShowCityDemands(false)
          setSelectedCityForDemands('')
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('territorio_demands_liderancas')
          }
        }}
        cidade={selectedCityForDemands}
      />

      {/* Modal de Briefing Executivo */}
      {showExecutiveBriefing && (
        <ExecutiveBriefingModal
          isOpen={showExecutiveBriefing}
          onClose={() => {
            setShowExecutiveBriefing(false)
            setSelectedCityForBriefing('')
            setSelectedCityLiderancas([])
          }}
          cidade={selectedCityForBriefing}
          liderancas={selectedCityLiderancas}
          expectativaVotosCol={expectativaVotosCol}
          nomeCol={nomeCol}
        />
      )}
    </div>
  )
}

