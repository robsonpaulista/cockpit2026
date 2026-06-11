'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PremiumMetricCard } from '@/components/premium/metric-card'
import { MunicipalityListItem } from '@/components/territorio/municipality-list-item'
import { GoogleSheetsConfigModal } from '@/components/google-sheets-config-modal'
import {
  IconAlertCircle,
  IconBriefcase,
  IconCheck,
  IconChevronDown,
  IconFileText,
  IconMapPin,
  IconNetwork,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconTarget,
  IconUsers,
  IconX,
} from '@tabler/icons-react'
import { MindMapModal } from '@/components/mind-map-modal'
import { CityDemandsModal } from '@/components/city-demands-modal'
import { ExecutiveBriefingModal } from '@/components/executive-briefing-modal'
import { VoteInvestmentBalanceModal } from '@/components/vote-investment-balance-modal'
import { MapaVotoCruzado } from '@/components/mapa-voto-cruzado'
import { KPI } from '@/types'
import { cn } from '@/lib/utils'
import {
  cargoChipClass,
  ghostButtonClass,
  pillFilterActiveClass,
  pillFilterIdleClass,
  pillInputClass,
} from '@/lib/premium-ui-classes'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { useTheme } from '@/contexts/theme-context'
import type { AIAgentPageContext } from '@/components/ai-agent'
import { useRegisterJarvisHostProps } from '@/contexts/jarvis-host-props-context'

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

type CenarioVotos = 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior'

