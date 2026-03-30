'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
    [key: string]: unknown
  }
}

interface CityDemandsModalProps {
  isOpen: boolean
  onClose: () => void
  cidade: string
}

function normalizeName(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(dr\.?|dra\.?|ver\.?|vereador[a]?|prefeit[oa]|prof\.?|sr\.?|sra\.?)\s+/i, '')
    .trim()
}

/** Liderança/solicitante: campo principal ou colunas comuns na planilha de demandas. */
function getDemandLiderancaParaFiltro(demand: Demand): string {
  const direct = demand.lideranca
  if (direct && String(direct).trim()) return String(direct).trim()
  const raw = demand.sheets_data
  if (!raw || typeof raw !== 'object') return ''
  const keys = Object.keys(raw).filter((k) =>
    /lideran[cç]a|solicitante|nome\s*do\s*solicitante|pedido\s*por|respons[aá]vel/i.test(k.trim())
  )
  for (const k of keys) {
    const v = raw[k]
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function nomesLiderancaCombinam(nomeLista: string, nomeDemanda: string | undefined | null): boolean {
  const a = normalizeName(nomeLista)
  const b = normalizeName(nomeDemanda)
  if (!a || !b) return false
  if (a === b) return true
  if (b.startsWith(`${a} `) || b === a) return true
  if (a.startsWith(`${b} `) || a === b) return true
  const shorter = a.length <= b.length ? a : b
  const longer = a.length > b.length ? a : b
  if (shorter.length >= 4 && longer.includes(shorter)) return true
  const ta = a.split(/\s+/).filter((t) => t.length >= 3)
  const tb = b.split(/\s+/).filter((t) => t.length >= 3)
  const emComum = ta.filter((t) => tb.some((u) => u === t || u.startsWith(t) || t.startsWith(u)))
  if (emComum.length >= 2) return true
  if (emComum.length === 1 && emComum[0].length >= 5) return true
  return false
}

function ordenarDemandas<T extends { status?: string; data_demanda?: string; created_at?: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const statusA = a.status || ''
    const statusB = b.status || ''
    if (statusA !== statusB) return statusA.localeCompare(statusB)
    const dataA = a.data_demanda || a.created_at || ''
    const dataB = b.data_demanda || b.created_at || ''
    if (dataA && dataB) {
      const dateA = new Date(dataA).getTime()
      const dateB = new Date(dataB).getTime()
      if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA
    }
    return 0
  })
}

