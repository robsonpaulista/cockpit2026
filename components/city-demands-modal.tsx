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
      const date = new Date(dateString)
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-text-strong">
              Demandas - {cidade}
            </h2>
            <p className="text-sm text-text-muted mt-1">
              {loading ? 'Carregando...' : `${demands.length} demanda${demands.length !== 1 ? 's' : ''} encontrada${demands.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="ml-3 text-text-muted">Carregando demandas...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-status-error/10 border border-status-error/30 rounded-lg">
              <p className="text-sm text-status-error">{error}</p>
            </div>
          ) : demands.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-muted">Nenhuma demanda encontrada para esta cidade</p>
            </div>
          ) : (
            <div className="space-y-4">
              {demands.map((demand, index) => (
                <div
                  key={demand.id || `demand-${index}`}
                  className="border border-border rounded-xl p-4 hover:bg-background/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        {getStatusIcon(demand.status)}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-text-strong mb-1">
                            {demand.title}
                          </h3>
                          {demand.description && (
                            <p className="text-xs text-text-muted line-clamp-2">
                              {demand.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`px-2 py-1 text-xs rounded-lg border ${getStatusColor(demand.status)}`}>
                          {getStatusLabel(demand.status)}
                        </span>
                        {demand.priority && (
                          <span className={`px-2 py-1 text-xs rounded-lg border ${getPriorityColor(demand.priority)}`}>
                            Prioridade: {getPriorityLabel(demand.priority)}
                          </span>
                        )}
                        {demand.theme && (
                          <span className="px-2 py-1 text-xs rounded-lg bg-background border border-border text-text-strong">
                            {demand.theme}
                          </span>
                        )}
                        {demand.lideranca && (
                          <span className="px-2 py-1 text-xs rounded-lg bg-background border border-border text-text-strong">
                            Liderança: {demand.lideranca}
                          </span>
                        )}
                        {demand.from_sheets && (
                          <span className="px-2 py-1 text-xs rounded-lg bg-primary/10 text-primary border border-primary/30">
                            Google Sheets
                          </span>
                        )}
                      </div>

                      {demand.sla_deadline && (
                        <div className="mt-2 text-xs text-text-muted">
                          <span className="font-medium">Prazo SLA:</span> {formatDate(demand.sla_deadline)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
