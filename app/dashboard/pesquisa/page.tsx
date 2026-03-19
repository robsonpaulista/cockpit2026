'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { KPICard } from '@/components/kpi-card'
import { PollModal } from '@/components/poll-modal'
import { PollReportModal } from '@/components/poll-report-modal'
import { Plus, Edit2, Trash2, Maximize2, X, ArrowLeft, FileText } from 'lucide-react'
import { KPI } from '@/types'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Customized } from 'recharts'
import { formatDate } from '@/lib/utils'

interface Poll {
  id: string
  data: string
  instituto: string
  candidato_nome: string
  tipo: 'estimulada' | 'espontanea'
  cargo: 'dep_estadual' | 'dep_federal' | 'governador' | 'senador' | 'presidente'
  cidade_id?: string | null
  intencao: number
  rejeicao: number
  created_at?: string
  cities?: {
    id: string
    name: string
  }
}

const cargoLabels: Record<string, string> = {
  dep_estadual: 'Dep. Estadual',
  dep_federal: 'Dep. Federal',
  governador: 'Governador',
  senador: 'Senador',
  presidente: 'Presidente',
}

const tipoLabels: Record<string, string> = {
  estimulada: 'Estimulada',
  espontanea: 'Espontânea',
}

const POLLS_FETCH_LIMIT = 5000

// Função para distribuir rótulos evitando sobreposição
function distributeY(labels: { name: string; color: string; y: number }[], minGap = 14) {
  // Evita sobreposição (simples e eficiente)
  const sorted = [...labels].sort((a, b) => a.y - b.y)

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - sorted[i - 1].y < minGap) {
      sorted[i].y = sorted[i - 1].y + minGap
    }
  }

  return sorted
}