export function CityDemandsModal({ isOpen, onClose, cidade }: CityDemandsModalProps) {
  const [demands, setDemands] = useState<Demand[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [liderancasPermitidas, setLiderancasPermitidas] = useState<string[]>([])

  const fetchDemands = useCallback(async () => {
    if (!cidade) return
    
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/campo/demands?cidade=${encodeURIComponent(cidade)}`)
      const data: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const apiMsg =
          data &&
          typeof data === 'object' &&
          data !== null &&
          'error' in data &&
          typeof (data as { error: unknown }).error === 'string'
            ? (data as { error: string }).error
            : null
        throw new Error(apiMsg || `Erro ao buscar demandas (${response.status})`)
      }

      if (!Array.isArray(data)) {
        throw new Error('Resposta inválida do servidor ao carregar demandas.')
      }

      setDemands(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar demandas')
      setDemands([])
    } finally {
      setLoading(false)
    }
  }, [cidade])

  useEffect(() => {
    if (isOpen && cidade) {
      if (typeof window !== 'undefined') {
        const raw = sessionStorage.getItem('territorio_demands_liderancas')
        if (raw) {
          try {
            const parsed = JSON.parse(raw)
            setLiderancasPermitidas(Array.isArray(parsed) ? parsed.map((n) => String(n || '')) : [])
          } catch {
            setLiderancasPermitidas([])
          }
        } else {
          setLiderancasPermitidas([])
        }
      }
      fetchDemands()
    } else {
      setDemands([])
      setError(null)
      setLiderancasPermitidas([])
    }
  }, [isOpen, cidade, fetchDemands])

  const { demandsFiltradasEOrdenadas, ignorouFiltroLideranca } = useMemo(() => {
    const porStatus = demands.filter(
      (d) => filtroStatus === 'todos' || d.status === filtroStatus
    )
    if (liderancasPermitidas.length === 0) {
      return {
        demandsFiltradasEOrdenadas: ordenarDemandas(porStatus),
        ignorouFiltroLideranca: false,
      }
    }
    const comLideranca = porStatus.filter((demand) => {
      const raw = getDemandLiderancaParaFiltro(demand)
      if (!raw) return true
      return liderancasPermitidas.some((permitido) =>
        nomesLiderancaCombinam(permitido, raw)
      )
    })
    if (comLideranca.length === 0 && porStatus.length > 0) {
      return {
        demandsFiltradasEOrdenadas: ordenarDemandas(porStatus),
        ignorouFiltroLideranca: true,
      }
    }
    return {
      demandsFiltradasEOrdenadas: ordenarDemandas(comLideranca),
      ignorouFiltroLideranca: false,
    }
  }, [demands, filtroStatus, liderancasPermitidas])

  if (!isOpen) return null

  const getStatusIcon = (status?: string) => {
    if (!status) return <AlertCircle className="w-4 h-4 text-secondary" />
    
    const statusLower = status.toLowerCase().trim()
    
    if (statusLower.includes('resolvido') || statusLower.includes('concluído') || statusLower.includes('concluido')) {
      return <CheckCircle className="w-4 h-4 text-status-success" />
    }
    if (statusLower.includes('andamento') || statusLower.includes('progresso') || statusLower.includes('em andamento')) {
      return <Clock className="w-4 h-4 text-status-warning" />
    }
    if (statusLower.includes('encaminhado') || statusLower.includes('encaminhada')) {
      return <Clock className="w-4 h-4 text-accent-gold" />
    }
    
    return <AlertCircle className="w-4 h-4 text-secondary" />
  }

  const getStatusLabel = (status?: string) => {
    // Retornar o status diretamente da planilha, sem mapeamento
    return status || 'Sem status'
  }

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-text-muted/10 text-secondary border-text-muted/30'
    
    const statusLower = status.toLowerCase().trim()
    
    // Verificar padrões comuns de status
    if (statusLower.includes('resolvido') || statusLower.includes('concluído') || statusLower.includes('concluido')) {
      return 'bg-status-success/10 text-status-success border-status-success/30'
    }
    if (statusLower.includes('andamento') || statusLower.includes('progresso') || statusLower.includes('em andamento')) {
      return 'bg-status-warning/10 text-status-warning border-status-warning/30'
    }
    if (statusLower.includes('encaminhado') || statusLower.includes('encaminhada')) {
      return 'bg-accent-gold-soft text-accent-gold border-accent-gold/30'
    }
    if (statusLower.includes('nova') || statusLower.includes('pendente')) {
      return 'bg-text-muted/10 text-secondary border-text-muted/30'
    }
    
    // Padrão padrão para outros status
    return 'bg-text-muted/10 text-secondary border-text-muted/30'
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
        return 'bg-text-muted/10 text-secondary border-text-muted/30'
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

  const getSheetsField = (demand: Demand, patterns: RegExp[]): string | null => {
    const raw = demand.sheets_data
    if (!raw || typeof raw !== 'object') return null

    const entries = Object.entries(raw)
    const match = entries.find(([key]) => patterns.some((pattern) => pattern.test(key)))
    if (!match) return null

    const value = match[1]
    if (value === null || value === undefined) return null
    const text = String(value).trim()
    return text || null
  }

  const normalizeNumber = (value: unknown): number => {
    if (typeof value === 'number') return value

    const str = String(value || '').trim()
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

  const formatValorSemMoeda = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return '-'
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const getDemandValorNumero = (demand: Demand): number => {
    const valorFromSheets = getSheetsField(demand, [
      /^valor$/i,
      /valor\s*\(?.*r\$.*\)?/i,
      /custo|or[çc]amento/i,
    ])
    if (valorFromSheets) return normalizeNumber(valorFromSheets)

    const demandRecord = demand as unknown as Record<string, unknown>
    const directValue =
      demandRecord.valor ??
      demandRecord.value ??
      demandRecord.custo ??
      demandRecord.orcamento

    return normalizeNumber(directValue)
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

  const totalValorDemandas = demandsFiltradasEOrdenadas.reduce(
    (sum, demand) => sum + getDemandValorNumero(demand),
    0
  )

  // Obter status únicos para filtro
  const statusUnicos = Array.from(new Set(demands.map(d => d.status).filter(Boolean))) as string[]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-card w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header Compacto */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-card">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">
              {cidade}
            </h2>
            <span className="text-xs text-secondary">
              {loading ? '...' : `${demandsFiltradasEOrdenadas.length} demanda${demandsFiltradasEOrdenadas.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-4 h-4 text-secondary" />
          </button>
        </div>

        {/* Filtros */}
        {!loading && !error && demands.length > 0 && (
          <div className="px-4 py-3 border-b border-card space-y-3">
            {/* Filtro por Status */}
            <div>
              <label className="text-xs font-medium text-secondary mb-2 block">Filtrar por Status:</label>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="filtro-status"
                    value="todos"
                    checked={filtroStatus === 'todos'}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-3.5 h-3.5 text-accent-gold"
                  />
                  <span className="text-xs text-text-primary">Todos</span>
                </label>
                {statusUnicos.map((status) => (
                  <label key={status} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="filtro-status"
                      value={status}
                      checked={filtroStatus === status}
                      onChange={(e) => setFiltroStatus(e.target.value)}
                      className="w-3.5 h-3.5 text-accent-gold"
                    />
                    <span className="text-xs text-text-primary">{status}</span>
                  </label>
                ))}
              </div>
            </div>
            {liderancasPermitidas.length > 0 && (
              <p className="text-xs text-secondary">
                {ignorouFiltroLideranca ? (
                  <>
                    Nenhuma demanda bateu com os nomes das {liderancasPermitidas.length} lideranças do resumo;
                    exibindo <span className="font-medium text-text-primary">todas as demandas desta cidade</span> na
                    planilha.
                  </>
                ) : (
                  <>
                    Modal respeitando filtros da página: {liderancasPermitidas.length} liderança
                    {liderancasPermitidas.length !== 1 ? 's' : ''}.
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* Content Compacto */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-accent-gold animate-spin" />
              <span className="ml-2 text-sm text-secondary">Carregando...</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg">
              <p className="text-xs text-status-error">{error}</p>
            </div>
          ) : demandsFiltradasEOrdenadas.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-secondary mx-auto mb-2" />
              <p className="text-sm text-secondary">Nenhuma demanda encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {demandsFiltradasEOrdenadas.map((demand, index) => {
                const liderancaExibicao = getDemandLiderancaParaFiltro(demand)
                return (
                <div
                  key={demand.id || `demand-${index}`}
                  className="border border-card rounded-lg p-3 hover:bg-background/50 transition-colors"
                >
                  {/* Linha principal: Título + Status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {getStatusIcon(demand.status)}
                      <h3 className="text-sm font-semibold text-text-primary leading-tight">
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
                      <span className="text-secondary">
                        <span className="font-medium">Data:</span> {formatDate(demand.data_demanda)}
                      </span>
                    )}
                    {liderancaExibicao && (
                      <span className="text-secondary">
                        <span className="font-medium">Por:</span> {liderancaExibicao}
                      </span>
                    )}
                    {demand.priority && (
                      <span className={`px-1.5 py-0.5 rounded border ${getPriorityColor(demand.priority)}`}>
                        {getPriorityLabel(demand.priority)}
                      </span>
                    )}
                    {demand.theme && (
                      <span className="text-secondary">
                        {demand.theme}
                      </span>
                    )}
                    {getDemandValorNumero(demand) > 0 && (
                      <span className="px-1.5 py-0.5 rounded border bg-accent-gold-soft text-accent-gold border-accent-gold/30 font-semibold">
                        Valor: {formatValorSemMoeda(getDemandValorNumero(demand))}
                      </span>
                    )}
                  </div>

                  {/* Descrição apenas se houver e for relevante */}
                  {demand.description && demand.description.trim() && (
                    <p className="text-xs text-secondary mt-1.5 line-clamp-1">
                      {demand.description}
                    </p>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>

        {!loading && !error && demandsFiltradasEOrdenadas.length > 0 && (
          <div className="px-4 py-3 border-t border-card bg-background/40 flex items-center justify-end">
            <span className="text-sm font-semibold text-text-primary">
              Total Valor: <span className="text-accent-gold">{formatValorSemMoeda(totalValorDemandas)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
