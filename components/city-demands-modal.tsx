'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'

interface Demand {
  id?: string
  title: string
  description?: string
  status?: string
  theme?: string
  priority?: string
  lideranca?: string
  visit_id?: string
  data_demanda?: string
  sla_deadline?: string
  created_at?: string
  from_sheets?: boolean
  sheets_data?: {
    cidade?: string
    [key: string]: any
  }
}

interface CityDemandsModalProps {
  isOpen: boolean
  onClose: () => void
  cidade: string
}

export function CityDemandsModal({ isOpen, onClose, cidade }: CityDemandsModalProps) {
  const [demands, setDemands] = useState<Demand[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroLideranca, setFiltroLideranca] = useState<string>('todos')

  const fetchDemands = useCallback(async () => {
    if (!cidade) return
    
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/campo/demands?cidade=${encodeURIComponent(cidade)}`)
      
      if (!response.ok) {
        throw new Error('Erro ao buscar demandas')
      }

      const data = await response.json()
      setDemands(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar demandas')
      setDemands([])
    } finally {
      setLoading(false)
    }
  }, [cidade])

  useEffect(() => {
    if (isOpen && cidade) {
      fetchDemands()
    } else {
      setDemands([])
      setError(null)
    }
  }, [isOpen, cidade, fetchDemands])

  if (!isOpen) return null

  const getStatusIcon = (status?: string) => {
    if (!status) return <AlertCircle className="w-4 h-4 text-text-muted" />
    
    const statusLower = status.toLowerCase().trim()
    
    if (statusLower.includes('resolvido') || statusLower.includes('concluído') || statusLower.includes('concluido')) {
      return <CheckCircle className="w-4 h-4 text-status-success" />
    }
    if (statusLower.includes('andamento') || statusLower.includes('progresso') || statusLower.includes('em andamento')) {
      return <Clock className="w-4 h-4 text-status-warning" />
    }
    if (statusLower.includes('encaminhado') || statusLower.includes('encaminhada')) {
      return <Clock className="w-4 h-4 text-primary" />
    }
    
    return <AlertCircle className="w-4 h-4 text-text-muted" />
  }

  const getStatusLabel = (status?: string) => {
    // Retornar o status diretamente da planilha, sem mapeamento
    return status || 'Sem status'
  }

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-text-muted/10 text-text-muted border-text-muted/30'
    
    const statusLower = status.toLowerCase().trim()
    
    // Verificar padrões comuns de status
    if (statusLower.includes('resolvido') || statusLower.includes('concluído') || statusLower.includes('concluido')) {
      return 'bg-status-success/10 text-status-success border-status-success/30'
    }
    if (statusLower.includes('andamento') || statusLower.includes('progresso') || statusLower.includes('em andamento')) {
      return 'bg-status-warning/10 text-status-warning border-status-warning/30'
    }
    if (statusLower.includes('encaminhado') || statusLower.includes('encaminhada')) {
      return 'bg-primary/10 text-primary border-primary/30'
    }
    if (statusLower.includes('nova') || statusLower.includes('pendente')) {
      return 'bg-text-muted/10 text-text-muted border-text-muted/30'
    }
    
    // Padrão padrão para outros status
    return 'bg-text-muted/10 text-text-muted border-text-muted/30'
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-status-error/10 text-status-error border-status-error/30'
      case 'medium':
        return 'bg-status-warning/10 text-status-warning border-status-warning/30'
      case 'low':
        return 'bg-status-success/10 text-status-success border-status-success/30'
      default:
        return 'bg-text-muted/10 text-text-muted border-text-muted/30'
    }
  }

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'Alta'
      case 'medium':
        return 'Média'
      case 'low':
        return 'Baixa'
      default:
        return 'Não definida'
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      // Tentar parsear como data
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        // Se não for uma data válida, retornar o valor original
        return dateString
      }
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  // Filtrar e ordenar demandas
  const demandsFiltradasEOrdenadas = demands
    .filter((demand) => {
      // Filtro por status
      if (filtroStatus !== 'todos' && demand.status !== filtroStatus) {
        return false
      }
      // Filtro por liderança
      if (filtroLideranca !== 'todos' && demand.lideranca !== filtroLideranca) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      // Ordenar por STATUS primeiro
      const statusA = a.status || ''
      const statusB = b.status || ''
      if (statusA !== statusB) {
        return statusA.localeCompare(statusB)
      }
      // Depois por DATA DEMANDA
      const dataA = a.data_demanda || a.created_at || ''
      const dataB = b.data_demanda || b.created_at || ''
      if (dataA && dataB) {
        const dateA = new Date(dataA).getTime()
        const dateB = new Date(dataB).getTime()
        if (!isNaN(dateA) && !isNaN(dateB)) {
          return dateB - dateA // Mais recentes primeiro
        }
      }
      return 0
    })

  // Obter status únicos para filtro
  const statusUnicos = Array.from(new Set(demands.map(d => d.status).filter(Boolean))) as string[]
  // Obter lideranças únicas para filtro
  const liderancasUnicas = Array.from(new Set(demands.map(d => d.lideranca).filter(Boolean))) as string[]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header Compacto */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-text-strong">
              {cidade}
            </h2>
            <span className="text-xs text-text-muted">
              {loading ? '...' : `${demandsFiltradasEOrdenadas.length} demanda${demandsFiltradasEOrdenadas.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* Filtros */}
        {!loading && !error && demands.length > 0 && (
          <div className="px-4 py-3 border-b border-border space-y-3">
            {/* Filtro por Status */}
            <div>
              <label className="text-xs font-medium text-text-muted mb-2 block">Filtrar por Status:</label>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="filtro-status"
                    value="todos"
                    checked={filtroStatus === 'todos'}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-3.5 h-3.5 text-primary"
                  />
                  <span className="text-xs text-text-strong">Todos</span>
                </label>
                {statusUnicos.map((status) => (
                  <label key={status} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="filtro-status"
                      value={status}
                      checked={filtroStatus === status}
                      onChange={(e) => setFiltroStatus(e.target.value)}
                      className="w-3.5 h-3.5 text-primary"
                    />
                    <span className="text-xs text-text-strong">{status}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Filtro por Liderança */}
            {liderancasUnicas.length > 0 && (
              <div>
                <label className="text-xs font-medium text-text-muted mb-2 block">Filtrar por Liderança:</label>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="filtro-lideranca"
                      value="todos"
                      checked={filtroLideranca === 'todos'}
                      onChange={(e) => setFiltroLideranca(e.target.value)}
                      className="w-3.5 h-3.5 text-primary"
                    />
                    <span className="text-xs text-text-strong">Todos</span>
                  </label>
                  {liderancasUnicas.map((lideranca) => (
                    <label key={lideranca} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="filtro-lideranca"
                        value={lideranca}
                        checked={filtroLideranca === lideranca}
                        onChange={(e) => setFiltroLideranca(e.target.value)}
                        className="w-3.5 h-3.5 text-primary"
                      />
                      <span className="text-xs text-text-strong">{lideranca}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Compacto */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="ml-2 text-sm text-text-muted">Carregando...</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg">
              <p className="text-xs text-status-error">{error}</p>
            </div>
          ) : demandsFiltradasEOrdenadas.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-muted">Nenhuma demanda encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {demandsFiltradasEOrdenadas.map((demand, index) => (
                <div
                  key={demand.id || `demand-${index}`}
                  className="border border-border rounded-lg p-3 hover:bg-background/50 transition-colors"
                >
                  {/* Linha principal: Título + Status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {getStatusIcon(demand.status)}
                      <h3 className="text-sm font-semibold text-text-strong leading-tight">
                        {demand.title}
                      </h3>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded border flex-shrink-0 ${getStatusColor(demand.status)}`}>
                      {getStatusLabel(demand.status)}
                    </span>
                  </div>

                  {/* Informações secundárias em linha compacta */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {demand.data_demanda && (
                      <span className="text-text-muted">
                        <span className="font-medium">Data:</span> {formatDate(demand.data_demanda)}
                      </span>
                    )}
                    {demand.lideranca && (
                      <span className="text-text-muted">
                        <span className="font-medium">Por:</span> {demand.lideranca}
                      </span>
                    )}
                    {demand.priority && (
                      <span className={`px-1.5 py-0.5 rounded border ${getPriorityColor(demand.priority)}`}>
                        {getPriorityLabel(demand.priority)}
                      </span>
                    )}
                    {demand.theme && (
                      <span className="text-text-muted">
                        {demand.theme}
                      </span>
                    )}
                  </div>

                  {/* Descrição apenas se houver e for relevante */}
                  {demand.description && demand.description.trim() && (
                    <p className="text-xs text-text-muted mt-1.5 line-clamp-1">
                      {demand.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
