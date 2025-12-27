'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { PollModal } from '@/components/poll-modal'
import { Plus, Edit2, Trash2, Maximize2, X } from 'lucide-react'
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

  useEffect(() => {
    fetchPolls()
    fetchCities()
    
    // Carregar candidato padrão do localStorage
    const candidatoSalvo = localStorage.getItem('candidatoPadraoPesquisa')
    if (candidatoSalvo) {
      setCandidatoPadrao(candidatoSalvo)
    }
  }, [])
  
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

  const fetchPolls = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/pesquisa')
      if (response.ok) {
        const data = await response.json()
        setPolls(data)
      }
    } catch (error) {
      console.error('Erro ao buscar pesquisas:', error)
    } finally {
      setLoading(false)
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

  // Cores suaves e profissionais para cada candidato (estilo Power BI)
  const cores = [
    '#4A90E2', // Azul suave
    '#50C878', // Verde suave
    '#E74C3C', // Vermelho suave
    '#F39C12', // Laranja suave
    '#9B59B6', // Roxo suave
    '#E91E63', // Rosa suave
    '#1ABC9C', // Turquesa suave
    '#95A5A6', // Cinza azulado
    '#3498DB', // Azul claro
    '#2ECC71', // Verde claro
    '#E67E22', // Laranja claro
    '#34495E', // Azul escuro
  ]

  const kpis = calcularKPIs()

  return (
    <div className="min-h-screen bg-background">
      <Header title="Pesquisa & Relato de Rua" subtitle="Dado quantitativo + percepção qualitativa" />

      <div className="px-4 py-6 lg:px-6">
        {/* Seletor de Candidato Padrão e Botão Nova Pesquisa */}
        <div className="bg-surface rounded-2xl border border-border p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm font-semibold text-text-strong whitespace-nowrap">
              Candidato Padrão para KPIs:
            </label>
            <select
              value={candidatoPadrao}
              onChange={(e) => {
                const novoCandidato = e.target.value
                setCandidatoPadrao(novoCandidato)
                localStorage.setItem('candidatoPadraoPesquisa', novoCandidato)
              }}
              className="flex-1 max-w-xs px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
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
              className="ml-auto px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
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
        <div className="bg-surface rounded-2xl border border-border p-4 mb-6">
          <h3 className="text-sm font-semibold text-text-strong mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filtro por Tipo */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-2">Tipo</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoGrafico"
                    value="todas"
                    checked={tipoGrafico === 'todas'}
                    onChange={(e) => setTipoGrafico(e.target.value as 'todas')}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-strong">Todas</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoGrafico"
                    value="estimulada"
                    checked={tipoGrafico === 'estimulada'}
                    onChange={(e) => setTipoGrafico(e.target.value as 'estimulada')}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-strong">Estimulada</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoGrafico"
                    value="espontanea"
                    checked={tipoGrafico === 'espontanea'}
                    onChange={(e) => setTipoGrafico(e.target.value as 'espontanea')}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-strong">Espontânea</span>
                </label>
              </div>
            </div>

            {/* Filtro por Cargo */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-2">Cargo</label>
              <select
                value={filtroCargo}
                onChange={(e) => setFiltroCargo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
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
              <label className="block text-xs font-medium text-text-muted mb-2">Cidade</label>
              <select
                value={filtroCidade}
                onChange={(e) => setFiltroCidade(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
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
        <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text-strong">Tendência</h2>
              <button
                onClick={() => setGraficoTelaCheia(true)}
                className="p-2 rounded-lg hover:bg-background transition-colors"
                title="Visualizar em tela cheia"
              >
                <Maximize2 className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-text-muted">Carregando...</p>
              </div>
            ) : pesquisaData.length === 0 ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-text-muted">
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
                      stroke="#E8E8E8" 
                      strokeWidth={1}
                      horizontal={true}
                      vertical={false}
                    />
                    
                    {/* Eixo X: Datas */}
                    <XAxis 
                      dataKey="data" 
                      stroke="#666666" 
                      fontSize={11}
                      fontWeight={400}
                      tick={{ fill: '#666666' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tickLine={{ stroke: '#CCCCCC', strokeWidth: 1 }}
                    />
                    
                    {/* Eixo Y: Percentual 0-100% */}
                    <YAxis 
                      domain={[0, 100]}
                      stroke="#666666"
                      fontSize={11}
                      fontWeight={400}
                      tick={{ fill: '#666666' }}
                      tickLine={{ stroke: '#CCCCCC', strokeWidth: 1 }}
                      ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                      label={{ 
                        value: 'Intenção de Voto (%)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: '#666666', fontSize: 12, fontWeight: 500 }
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

        {/* Relato de Rua - Movido para baixo */}
        <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-strong mb-6">Relato de Rua</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-background">
              <p className="text-sm font-medium text-text-strong mb-2">Humor do eleitor</p>
              <p className="text-sm text-text-muted">Positivo em 68% das interações</p>
            </div>
            <div className="p-4 rounded-xl bg-background">
              <p className="text-sm font-medium text-text-strong mb-2">Frases recorrentes</p>
              <p className="text-sm text-text-muted">"Precisa melhorar saúde"</p>
            </div>
          </div>
        </div>

        {/* Lista de Pesquisas */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="text-lg font-semibold text-text-strong mb-6">Pesquisas Cadastradas</h2>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-text-muted">Carregando...</p>
            </div>
          ) : polls.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted mb-4">Nenhuma pesquisa cadastrada ainda</p>
              <button
                onClick={() => {
                  setEditingPoll(null)
                  setShowModal(true)
                }}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Adicionar Primeira Pesquisa
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-strong">Data</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-strong">Instituto</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-strong">Candidato</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-strong">Cidade</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-strong">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-strong">Cargo</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-strong">Intenção</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-strong">Rejeição</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-text-strong">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {polls.map((poll) => (
                    <tr key={poll.id} className="border-b border-border hover:bg-background/50 transition-colors">
                      <td className="py-3 px-4 text-sm text-text-strong">
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
                      <td className="py-3 px-4 text-sm text-text-strong">{poll.instituto}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-text-strong">
                        {poll.candidato_nome}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-muted">
                        {poll.cities?.name || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-muted">{tipoLabels[poll.tipo]}</td>
                      <td className="py-3 px-4 text-sm text-text-muted">{cargoLabels[poll.cargo]}</td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-primary">
                        {poll.intencao.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-status-error">
                        {poll.rejeicao.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingPoll(poll)
                              setShowModal(true)
                            }}
                            className="p-2 rounded-lg hover:bg-background transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4 text-text-muted" />
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

      {/* Modal de Gráfico em Tela Cheia */}
      {graficoTelaCheia && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="bg-surface border-b border-border p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-strong">Tendência - Visualização em Tela Cheia</h2>
            <button
              onClick={() => setGraficoTelaCheia(false)}
              className="p-2 rounded-lg hover:bg-background transition-colors"
              title="Fechar tela cheia"
            >
              <X className="w-6 h-6 text-text-muted" />
            </button>
          </div>

          {/* Gráfico em tela cheia */}
          <div className="flex-1 p-6 overflow-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-text-muted">Carregando...</p>
              </div>
            ) : pesquisaData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-text-muted">
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
                      stroke="#E8E8E8" 
                      strokeWidth={1}
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis 
                      dataKey="data" 
                      stroke="#666666" 
                      fontSize={11}
                      fontWeight={400}
                      tick={{ fill: '#666666' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tickLine={{ stroke: '#CCCCCC', strokeWidth: 1 }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      stroke="#666666"
                      fontSize={11}
                      fontWeight={400}
                      tick={{ fill: '#666666' }}
                      tickLine={{ stroke: '#CCCCCC', strokeWidth: 1 }}
                      ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                      label={{ 
                        value: 'Intenção de Voto (%)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: '#666666', fontSize: 12, fontWeight: 500 }
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