export default function TerritorioPage() {
  const { theme } = useTheme()
  const isCockpit = false
  const accentTextClass = isCockpit ? 'text-[#2dd4bf]' : 'text-accent-gold'
  const accentBorderClass = isCockpit ? 'border-[#2dd4bf]' : 'border-accent-gold'
  const sectionShellClass = isCockpit
    ? 'border-white/12 bg-[linear-gradient(165deg,rgba(22,34,44,0.82)_0%,rgba(18,30,38,0.86)_100%)] shadow-[0_10px_32px_rgba(3,12,20,0.28)]'
    : 'border-card bg-surface shadow-card'
  const innerPanelClass = isCockpit
    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)]'
    : 'border-card bg-background/50'
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
  const [showVoteInvestmentBalance, setShowVoteInvestmentBalance] = useState(false)
  const [selectedCityForBriefing, setSelectedCityForBriefing] = useState<string>('')
  const [selectedCityLiderancas, setSelectedCityLiderancas] = useState<Lideranca[]>([])
  const [cenarioVotos, setCenarioVotos] = useState<CenarioVotos>('legado_anterior')
  const depDropdownRef = useRef<HTMLDivElement | null>(null)
  const depDropdownButtonRef = useRef<HTMLButtonElement | null>(null)
  const depDropdownMenuRef = useRef<HTMLDivElement | null>(null)
  const [depMenuPos, setDepMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)

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

  const updateDepMenuPosition = useCallback(() => {
    const el = depDropdownButtonRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const panelMin = 224
    const width = Math.max(r.width, panelMin)
    let left = r.left
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8)
    setDepMenuPos({ top: r.bottom + 4, left, width })
  }, [])

  useLayoutEffect(() => {
    if (!showDepDropdown) {
      setDepMenuPos(null)
      return
    }
    updateDepMenuPosition()
    window.addEventListener('scroll', updateDepMenuPosition, true)
    window.addEventListener('resize', updateDepMenuPosition)
    return () => {
      window.removeEventListener('scroll', updateDepMenuPosition, true)
      window.removeEventListener('resize', updateDepMenuPosition)
    }
  }, [showDepDropdown, updateDepMenuPosition])

  useEffect(() => {
    if (!showDepDropdown) return

    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node
      if (depDropdownRef.current?.contains(t)) return
      if (depDropdownMenuRef.current?.contains(t)) return
      setShowDepDropdown(false)
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
  const expectativaJadyelCol = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    return /expectativa.*jadyel.*2026/i.test(normalized) ||
           /expectativa.*2026.*jadyel/i.test(normalized) ||
           /aferid[oa].*2026/i.test(normalized)
  })
  const promessaLiderancaCol = headers.find((h) => /promessa.*lideran[cç]a.*2026/i.test(h))
  const expectativaLegadoCol = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    return /^expectativa\s+de\s+votos\s+2026$/i.test(h) ||
      (/expectativa.*votos.*2026/i.test(h) && !/jadyel/i.test(normalized) && !/promessa/i.test(normalized) && !/aferid[oa]/i.test(normalized))
  })

  const votosReferenciaCol = (() => {
    if (cenarioVotos === 'promessa_lideranca') {
      return promessaLiderancaCol || expectativaJadyelCol || expectativaLegadoCol
    }
    if (cenarioVotos === 'legado_anterior') {
      return expectativaLegadoCol || expectativaJadyelCol || promessaLiderancaCol
    }
    return expectativaJadyelCol || expectativaLegadoCol || promessaLiderancaCol
  })()

  const labelCenarioVotos =
    cenarioVotos === 'promessa_lideranca'
      ? 'Promessa da Liderança 2026'
      : cenarioVotos === 'legado_anterior'
        ? 'Expectativa de Votos 2026 (Anterior)'
        : 'Expectativa Jadyel 2026'
  const labelVotosResumo =
    cenarioVotos === 'promessa_lideranca'
      ? 'votos prometidos'
      : cenarioVotos === 'legado_anterior'
        ? 'votos previstos (anterior)'
        : 'votos aferidos'
  const labelTotalCidade =
    cenarioVotos === 'promessa_lideranca'
      ? 'votos prometidos'
      : cenarioVotos === 'legado_anterior'
        ? 'votos anteriores'
        : 'votos aferidos'
  const labelValorLideranca =
    cenarioVotos === 'promessa_lideranca'
      ? 'Promessa 2026'
      : cenarioVotos === 'legado_anterior'
        ? 'Anterior 2026'
        : 'Aferido 2026'

  useEffect(() => {
    if (cenarioVotos === 'promessa_lideranca' && !promessaLiderancaCol) {
      if (expectativaJadyelCol) {
        setCenarioVotos('aferido_jadyel')
      } else if (expectativaLegadoCol) {
        setCenarioVotos('legado_anterior')
      }
      return
    }
    if (cenarioVotos === 'aferido_jadyel' && !expectativaJadyelCol) {
      if (expectativaLegadoCol) {
        setCenarioVotos('legado_anterior')
      } else if (promessaLiderancaCol) {
        setCenarioVotos('promessa_lideranca')
      }
      return
    }
    if (cenarioVotos === 'legado_anterior' && !expectativaLegadoCol) {
      if (expectativaJadyelCol) {
        setCenarioVotos('aferido_jadyel')
      } else if (promessaLiderancaCol) {
        setCenarioVotos('promessa_lideranca')
      }
    }
  }, [cenarioVotos, promessaLiderancaCol, expectativaJadyelCol, expectativaLegadoCol])

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

  // Filtrar lideranças: incluir "Liderança Atual?" = SIM OU que tenham valor no cenário de votos selecionado
  const liderancasFiltradas = (() => {
    if (liderancas.length === 0) return []

    if (!liderancaAtualCol && !votosReferenciaCol) {
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

      // Se tem valor no cenário de votos selecionado, incluir também
      if (votosReferenciaCol) {
        const expectativaValue = normalizeNumber(l[votosReferenciaCol])
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
    if (filtroFaixaVotos && votosReferenciaCol) {
      // Agrupar por cidade e calcular total de votos por cidade
      const votosPorCidade = filtradas.reduce((acc, l) => {
        const cidade = l[cidadeCol] || 'Sem cidade'
        if (!acc[cidade]) {
          acc[cidade] = 0
        }
        acc[cidade] += normalizeNumber(l[votosReferenciaCol])
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
      const votos = votosReferenciaCol ? normalizeNumber(lider[votosReferenciaCol]) : 0

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
  }, [liderancasFiltradas, cidadeCol, votosReferenciaCol, depEstadualCol, cargoCol])

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

    // Calcular total de votos no cenário selecionado
    let totalExpectativaVotos = 0
    if (votosReferenciaCol) {
      totalExpectativaVotos = dadosParaKPIs.reduce((sum, l) => {
        const value = l[votosReferenciaCol]
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
      ...(votosReferenciaCol && totalExpectativaVotos > 0
        ? [
            {
              id: 'expectativa-votos',
              label:
                cenarioVotos === 'promessa_lideranca'
                  ? 'Promessa 2026'
                  : cenarioVotos === 'legado_anterior'
                    ? 'Expectativa 2026'
                    : 'Aferido 2026',
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

  const cidadesUnicasCount = new Set(
    liderancasFiltradas.map((l) => l[cidadeCol] || 'Sem cidade')
  ).size
  const todasExpandidas =
    expandedCities.size === cidadesUnicasCount && cidadesUnicasCount > 0
  const hasFiltrosAtivos =
    Boolean(filtroCidade) ||
    Boolean(filtroNome) ||
    Boolean(filtroCargo) ||
    filtroDepEstadual.length > 0 ||
    Boolean(filtroFaixaVotos)
  const pageSubtitle = hasFiltrosAtivos
    ? `${liderancasFiltradas.length} ativas · filtros aplicados`
    : `${liderancasFiltradas.length} ativas · ${liderancas.length} registros totais`

  const cidadesParaAnaliseInvestimento = useMemo(() => {
    const agrupado = liderancasFiltradas.reduce((acc, lider) => {
      const cidade = String(lider[cidadeCol] || 'Sem cidade').trim() || 'Sem cidade'
      if (!acc[cidade]) {
        acc[cidade] = { previsaoVotos: 0, liderancas: 0 }
      }
      acc[cidade].liderancas += 1
      if (votosReferenciaCol) {
        acc[cidade].previsaoVotos += normalizeNumber(lider[votosReferenciaCol])
      }
      return acc
    }, {} as Record<string, { previsaoVotos: number; liderancas: number }>)

    return Object.entries(agrupado)
      .map(([cidade, info]) => ({
        cidade,
        previsaoVotos: Math.round(info.previsaoVotos),
        liderancas: info.liderancas,
      }))
      .sort((a, b) => b.previsaoVotos - a.previsaoVotos)
  }, [liderancasFiltradas, cidadeCol, votosReferenciaCol])

  const liderancasPorCidadeMap = useMemo(() => {
    const acc: Record<string, Lideranca[]> = {}
    for (const l of liderancasFiltradas) {
      const c = String(l[cidadeCol] || '').trim() || 'Sem cidade'
      if (!acc[c]) acc[c] = []
      acc[c].push(l)
    }
    return acc
  }, [liderancasFiltradas, cidadeCol])

  const cidadesTerritorioLista = useMemo(
    () => Object.keys(liderancasPorCidadeMap).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [liderancasPorCidadeMap]
  )

  const cidadesExpandidasLista = useMemo(() => Array.from(expandedCities), [expandedCities])

  const territorioAgentActionsRef = useRef({
    alternarLiderancasCidade: (_nomeCidade: string, _expandir?: boolean) => {},
    recolherTodasCidades: () => {},
    abrirObrasCidade: (_nomeCidade: string): boolean => false,
    fecharModalObras: () => {},
    atualizarDados: () => {},
  })

  territorioAgentActionsRef.current = {
    alternarLiderancasCidade: (nomeCidade, expandir) => {
      setExpandedCities((prev) => {
        const next = new Set(prev)
        const isExpanded = next.has(nomeCidade)
        if (expandir === true) next.add(nomeCidade)
        else if (expandir === false) next.delete(nomeCidade)
        else if (isExpanded) next.delete(nomeCidade)
        else next.add(nomeCidade)
        return next
      })
    },
    recolherTodasCidades: () => setExpandedCities(new Set()),
    abrirObrasCidade: (nomeCidade) => {
      const liderancasCidade = liderancasPorCidadeMap[nomeCidade]
      if (!liderancasCidade?.length) return false
      setSelectedCityForDemands(nomeCidade)
      if (typeof window !== 'undefined') {
        const nomes = liderancasCidade
          .map((lider) => String(lider[nomeCol] || '').trim())
          .filter((nome) => nome.length > 0)
        sessionStorage.setItem('territorio_demands_liderancas', JSON.stringify(nomes))
      }
      setShowCityDemands(true)
      return true
    },
    fecharModalObras: () => {
      setShowCityDemands(false)
      setSelectedCityForDemands('')
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('territorio_demands_liderancas')
      }
    },
    atualizarDados: () => {
      if (serverConfigured) {
        void fetchDataFromServer()
      } else if (config) {
        void fetchData(config)
      }
    },
  }

  const territorioAgentPageActions = useMemo(
    () => ({
      alternarLiderancasCidade: (nomeCidade: string, expandir?: boolean) =>
        territorioAgentActionsRef.current.alternarLiderancasCidade(nomeCidade, expandir),
      recolherTodasCidades: () => territorioAgentActionsRef.current.recolherTodasCidades(),
      abrirObrasCidade: (nomeCidade: string) =>
        territorioAgentActionsRef.current.abrirObrasCidade(nomeCidade),
      fecharModalObras: () => territorioAgentActionsRef.current.fecharModalObras(),
      atualizarDados: () => territorioAgentActionsRef.current.atualizarDados(),
    }),
    []
  )

  const contextoAgenteTerritorio = useMemo<AIAgentPageContext>(
    () => ({
      kind: 'territorio',
      cidades: cidadesTerritorioLista,
      loading,
      planilhaConfigurada: Boolean(config || serverConfigured),
      cidadesExpandidas: cidadesExpandidasLista,
      modalObrasAberto: showCityDemands,
      cidadeObrasAtual: selectedCityForDemands,
      ...territorioAgentPageActions,
    }),
    [
      cidadesTerritorioLista,
      loading,
      config,
      serverConfigured,
      cidadesExpandidasLista,
      showCityDemands,
      selectedCityForDemands,
      territorioAgentPageActions,
    ]
  )

  const jarvisHostProps = useMemo(
    () => ({
      pageContext: contextoAgenteTerritorio,
      loadingKPIs: loading,
      loadingTerritorios: loading,
      kpisCount: liderancasFiltradas.length > 0 ? 4 : 0,
      expectativa2026: kpis.find((k) => k.id === 'expectativa-votos')?.value,
      candidatoPadrao: candidatoPadrao || undefined,
    }),
    [contextoAgenteTerritorio, loading, liderancasFiltradas.length, kpis, candidatoPadrao]
  )

  useRegisterJarvisHostProps(jarvisHostProps)


  return (
    <div className={cn('min-h-screen', isCockpit ? 'sidebar-cockpit-shell' : 'bg-bg-surface')}>

      <div className="px-4 py-4 lg:px-4">
        {/* Cabeçalho da página */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-sm font-medium text-text-primary">Território & base</h1>
            <p className="mt-0.5 text-xs text-text-muted">
              {(config || serverConfigured) && liderancas.length > 0
                ? pageSubtitle
                : 'Configure a planilha para carregar lideranças'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {(config || serverConfigured) && liderancasFiltradas.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowMindMap(true)}
                  className={ghostButtonClass}
                  title="Ver mapa de lideranças"
                >
                  <IconNetwork className="h-[14px] w-[14px] opacity-70" stroke={1.5} aria-hidden />
                  Mapa mental
                </button>
                {votosReferenciaCol ? (
                  <button
                    type="button"
                    onClick={() => setShowVoteInvestmentBalance(true)}
                    className={ghostButtonClass}
                    title="Analisar equilíbrio entre investimento e previsão de votos"
                  >
                    <IconBriefcase className="h-[14px] w-[14px] opacity-70" stroke={1.5} aria-hidden />
                    Demandas
                  </button>
                ) : null}
              </>
            )}
            {(config || serverConfigured) && (
              <button
                type="button"
                onClick={() => territorioAgentActionsRef.current.atualizarDados()}
                disabled={loading}
                className={cn(ghostButtonClass, 'disabled:opacity-50')}
              >
                <IconRefresh
                  className={cn('h-[14px] w-[14px] opacity-70', loading && 'animate-spin')}
                  stroke={1.5}
                  aria-hidden
                />
                Atualizar
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowConfig(true)}
              className={sidebarPrimaryCTAButtonClass(isCockpit)}
            >
              <IconSettings className="h-[14px] w-[14px] shrink-0 text-white" stroke={1.5} aria-hidden />
              {(config || serverConfigured) ? 'Configurar planilha' : 'Conectar planilha'}
            </button>
          </div>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-status-error/30 bg-status-error/10 p-4">
            <IconAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-error" stroke={1.5} />
            <div className="flex-1">
              <p className="text-sm font-medium text-status-error">Erro ao carregar dados</p>
              <p className="mt-1 text-xs text-text-secondary">{error}</p>
            </div>
          </div>
        )}

        {/* KPIs - Só mostrar se houver configuração e dados */}
        {(config || serverConfigured) && liderancas.length > 0 && (
          <section className="mb-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {kpis.map((kpi) => {
                const metricIcon =
                  kpi.id === 'liderancas'
                    ? IconUsers
                    : kpi.id === 'total'
                      ? IconFileText
                      : kpi.id === 'expectativa-votos'
                        ? IconTarget
                        : IconMapPin
                const contextLine =
                  kpi.id === 'liderancas'
                    ? `de ${liderancas.length} registros totais`
                    : kpi.id === 'total'
                      ? 'na planilha conectada'
                      : kpi.id === 'expectativa-votos'
                        ? labelCenarioVotos
                        : `${cidadesUnicasCount} municípios na base filtrada`

                return (
                  <PremiumMetricCard
                    key={kpi.id}
                    label={kpi.label}
                    value={kpi.value}
                    contextLine={contextLine}
                    icon={metricIcon}
                  />
                )
              })}
            </div>

            {totaisPorCargo.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {totaisPorCargo.slice(0, 8).map((item) => (
                  <span key={item.cargo} className={cargoChipClass}>
                    <span className="font-medium text-[rgb(var(--color-primary))]">{item.total}</span>
                    <span className="text-text-muted">{item.cargo}</span>
                  </span>
                ))}
                {totaisPorCargo.length > 8 && (
                  <span className={cn(cargoChipClass, 'text-text-muted')}>
                    +{totaisPorCargo.length - 8} outros
                  </span>
                )}
              </div>
            )}
          </section>
        )}

        {(config || serverConfigured) && liderancas.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                <label className="relative shrink-0">
                  <IconSearch
                    className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-text-muted opacity-70"
                    stroke={1.5}
                    aria-hidden
                  />
                  <input
                    type="text"
                    value={filtroCidade}
                    onChange={(e) => setFiltroCidade(e.target.value)}
                    placeholder="Buscar cidade…"
                    className={cn(pillInputClass, 'w-[9.5rem] pl-8 sm:w-[10.5rem]')}
                  />
                </label>

                <label className="relative shrink-0">
                  <IconSearch
                    className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-text-muted opacity-70"
                    stroke={1.5}
                    aria-hidden
                  />
                  <input
                    type="text"
                    value={filtroNome}
                    onChange={(e) => setFiltroNome(e.target.value)}
                    placeholder="Buscar liderança…"
                    className={cn(pillInputClass, 'w-[9.5rem] pl-8 sm:w-[10.5rem]')}
                  />
                </label>

                <span className="hidden h-4 w-px shrink-0 bg-[rgb(var(--color-border-tertiary))] sm:block" aria-hidden />

                {cargoCol && cargosUnicos.length > 0 ? (
                  filtroCargo ? (
                    <span className={pillFilterActiveClass}>
                      {filtroCargo}
                      <button
                        type="button"
                        onClick={() => setFiltroCargo('')}
                        className="ml-0.5 inline-flex opacity-80 hover:opacity-100"
                        aria-label="Limpar filtro de cargo"
                      >
                        <IconX className="h-3 w-3" stroke={2} />
                      </button>
                    </span>
                  ) : (
                    <select
                      value={filtroCargo}
                      onChange={(e) => setFiltroCargo(e.target.value)}
                      className={cn(pillFilterIdleClass, 'cursor-pointer appearance-none pr-6')}
                      aria-label="Filtrar por cargo"
                    >
                      <option value="">Cargo</option>
                      {cargosUnicos.map((cargo) => (
                        <option key={cargo} value={cargo}>
                          {cargo}
                        </option>
                      ))}
                    </select>
                  )
                ) : null}

                {deputadosEstaduaisUnicos.length > 0 ? (
                  <div className="relative shrink-0" ref={depDropdownRef}>
                    {filtroDepEstadual.length > 0 ? (
                      <span className={pillFilterActiveClass}>
                        {filtroDepEstadual.length === deputadosEstaduaisUnicos.length
                          ? 'Todos os dep.'
                          : `${filtroDepEstadual.length} dep.`}
                        <button
                          type="button"
                          onClick={() => setFiltroDepEstadual([])}
                          className="ml-0.5 inline-flex opacity-80 hover:opacity-100"
                          aria-label="Limpar filtro de deputado estadual"
                        >
                          <IconX className="h-3 w-3" stroke={2} />
                        </button>
                        <button
                          ref={depDropdownButtonRef}
                          type="button"
                          onClick={() => setShowDepDropdown((v) => !v)}
                          className="ml-1 inline-flex opacity-80 hover:opacity-100"
                          aria-label="Editar filtro de deputado estadual"
                        >
                          <IconChevronDown
                            className={cn('h-3 w-3 transition-transform', showDepDropdown && 'rotate-180')}
                            stroke={2}
                          />
                        </button>
                      </span>
                    ) : (
                      <button
                        ref={depDropdownButtonRef}
                        type="button"
                        onClick={() => setShowDepDropdown((v) => !v)}
                        title="Voto cruzado: selecione um ou mais deputados"
                        className={pillFilterIdleClass}
                      >
                        Dep. estadual
                        <IconChevronDown
                          className={cn('h-3 w-3 opacity-70 transition-transform', showDepDropdown && 'rotate-180')}
                          stroke={2}
                        />
                      </button>
                    )}
                  </div>
                ) : null}

                {expectativaJadyelCol || promessaLiderancaCol || expectativaLegadoCol ? (
                  <select
                    value={cenarioVotos}
                    onChange={(e) => setCenarioVotos(e.target.value as CenarioVotos)}
                    className={cn(pillFilterIdleClass, 'cursor-pointer appearance-none')}
                    aria-label="Visão de votos"
                  >
                    {expectativaJadyelCol ? (
                      <option value="aferido_jadyel">Aferido 2026</option>
                    ) : null}
                    {promessaLiderancaCol ? (
                      <option value="promessa_lideranca">Prometido 2026</option>
                    ) : null}
                    {expectativaLegadoCol ? (
                      <option value="legado_anterior">Anterior 2026</option>
                    ) : null}
                  </select>
                ) : null}

                {votosReferenciaCol ? (
                  filtroFaixaVotos ? (
                    <span className={pillFilterActiveClass}>
                      {filtroFaixaVotos === 'ate-100'
                        ? 'Até 100'
                        : filtroFaixaVotos === 'ate-300'
                          ? 'Até 300'
                          : filtroFaixaVotos === 'ate-500'
                            ? 'Até 500'
                            : filtroFaixaVotos === 'acima-500'
                              ? 'Acima de 500'
                              : 'Acima de 1000'}
                      <button
                        type="button"
                        onClick={() => setFiltroFaixaVotos('')}
                        className="ml-0.5 inline-flex opacity-80 hover:opacity-100"
                        aria-label="Limpar faixa de votos"
                      >
                        <IconX className="h-3 w-3" stroke={2} />
                      </button>
                    </span>
                  ) : (
                    <select
                      value={filtroFaixaVotos}
                      onChange={(e) => setFiltroFaixaVotos(e.target.value)}
                      className={cn(pillFilterIdleClass, 'cursor-pointer appearance-none')}
                      aria-label="Faixa de votos"
                    >
                      <option value="">Faixa de votos</option>
                      <option value="ate-100">Até 100</option>
                      <option value="ate-300">Até 300</option>
                      <option value="ate-500">Até 500</option>
                      <option value="acima-500">Acima de 500</option>
                      <option value="acima-1000">Acima de 1000</option>
                    </select>
                  )
                ) : null}
              </div>

              {liderancasFiltradas.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (todasExpandidas) {
                      setExpandedCities(new Set())
                    } else {
                      setExpandedCities(
                        new Set(liderancasFiltradas.map((l) => l[cidadeCol] || 'Sem cidade'))
                      )
                    }
                  }}
                  className={cn(ghostButtonClass, 'ml-auto shrink-0 text-[11.5px]')}
                >
                  {todasExpandidas ? 'Recolher todas' : 'Expandir todas'}
                </button>
              )}
            </div>

            {hasFiltrosAtivos && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-text-muted">
                  {liderancasFiltradas.length} resultado{liderancasFiltradas.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroCidade('')
                    setFiltroNome('')
                    setFiltroCargo('')
                    setFiltroDepEstadual([])
                    setFiltroFaixaVotos('')
                  }}
                  className="text-[11px] font-medium text-[rgb(var(--color-primary))] hover:underline"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {showDepDropdown && depMenuPos && typeof document !== 'undefined'
          ? createPortal(
              <div
                ref={depDropdownMenuRef}
                className="fixed z-[10000] max-w-[min(calc(100vw-1rem),20rem)] rounded-lg border border-card bg-surface shadow-xl"
                style={{
                  top: depMenuPos.top,
                  left: depMenuPos.left,
                  minWidth: depMenuPos.width,
                }}
              >
                <div className="max-h-56 overflow-auto p-1">
                  {deputadosEstaduaisUnicos.map((dep) => {
                    const checked = filtroDepEstadual.includes(dep)
                    return (
                      <button
                        key={dep}
                        type="button"
                        onClick={() => toggleDepEstadual(dep)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-background"
                      >
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${checked ? `${accentBorderClass} ${isCockpit ? 'bg-[#2dd4bf]' : 'bg-accent-gold'}` : 'border-card bg-white'}`}
                        >
                          {checked ? <IconCheck className="h-2.5 w-2.5 text-white" stroke={2.5} /> : null}
                        </span>
                        <span className="truncate">{dep}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between border-t border-card p-2">
                  <span className="text-[10px] text-secondary">{filtroDepEstadual.length} sel.</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFiltroDepEstadual(deputadosEstaduaisUnicos)}
                      className={cn('text-[10px] hover:underline disabled:opacity-50', accentTextClass)}
                      disabled={filtroDepEstadual.length === deputadosEstaduaisUnicos.length}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroDepEstadual([])}
                      className={cn('text-[10px] hover:underline', accentTextClass)}
                    >
                      Limpar
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        {filtroDepEstadual.length > 0 && mapaVotoCruzado.length > 0 && (
          <div className={cn('mb-6 rounded-2xl border p-4', sectionShellClass)}>
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

        <div className="mt-2">
          {(config || serverConfigured) && (liderancaAtualCol || votosReferenciaCol) && (
            <p className="mb-3 text-[11px] text-text-muted">
              Mostrando lideranças com liderança atual = sim ou com {labelCenarioVotos.toLowerCase()}
            </p>
          )}

          {filtroDepEstadual.length > 0 && (
            <div className="mb-4 p-3 rounded-xl border border-accent-gold-soft bg-accent-gold-soft/10">
              {(() => {
                const cidades = new Set(liderancasFiltradas.map((l) => String(l[cidadeCol] || 'Sem cidade')))
                const totalVotos = votosReferenciaCol
                  ? liderancasFiltradas.reduce((sum, l) => sum + normalizeNumber(l[votosReferenciaCol]), 0)
                  : 0

                return (
                  <p className="text-sm text-text-primary">
                    <span className="font-semibold">
                      Voto cruzado com {filtroDepEstadual.length} deputado(s):
                    </span>{' '}
                    {cidades.size} cidade{cidades.size !== 1 ? 's' : ''},{' '}
                    {liderancasFiltradas.length} liderança{liderancasFiltradas.length !== 1 ? 's' : ''}{' '}
                    {votosReferenciaCol ? `e ${Math.round(totalVotos).toLocaleString('pt-BR')} ${labelVotosResumo} em conjunto.` : '.'}
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
            <div className="py-12 text-center">
              <IconUsers className="mx-auto mb-4 h-12 w-12 text-text-muted opacity-70" stroke={1.5} />
              <p className="mb-4 text-text-secondary">
                Configure uma planilha do Google Sheets para começar
              </p>
              <button
                type="button"
                onClick={() => setShowConfig(true)}
                className={sidebarPrimaryCTAButtonClass(isCockpit)}
              >
                Conectar planilha
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
            const liderancasPorCidade = liderancasFiltradas.reduce((acc, lider) => {
              const cidade = lider[cidadeCol] || 'Sem cidade'
              if (!acc[cidade]) acc[cidade] = []
              acc[cidade].push(lider)
              return acc
            }, {} as Record<string, typeof liderancasFiltradas>)

            const cidadesOrdenadas = Object.keys(liderancasPorCidade).sort((a, b) => {
              const totalA = liderancasPorCidade[a].reduce(
                (sum: number, l: Lideranca) =>
                  sum + (votosReferenciaCol ? normalizeNumber(l[votosReferenciaCol]) : 0),
                0
              )
              const totalB = liderancasPorCidade[b].reduce(
                (sum: number, l: Lideranca) =>
                  sum + (votosReferenciaCol ? normalizeNumber(l[votosReferenciaCol]) : 0),
                0
              )
              return totalB - totalA
            })

            return (
              <div>
                {cidadesOrdenadas.map((cidade) => {
                  const liderancasCidade = liderancasPorCidade[cidade]
                  const totalExpectativaCidade = liderancasCidade.reduce(
                    (sum: number, l: Lideranca) =>
                      sum + (votosReferenciaCol ? normalizeNumber(l[votosReferenciaCol]) : 0),
                    0
                  )
                  const isExpanded = expandedCities.has(cidade)

                  return (
                    <MunicipalityListItem
                      key={cidade}
                      cidade={cidade}
                      liderancasCidade={liderancasCidade}
                      isExpanded={isExpanded}
                      onToggle={() => {
                        territorioAgentActionsRef.current.alternarLiderancasCidade(cidade)
                      }}
                      onBriefing={(e) => {
                        e.stopPropagation()
                        setSelectedCityForBriefing(cidade)
                        setSelectedCityLiderancas(liderancasCidade)
                        setShowExecutiveBriefing(true)
                      }}
                      onObras={(e) => {
                        e.stopPropagation()
                        territorioAgentActionsRef.current.abrirObrasCidade(cidade)
                      }}
                      totalVotos={totalExpectativaCidade}
                      votosLabel={labelTotalCidade}
                      nomeCol={nomeCol}
                      cargoCol={cargoCol}
                      votosReferenciaCol={votosReferenciaCol}
                      normalizeNumber={normalizeNumber}
                    />
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
        expectativaVotosCol={votosReferenciaCol || null}
      />

      {/* Modal de Demandas por Cidade */}
      <CityDemandsModal
        isOpen={showCityDemands}
        onClose={() => territorioAgentActionsRef.current.fecharModalObras()}
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
          expectativaVotosCol={votosReferenciaCol}
          nomeCol={nomeCol}
        />
      )}

      <VoteInvestmentBalanceModal
        isOpen={showVoteInvestmentBalance}
        onClose={() => setShowVoteInvestmentBalance(false)}
        cidades={cidadesParaAnaliseInvestimento}
        cenarioLabel={labelCenarioVotos}
      />
    </div>
  )
}