// Componente Customized para renderizar rótulos no lado direito usando coordenadas reais
function RightSideLabels(props: any) {
  const { formattedGraphicalItems, offset } = props
  const { left, top, width, height } = offset

  // Pega todas as linhas (Line) e seus pontos
  const lines = (formattedGraphicalItems || [])
    .flatMap((item: any) => {
      // Verifica se é uma Line
      if (item?.item?.type?.name === "Line" || item?.item?.type?.displayName === "Line") {
        return [item]
      }
      return []
    })
    .filter(Boolean)

  // Mapeia candidatos para nomes legíveis
  const rawLabels = lines
    .map((lineWrap: any) => {
      const lineProps = lineWrap?.props || lineWrap?.item?.props
      const dataKey = lineProps?.dataKey as string
      const stroke = lineProps?.stroke as string

      // Tenta pegar os pontos de diferentes formas
      const points = lineWrap?.item?.props?.points || 
                     lineWrap?.props?.points || 
                     lineWrap?.points ||
                     []

      if (!points?.length) return null

      const last = points[points.length - 1]
      if (!last || last.y === undefined) return null

      // Extrai nome do candidato da chave (ex: "intencao_Jadyel_Alencar" -> "Jadyel Alencar")
      const nomeCandidato = dataKey
        .replace('intencao_', '')
        .replace(/_/g, ' ')

      return {
        name: nomeCandidato,
        color: stroke || "#111",
        y: last.y,
      }
    })
    .filter(Boolean) as { name: string; color: string; y: number }[]

  const labels = distributeY(rawLabels, 14)
  const xText = left + width + 10 // Lado direito do plot

  return (
    <g>
      {labels.map((l, index) => {
        // Corta se sair da área visível
        const y = Math.max(top + 8, Math.min(top + height - 8, l.y))
        return (
          <g key={`label_${index}_${l.name}`}>
            {/* Círculo colorido */}
            <circle
              cx={xText - 8}
              cy={y}
              r={4}
              fill={l.color}
              stroke="white"
              strokeWidth={1}
            />
            {/* Nome do candidato */}
            <text
              x={xText}
              y={y}
              fill={l.color}
              fontSize={12}
              fontWeight={600}
              dominantBaseline="middle"
              style={{ textShadow: '0 0 2px rgba(255,255,255,0.9)' }}
            >
              {l.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export default function PesquisaPage() {
  const searchParams = useSearchParams()
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null)
  const [tipoGrafico, setTipoGrafico] = useState<'estimulada' | 'espontanea' | 'todas'>('todas')
  const [filtroCargo, setFiltroCargo] = useState<string>('')
  const [filtroCidade, setFiltroCidade] = useState<string>('')
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([])
  const [candidatoPadrao, setCandidatoPadrao] = useState<string>('')
  const [graficoTelaCheia, setGraficoTelaCheia] = useState(false)
  const [pollParaRelatorio, setPollParaRelatorio] = useState<Poll | null>(null)
  const [openedReportFromQuery, setOpenedReportFromQuery] = useState<string | null>(null)

  const normalizeCityName = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()

  const cidadeSelecionadaNome =
    cities.find((city) => city.id === filtroCidade)?.name || searchParams.get('cidade') || ''

  const hrefResumoEleicoes = cidadeSelecionadaNome
    ? `/dashboard/resumo-eleicoes?cidade=${encodeURIComponent(cidadeSelecionadaNome)}&returnFromPesquisa=1`
    : '/dashboard/resumo-eleicoes?returnFromPesquisa=1'

  useEffect(() => {
    fetchPolls()
    fetchCities()
    
    // Carregar candidato padrão do localStorage
    const candidatoSalvo = localStorage.getItem('candidatoPadraoPesquisa')
    if (candidatoSalvo) {
      setCandidatoPadrao(candidatoSalvo)
    }
  }, [])

  useEffect(() => {
    if (cities.length === 0) return

    const cidadeIdParam = searchParams.get('cidade_id')
    if (cidadeIdParam) {
      const cityExists = cities.some((city) => city.id === cidadeIdParam)
      if (cityExists) {
        setFiltroCidade(cidadeIdParam)
        return
      }
    }

    const cidadeParam = searchParams.get('cidade')
    if (!cidadeParam) return

    const cidadeNormalizada = normalizeCityName(cidadeParam)
    const matched = cities.find((city) => normalizeCityName(city.name) === cidadeNormalizada)
    if (matched) {
      setFiltroCidade(matched.id)
    }
  }, [cities, searchParams])

  useEffect(() => {
    const pollIdParam = searchParams.get('open_report_poll_id')
    if (!pollIdParam) return
    if (openedReportFromQuery === pollIdParam) return
    if (polls.length === 0) return

    const targetPoll = polls.find((poll) => poll.id === pollIdParam) || null
    if (targetPoll) {
      setPollParaRelatorio(targetPoll)
      setOpenedReportFromQuery(pollIdParam)
    }
  }, [polls, searchParams, openedReportFromQuery])
  
  // Atualizar candidatos disponíveis quando polls mudarem
  useEffect(() => {
    if (polls.length > 0) {
      const candidatosDisponiveis = Array.from(new Set(polls.map(p => p.candidato_nome).filter(Boolean)))
      if (candidatosDisponiveis.length > 0) {
        const candidatoSalvo = localStorage.getItem('candidatoPadraoPesquisa')
        if (candidatoSalvo && candidatosDisponiveis.includes(candidatoSalvo)) {
          setCandidatoPadrao(candidatoSalvo)
        } else if (!candidatoSalvo && !candidatoPadrao) {
          // Se não há salvamento e não há candidato selecionado, usar o primeiro candidato
          setCandidatoPadrao(candidatosDisponiveis[0])
        }
      }
    }
  }, [polls])

  const fetchCities = async () => {
    try {
      const response = await fetch('/api/campo/cities')
      if (response.ok) {
        const data = await response.json()
        const sorted = data.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
        setCities(sorted)
      }
    } catch (error) {
      console.error('Erro ao buscar cidades:', error)
    }
  }

  const fetchPolls = async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent)
    if (!silent) setLoading(true)
    try {
      const response = await fetch(`/api/pesquisa?limit=${POLLS_FETCH_LIMIT}`)
      if (response.ok) {
        const data = await response.json()
        setPolls(data)
      }
    } catch (error) {
      console.error('Erro ao buscar pesquisas:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta pesquisa?')) return

    try {
      const response = await fetch(`/api/pesquisa/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchPolls()
      } else {
        const error = await response.json()
        alert(error.error || 'Erro ao excluir pesquisa')
      }
    } catch (error) {
      alert('Erro ao excluir pesquisa')
    }
  }

  // Calcular KPIs
  const calcularKPIs = (): KPI[] => {
    if (polls.length === 0) {
      return [
        { id: 'intencao', label: 'Intenção de Voto', value: '0%', status: 'neutral' },
        { id: 'rejeicao', label: 'Rejeição', value: '0%', status: 'neutral' },
        { id: 'total', label: 'Total de Pesquisas', value: 0, status: 'neutral' },
      ]
    }

    // Contar pesquisas únicas: agrupar por data + instituto
    const pesquisasUnicas = new Set<string>()
    polls.forEach(poll => {
      // Normalizar data para comparação (remover hora se houver)
      const dataNormalizada = poll.data.includes('T') 
        ? poll.data.split('T')[0] 
        : poll.data
      const chavePesquisa = `${dataNormalizada}_${poll.instituto}`
      pesquisasUnicas.add(chavePesquisa)
    })

    // Se não há candidato padrão selecionado, retornar apenas total de pesquisas
    if (!candidatoPadrao) {
      return [
        { id: 'intencao', label: 'Intenção de Voto', value: '-', status: 'neutral' },
        { id: 'rejeicao', label: 'Rejeição', value: '-', status: 'neutral' },
        { id: 'total', label: 'Total de Pesquisas', value: pesquisasUnicas.size, status: 'success' },
      ]
    }

    // Buscar todas as pesquisas do candidato padrão ordenadas por data (mais recente primeiro)
    const pesquisasCandidatoPadrao = polls
      .filter(p => p.candidato_nome === candidatoPadrao)
      .sort((a, b) => {
        const dateA = new Date(a.data.includes('T') ? a.data : a.data.split('-').reverse().join('-'))
        const dateB = new Date(b.data.includes('T') ? b.data : b.data.split('-').reverse().join('-'))
        return dateB.getTime() - dateA.getTime()
      })

    if (pesquisasCandidatoPadrao.length === 0) {
      return [
        { id: 'intencao', label: 'Intenção de Voto', value: '-', status: 'neutral' },
        { id: 'rejeicao', label: 'Rejeição', value: '-', status: 'neutral' },
        { id: 'total', label: 'Total de Pesquisas', value: pesquisasUnicas.size, status: 'success' },
      ]
    }

    const ultimaPesquisa = pesquisasCandidatoPadrao[0]
    const penultimaPesquisa = pesquisasCandidatoPadrao[1]

    const intencaoVariation = penultimaPesquisa
      ? ultimaPesquisa.intencao - penultimaPesquisa.intencao
      : 0

    const rejeicaoVariation = penultimaPesquisa
      ? ultimaPesquisa.rejeicao - penultimaPesquisa.rejeicao
      : 0

    return [
      {
        id: 'intencao',
        label: `Intenção de Voto - ${candidatoPadrao}`,
        value: `${ultimaPesquisa.intencao.toFixed(1)}%`,
        variation: intencaoVariation,
        status: intencaoVariation >= 0 ? 'success' : 'error',
      },
      {
        id: 'rejeicao',
        label: `Rejeição - ${candidatoPadrao}`,
        value: `${ultimaPesquisa.rejeicao.toFixed(1)}%`,
        variation: rejeicaoVariation,
        status: rejeicaoVariation <= 0 ? 'success' : 'error',
      },
      {
        id: 'total',
        label: 'Total de Pesquisas',
        value: pesquisasUnicas.size,
        status: 'success',
      },
    ]
  }

  // Preparar dados para o gráfico (filtrar por tipo, cargo e cidade)
  // Agrupar por candidato para criar uma linha por candidato
  const pollsFiltrados = polls
    .filter((poll) => {
      // Filtro por tipo
      if (tipoGrafico !== 'todas' && poll.tipo !== tipoGrafico) return false
      
      // Filtro por cargo
      if (filtroCargo && poll.cargo !== filtroCargo) return false
      
      // Filtro por cidade
      if (filtroCidade && poll.cidade_id !== filtroCidade) return false
      
      return true
    })
    .slice()
    .reverse()

  // Obter lista única de candidatos e ordenar por intenção de votos (decrescente)
  const candidatosUnicos = Array.from(new Set(pollsFiltrados.map(p => p.candidato_nome).filter(Boolean)))
  
  // Calcular última intenção de cada candidato para ordenação
  const candidatosComUltimaIntencao = candidatosUnicos.map(candidato => {
    // Encontrar última pesquisa deste candidato
    const ultimaPesquisa = pollsFiltrados
      .filter(p => p.candidato_nome === candidato)
      .sort((a, b) => {
        const dateA = new Date(a.data.includes('T') ? a.data : a.data.split('-').reverse().join('-'))
        const dateB = new Date(b.data.includes('T') ? b.data : b.data.split('-').reverse().join('-'))
        return dateB.getTime() - dateA.getTime()
      })[0]
    
    return {
      nome: candidato,
      ultimaIntencao: ultimaPesquisa?.intencao || 0
    }
  })
  
  // Ordenar por intenção decrescente
  const candidatos = candidatosComUltimaIntencao
    .sort((a, b) => b.ultimaIntencao - a.ultimaIntencao)
    .map(c => c.nome)

  // Criar estrutura de dados: agrupar por data única, cada data tem valores de todos os candidatos
  // Primeiro, criar um mapa de datas únicas
  const datasUnicas = new Map<string, any>()
  
  pollsFiltrados.forEach((poll) => {
    // Tratar data como local para evitar problemas de timezone
    const dateStr = poll.data
    let formattedDate: string
    if (dateStr.includes('T')) {
      formattedDate = new Date(dateStr).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        year: 'numeric'
      })
    } else {
      const [year, month, day] = dateStr.split('-').map(Number)
      formattedDate = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        year: 'numeric'
      })
    }
    
    // Se a data ainda não existe no mapa, criar
    if (!datasUnicas.has(formattedDate)) {
      datasUnicas.set(formattedDate, {
        data: formattedDate,
        dataOriginal: formattedDate,
      })
    }
    
    const dataObj = datasUnicas.get(formattedDate)
    const key = `intencao_${poll.candidato_nome.replace(/\s+/g, '_')}`
    const keyRejeicao = `rejeicao_${poll.candidato_nome.replace(/\s+/g, '_')}`
    
    // Adicionar valor do candidato nesta data
    dataObj[key] = poll.intencao
    dataObj[keyRejeicao] = poll.rejeicao
    dataObj[`instituto_${poll.candidato_nome.replace(/\s+/g, '_')}`] = poll.instituto
  })
  
  // Converter mapa para array e ordenar por data
  const pesquisaData = Array.from(datasUnicas.values()).sort((a, b) => {
    const dateA = new Date(a.dataOriginal.split('/').reverse().join('-'))
    const dateB = new Date(b.dataOriginal.split('/').reverse().join('-'))
    return dateA.getTime() - dateB.getTime()
  })

  // Calcular domínio dinâmico baseado nos valores reais dos dados
  const todosValores: number[] = []
  candidatos.forEach((candidato) => {
    const key = `intencao_${candidato.replace(/\s+/g, '_')}`
    pesquisaData.forEach(d => {
      if (d[key] !== undefined && d[key] !== null) {
        todosValores.push(d[key] as number)
      }
    })
  })
  
  // Domínio fixo de 0 a 100% para visualização clara estilo Power BI
  const domainMin = 0
  const domainMax = 100

  // Cores dinâmicas via CSS variables + complementares fixas
  const cores = [
    'rgb(var(--accent-gold))',       // Accent (principal)
    'rgb(var(--accent-gold-soft))',   // Accent Soft (complementar)
    'rgb(var(--text-text-primary))',       // Text Primary (contraste)
    'rgb(var(--text-secondary))',     // Text Secondary (suave)
    'rgb(var(--success))',            // Success (para crescimento)
    'rgb(var(--danger))',             // Danger (para redução)
    'rgb(var(--warning))',            // Warning (atenção)
    'rgb(var(--info))',               // Info (informativo)
    '#16A085',                        // Verde complementar
    '#8E44AD',                        // Roxo complementar
    '#C0392B',                        // Vermelho complementar
    '#D68910',                        // Laranja complementar
  ]

  const kpis = calcularKPIs()
  const pesquisasResumoCandidato = (() => {
    if (!candidatoPadrao) return []
    return polls.filter((poll) => poll.candidato_nome === candidatoPadrao)
  })()

  const toDateMs = (dateStr: string): number => {
    if (!dateStr) return 0
    if (dateStr.includes('T')) return new Date(dateStr).getTime()
    const [year, month, day] = dateStr.split('-').map(Number)
    if (!year || !month || !day) return 0
    return new Date(year, month - 1, day).getTime()
  }

  const resumoDesempenho = (() => {
    if (pesquisasResumoCandidato.length === 0) return null

    const ordenadas = [...pesquisasResumoCandidato].sort((a, b) => toDateMs(a.data) - toDateMs(b.data))
    const primeira = ordenadas[0]
    const ultima = ordenadas[ordenadas.length - 1]
    const mediaIntencao =
      ordenadas.reduce((sum, item) => sum + (item.intencao || 0), 0) / Math.max(ordenadas.length, 1)
    const mediaRejeicao =
      ordenadas.reduce((sum, item) => sum + (item.rejeicao || 0), 0) / Math.max(ordenadas.length, 1)
    const melhor = [...ordenadas].sort((a, b) => (b.intencao || 0) - (a.intencao || 0))[0]
    const pior = [...ordenadas].sort((a, b) => (a.intencao || 0) - (b.intencao || 0))[0]
    const institutosUnicos = new Set(ordenadas.map((item) => item.instituto).filter(Boolean))
    const cidadesUnicas = new Set(ordenadas.map((item) => item.cities?.name).filter(Boolean))
    const pesquisasUnicas = new Set(
      ordenadas.map((item) => {
        const dataNormalizada = item.data.includes('T') ? item.data.split('T')[0] : item.data
        return `${dataNormalizada}_${item.instituto}`
      })
    )

    return {
      totalRegistros: ordenadas.length,
      totalPesquisasUnicas: pesquisasUnicas.size,
      mediaIntencao,
      mediaRejeicao,
      evolucaoIntencao: (ultima.intencao || 0) - (primeira.intencao || 0),
      melhor,
      pior,
      institutos: institutosUnicos.size,
      cidades: cidadesUnicas.size,
      primeiraData: primeira.data,
      ultimaData: ultima.data,
    }
  })()

  const linhasTabelaResumo = [...pesquisasResumoCandidato]
    .sort((a, b) => toDateMs(b.data) - toDateMs(a.data))
    .map((poll) => ({
      cidade: poll.cities?.name || 'Estado',
      instituto: poll.instituto || '-',
      intencao: poll.intencao || 0,
      data: formatDate(poll.data),
    }))

  return (
    <div className="min-h-screen bg-background">

      <div className="px-4 py-6 lg:px-6">
        {/* Seletor de Candidato Padrão e Botão Nova Pesquisa */}
        <div className="bg-surface rounded-2xl border border-card p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href={hrefResumoEleicoes}
              className="px-3 py-2 text-xs font-medium border border-card rounded-lg hover:bg-background transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para Resumo Eleições
            </Link>
            <label className="text-sm font-semibold text-text-primary whitespace-nowrap">
              Candidato Padrão para KPIs:
            </label>
            <select
              value={candidatoPadrao}
              onChange={(e) => {
                const novoCandidato = e.target.value
                setCandidatoPadrao(novoCandidato)
                localStorage.setItem('candidatoPadraoPesquisa', novoCandidato)
              }}
              className="flex-1 max-w-xs px-3 py-2 text-sm border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
            >
              <option value="">Selecione um candidato</option>
              {Array.from(new Set(polls.map(p => p.candidato_nome).filter(Boolean)))
                .sort()
                .map((candidato) => (
                  <option key={candidato} value={candidato}>
                    {candidato}
                  </option>
                ))}
            </select>
            <button
              onClick={() => {
                setEditingPoll(null)
                setShowModal(true)
              }}
              className="ml-auto px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Pesquisa
            </button>
          </div>
        </div>

        {/* KPIs */}
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {kpis.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        {/* Filtros */}
        <div id="filtros" className="bg-surface rounded-2xl border border-card p-4 mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filtro por Tipo */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-2">Tipo</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoGrafico"
                    value="todas"
                    checked={tipoGrafico === 'todas'}
                    onChange={(e) => setTipoGrafico(e.target.value as 'todas')}
                    className="w-4 h-4 text-accent-gold focus:ring-accent-gold"
                  />
                  <span className="text-sm text-text-primary">Todas</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoGrafico"
                    value="estimulada"
                    checked={tipoGrafico === 'estimulada'}
                    onChange={(e) => setTipoGrafico(e.target.value as 'estimulada')}
                    className="w-4 h-4 text-accent-gold focus:ring-accent-gold"
                  />
                  <span className="text-sm text-text-primary">Estimulada</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoGrafico"
                    value="espontanea"
                    checked={tipoGrafico === 'espontanea'}
                    onChange={(e) => setTipoGrafico(e.target.value as 'espontanea')}
                    className="w-4 h-4 text-accent-gold focus:ring-accent-gold"
                  />
                  <span className="text-sm text-text-primary">Espontânea</span>
                </label>
              </div>
            </div>

            {/* Filtro por Cargo */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-2">Cargo</label>
              <select
                value={filtroCargo}
                onChange={(e) => setFiltroCargo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              >
                <option value="">Todos</option>
                <option value="dep_estadual">Dep. Estadual</option>
                <option value="dep_federal">Dep. Federal</option>
                <option value="governador">Governador</option>
                <option value="senador">Senador</option>
                <option value="presidente">Presidente</option>
              </select>
            </div>

            {/* Filtro por Cidade */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-2">Cidade</label>
              <select
                value={filtroCidade}
                onChange={(e) => setFiltroCidade(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              >
                <option value="">Todas</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Gráfico de Tendência - Ocupa linha inteira */}
        <div className="bg-surface rounded-2xl border border-card p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text-primary">Tendência</h2>
              <button
                onClick={() => setGraficoTelaCheia(true)}
                className="p-2 rounded-lg hover:bg-background transition-colors"
                title="Visualizar em tela cheia"
              >
                <Maximize2 className="w-5 h-5 text-secondary" />
              </button>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-secondary">Carregando...</p>
              </div>
            ) : pesquisaData.length === 0 ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-secondary">
                  {tipoGrafico === 'todas' 
                    ? 'Nenhuma pesquisa cadastrada'
                    : `Nenhuma pesquisa ${tipoLabels[tipoGrafico]} cadastrada`
                  }
                </p>
              </div>
            ) : (
              <div className="h-[600px] relative bg-white">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={pesquisaData} 
                    margin={{ top: 30, right: 180, left: 50, bottom: 80 }}
                  >
                    {/* Grid horizontal suave estilo Power BI */}
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="rgb(var(--border-card))" 
                      strokeWidth={1}
                      horizontal={true}
                      vertical={false}
                    />
                    
                    {/* Eixo X: Datas */}
                    <XAxis 
                      dataKey="data" 
                      stroke="rgb(var(--text-muted))" 
                      fontSize={11}
                      fontWeight={400}
                      tick={{ fill: 'rgb(var(--text-muted))' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tickLine={{ stroke: 'rgb(var(--border-card))', strokeWidth: 1 }}
                    />
                    
                    {/* Eixo Y: Percentual 0-100% */}
                    <YAxis 
                      domain={[0, 100]}
                      stroke="rgb(var(--text-muted))"
                      fontSize={11}
                      fontWeight={400}
                      tick={{ fill: 'rgb(var(--text-muted))' }}
                      tickLine={{ stroke: 'rgb(var(--border-card))', strokeWidth: 1 }}
                      ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                      label={{ 
                        value: 'Intenção de Voto (%)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: 'rgb(var(--text-muted))', fontSize: 12, fontWeight: 500 }
                      }}
                    />
                    
                    {/* Tooltip estilo Power BI */}
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          // Quando há múltiplos payloads (múltiplas linhas no mesmo ponto), mostra todos
                          // Quando há um único payload, mostra apenas esse
                          const items = payload.map((item: any) => {
                            if (!item || !item.payload) return null
                            
                            const data = item.payload
                            const dataKey = item.dataKey?.toString() || ''
                            const candidatoNome = dataKey.replace('intencao_', '').replace(/_/g, ' ') || ''
                            const institutoKey = `instituto_${dataKey.replace('intencao_', '') || ''}`
                            const instituto = data[institutoKey] || ''
                            const valor = item.value
                            
                            return {
                              candidatoNome,
                              instituto,
                              valor,
                              data: data.data,
                              color: item.color || item.stroke || '#666'
                            }
                          }).filter(Boolean)
                          
                          if (items.length === 0) return null
                          
                          // Se há apenas um item, mostra formato detalhado
                          if (items.length === 1) {
                            const item = items[0]
                            if (!item) return null
                            return (
                              <div className="bg-white border border-gray-200 rounded-md p-3 shadow-lg">
                                <p className="text-sm font-semibold text-gray-900 mb-2">{item.candidatoNome}</p>
                                <div className="space-y-1 text-xs">
                                  <p className="text-gray-600">
                                    <span className="font-medium">Data:</span> {item.data}
                                  </p>
                                  {item.instituto && (
                                    <p className="text-gray-600">
                                      <span className="font-medium">Instituto:</span> {item.instituto}
                                    </p>
                                  )}
                                  {item.valor !== undefined && item.valor !== null && (
                                    <p className="text-gray-900 font-bold text-sm mt-2">
                                      Intenção: {item.valor.toFixed(1)}%
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          
                          // Se há múltiplos itens (vários candidatos na mesma data), mostra lista
                          const firstItem = items[0]
                          if (!firstItem) return null
                          return (
                            <div className="bg-white border border-gray-200 rounded-md p-3 shadow-lg">
                              <div className="mb-2">
                                <p className="text-sm font-semibold text-gray-900">{firstItem.data}</p>
                                {firstItem.instituto && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    <span className="font-medium">Instituto:</span> {firstItem.instituto}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2">
                                {items.map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="w-3 h-3 rounded-full" 
                                        style={{ backgroundColor: item.color }}
                                      />
                                      <span className="text-xs font-medium text-gray-700">{item.candidatoNome}</span>
                                    </div>
                                    {item.valor !== undefined && item.valor !== null && (
                                      <span className="text-xs font-bold text-gray-900">
                                        {item.valor.toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    
                    {/* Linhas por candidato */}
                    {candidatos.map((candidato, index) => {
                      const key = `intencao_${candidato.replace(/\s+/g, '_')}`
                      const cor = cores[index % cores.length]
                      
                      return (
                        <Line
                          key={`line_${candidato}`}
                          type="monotone"
                          dataKey={key}
                          stroke={cor}
                          strokeWidth={2.5}
                          dot={{ r: 5, fill: cor, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 7, stroke: cor, strokeWidth: 2 }}
                          animationDuration={800}
                          animationEasing="ease-out"
                        >
                          {/* Porcentagem acima de cada ponto */}
                          <LabelList
                            dataKey={key}
                            position="top"
                            offset={8}
                            formatter={(value: number) => value !== undefined && value !== null ? `${value.toFixed(1)}%` : ''}
                            style={{ 
                              fill: cor, 
                              fontSize: '11px', 
                              fontWeight: 600,
                              textShadow: '0 0 2px rgba(255,255,255,0.9)'
                            }}
                          />
                        </Line>
                      )
                    })}
                    {/* Componente Customized para rótulos no lado direito usando coordenadas reais */}
                    <Customized component={RightSideLabels} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

        {/* Quadro Resumo de Desempenho do Candidato */}
        <div className="bg-surface rounded-2xl border border-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-6">Resumo de Desempenho</h2>
          {!candidatoPadrao ? (
            <p className="text-sm text-secondary">
              Selecione um candidato padrão para visualizar o resumo consolidado.
            </p>
          ) : !resumoDesempenho ? (
            <p className="text-sm text-secondary">
              Não há pesquisas registradas para <strong>{candidatoPadrao}</strong>.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary">Pesquisas únicas</p>
                  <p className="text-xl font-bold text-text-primary">{resumoDesempenho.totalPesquisasUnicas}</p>
                </div>
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary">Média de intenção</p>
                  <p className="text-xl font-bold text-accent-gold">{resumoDesempenho.mediaIntencao.toFixed(1)}%</p>
                </div>
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary">Média de rejeição</p>
                  <p className="text-xl font-bold text-status-error">{resumoDesempenho.mediaRejeicao.toFixed(1)}%</p>
                </div>
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary">Evolução (1ª → última)</p>
                  <p className={`text-xl font-bold ${resumoDesempenho.evolucaoIntencao >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                    {resumoDesempenho.evolucaoIntencao >= 0 ? '+' : ''}{resumoDesempenho.evolucaoIntencao.toFixed(1)} p.p.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary mb-1">Melhor desempenho</p>
                  <p className="text-sm font-semibold text-text-primary">
                    {resumoDesempenho.melhor.intencao.toFixed(1)}% • {formatDate(resumoDesempenho.melhor.data)}
                  </p>
                  <p className="text-xs text-secondary">
                    {resumoDesempenho.melhor.instituto} {resumoDesempenho.melhor.cities?.name ? `• ${resumoDesempenho.melhor.cities.name}` : ''}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary mb-1">Menor desempenho</p>
                  <p className="text-sm font-semibold text-text-primary">
                    {resumoDesempenho.pior.intencao.toFixed(1)}% • {formatDate(resumoDesempenho.pior.data)}
                  </p>
                  <p className="text-xs text-secondary">
                    {resumoDesempenho.pior.instituto} {resumoDesempenho.pior.cities?.name ? `• ${resumoDesempenho.pior.cities.name}` : ''}
                  </p>
                </div>
              </div>

              <p className="text-xs text-secondary">
                Cobertura: {resumoDesempenho.institutos} instituto(s), {resumoDesempenho.cidades} cidade(s) e {resumoDesempenho.totalRegistros} registro(s) do candidato {candidatoPadrao}.
              </p>

              <div className="rounded-xl border border-card overflow-hidden">
                <div className="px-3 py-2 bg-background border-b border-card">
                  <p className="text-xs font-medium text-text-secondary">Detalhamento das pesquisas do candidato</p>
                </div>
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left py-2 px-3 bg-background">Cidade</th>
                        <th className="text-left py-2 px-3 bg-background">Instituto</th>
                        <th className="text-right py-2 px-3 bg-background">%</th>
                        <th className="text-right py-2 px-3 bg-background">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasTabelaResumo.map((linha, index) => (
                        <tr key={`${linha.data}-${linha.instituto}-${index}`} className="border-b border-card last:border-b-0">
                          <td className="py-1.5 px-3 text-text-primary">{linha.cidade}</td>
                          <td className="py-1.5 px-3 text-text-primary">{linha.instituto}</td>
                          <td className="py-1.5 px-3 text-right font-semibold text-accent-gold">{linha.intencao.toFixed(1)}%</td>
                          <td className="py-1.5 px-3 text-right text-text-secondary">{linha.data}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lista de Pesquisas */}
        <div className="bg-surface rounded-2xl border border-card p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-6">Pesquisas Cadastradas</h2>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-secondary">Carregando...</p>
            </div>
          ) : polls.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-secondary mb-4">Nenhuma pesquisa cadastrada ainda</p>
              <button
                onClick={() => {
                  setEditingPoll(null)
                  setShowModal(true)
                }}
                className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors"
              >
                Adicionar Primeira Pesquisa
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-card">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Data</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Instituto</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Candidato</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Cidade</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Cargo</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-primary">Intenção</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-primary">Rejeição</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-text-primary">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {polls.map((poll) => (
                    <tr key={poll.id} className="border-b border-card hover:bg-background/50 transition-colors">
                      <td className="py-3 px-4 text-sm text-text-primary">
                        {(() => {
                          // Tratar data como local para evitar problemas de timezone
                          const dateStr = poll.data
                          if (dateStr.includes('T')) {
                            // Se tem hora, usar new Date normalmente
                            return new Date(dateStr).toLocaleDateString('pt-BR')
                          } else {
                            // Se é só data (YYYY-MM-DD), parsear como local
                            const [year, month, day] = dateStr.split('-').map(Number)
                            return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
                          }
                        })()}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-primary">{poll.instituto}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-text-primary">
                        {poll.candidato_nome}
                      </td>
                      <td className="py-3 px-4 text-sm text-secondary">
                        {poll.cities?.name || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-secondary">{tipoLabels[poll.tipo]}</td>
                      <td className="py-3 px-4 text-sm text-secondary">{cargoLabels[poll.cargo]}</td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-accent-gold">
                        {poll.intencao.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-status-error">
                        {poll.rejeicao.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setPollParaRelatorio(poll)}
                            className="p-2 rounded-lg hover:bg-background transition-colors"
                            title="Anexar PDF e gerar análise"
                          >
                            <FileText className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingPoll(poll)
                              setShowModal(true)
                            }}
                            className="p-2 rounded-lg hover:bg-background transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4 text-secondary" />
                          </button>
                          <button
                            onClick={() => handleDelete(poll.id)}
                            className="p-2 rounded-lg hover:bg-background transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-status-error" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Pesquisa */}
      {showModal && (
        <PollModal
          poll={editingPoll}
          onClose={() => {
            setShowModal(false)
            setEditingPoll(null)
          }}
          onUpdate={fetchPolls}
        />
      )}

      {pollParaRelatorio && (
        <PollReportModal
          poll={{
            id: pollParaRelatorio.id,
            instituto: pollParaRelatorio.instituto,
            candidato_nome: pollParaRelatorio.candidato_nome,
            data: pollParaRelatorio.data,
            cidade: pollParaRelatorio.cities?.name || undefined,
          }}
          onClose={() => setPollParaRelatorio(null)}
        />
      )}

      {/* Modal de Gráfico em Tela Cheia */}
      {graficoTelaCheia && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary">Tendência - Visualização em Tela Cheia</h2>
            <button
              onClick={() => setGraficoTelaCheia(false)}
              className="p-2 rounded-lg hover:bg-background transition-colors"
              title="Fechar tela cheia"
            >
              <X className="w-6 h-6 text-secondary" />
            </button>
          </div>

          {/* Gráfico em tela cheia */}
          <div className="flex-1 p-6 overflow-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-secondary">Carregando...</p>
              </div>
            ) : pesquisaData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-secondary">
                  {tipoGrafico === 'todas' 
                    ? 'Nenhuma pesquisa cadastrada'
                    : `Nenhuma pesquisa ${tipoLabels[tipoGrafico]} cadastrada`
                  }
                </p>
              </div>
            ) : (
              <div className="h-full min-h-[800px] relative bg-white">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={pesquisaData} 
                    margin={{ top: 30, right: 180, left: 50, bottom: 80 }}
                  >
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="rgb(var(--border-card))" 
                      strokeWidth={1}
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis 
                      dataKey="data" 
                      stroke="rgb(var(--text-muted))" 
                      fontSize={11}
                      fontWeight={400}
                      tick={{ fill: 'rgb(var(--text-muted))' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tickLine={{ stroke: 'rgb(var(--border-card))', strokeWidth: 1 }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      stroke="rgb(var(--text-muted))"
                      fontSize={11}
                      fontWeight={400}
                      tick={{ fill: 'rgb(var(--text-muted))' }}
                      tickLine={{ stroke: 'rgb(var(--border-card))', strokeWidth: 1 }}
                      ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                      label={{ 
                        value: 'Intenção de Voto (%)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: 'rgb(var(--text-muted))', fontSize: 12, fontWeight: 500 }
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const items = payload.map((item: any) => {
                            if (!item || !item.payload) return null
                            const data = item.payload
                            const dataKey = item.dataKey?.toString() || ''
                            const candidatoNome = dataKey.replace('intencao_', '').replace(/_/g, ' ') || ''
                            const institutoKey = `instituto_${dataKey.replace('intencao_', '') || ''}`
                            const instituto = data[institutoKey] || ''
                            const valor = item.value
                            return {
                              candidatoNome,
                              instituto,
                              valor,
                              data: data.data,
                              color: item.color || item.stroke || '#666'
                            }
                          }).filter(Boolean)
                          if (items.length === 0) return null
                          if (items.length === 1) {
                            const item = items[0]
                            if (!item) return null
                            return (
                              <div className="bg-white border border-gray-200 rounded-md p-3 shadow-lg">
                                <p className="text-sm font-semibold text-gray-900 mb-2">{item.candidatoNome}</p>
                                <div className="space-y-1 text-xs">
                                  <p className="text-gray-600">
                                    <span className="font-medium">Data:</span> {item.data}
                                  </p>
                                  {item.instituto && (
                                    <p className="text-gray-600">
                                      <span className="font-medium">Instituto:</span> {item.instituto}
                                    </p>
                                  )}
                                  {item.valor !== undefined && item.valor !== null && (
                                    <p className="text-gray-900 font-bold text-sm mt-2">
                                      Intenção: {item.valor.toFixed(1)}%
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          const firstItem2 = items[0]
                          if (!firstItem2) return null
                          return (
                            <div className="bg-white border border-gray-200 rounded-md p-3 shadow-lg">
                              <div className="mb-2">
                                <p className="text-sm font-semibold text-gray-900">{firstItem2.data}</p>
                                {firstItem2.instituto && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    <span className="font-medium">Instituto:</span> {firstItem2.instituto}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2">
                                {items.map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="w-3 h-3 rounded-full" 
                                        style={{ backgroundColor: item.color }}
                                      />
                                      <span className="text-xs font-medium text-gray-700">{item.candidatoNome}</span>
                                    </div>
                                    {item.valor !== undefined && item.valor !== null && (
                                      <span className="text-xs font-bold text-gray-900">
                                        {item.valor.toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    {candidatos.map((candidato, index) => {
                      const key = `intencao_${candidato.replace(/\s+/g, '_')}`
                      const cor = cores[index % cores.length]
                      return (
                        <Line
                          key={`line_${candidato}`}
                          type="monotone"
                          dataKey={key}
                          stroke={cor}
                          strokeWidth={2.5}
                          dot={{ r: 5, fill: cor, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 7, stroke: cor, strokeWidth: 2 }}
                          animationDuration={800}
                          animationEasing="ease-out"
                        >
                          <LabelList
                            dataKey={key}
                            position="top"
                            offset={8}
                            formatter={(value: number) => value !== undefined && value !== null ? `${value.toFixed(1)}%` : ''}
                            style={{ 
                              fill: cor, 
                              fontSize: '11px', 
                              fontWeight: 600,
                              textShadow: '0 0 2px rgba(255,255,255,0.9)'
                            }}
                          />
                        </Line>
                      )
                    })}
                    <Customized component={RightSideLabels} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

