'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertCircle, Loader2, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

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

function getStatusBadgeClasses(status: string | undefined, isDark: boolean): string {
  const sl = (status || '').toLowerCase().trim()
  if (sl.includes('resolvido') || sl.includes('concluído') || sl.includes('concluido')) {
    return isDark
      ? 'border-emerald-500/45 bg-emerald-950/55 text-emerald-100'
      : 'border-emerald-300 bg-emerald-100 text-emerald-950'
  }
  if (sl.includes('andamento') || sl.includes('progresso')) {
    return isDark
      ? 'border-amber-500/45 bg-amber-950/60 text-amber-50'
      : 'border-amber-400 bg-amber-100 text-amber-950'
  }
  if (sl.includes('encaminhado') || sl.includes('encaminhada')) {
    return isDark
      ? 'border-sky-500/40 bg-sky-950/50 text-sky-100'
      : 'border-sky-300 bg-sky-50 text-sky-950'
  }
  if (sl.includes('nova') || sl.includes('pendente')) {
    return isDark ? 'border-zinc-500/40 bg-zinc-900/60 text-zinc-200' : 'border-zinc-300 bg-zinc-100 text-zinc-900'
  }
  return isDark ? 'border-zinc-600 bg-zinc-900/50 text-zinc-300' : 'border-zinc-300 bg-zinc-50 text-zinc-800'
}

function priorityToneClass(priority: string | undefined, isDark: boolean): string {
  const s = (priority || '').toLowerCase()
  if (s === 'high' || s.includes('alta')) {
    return isDark ? 'text-rose-200' : 'text-rose-800'
  }
  if (s === 'medium' || s.includes('média') || s.includes('media')) {
    return isDark ? 'text-amber-200' : 'text-amber-900'
  }
  if (s === 'low' || s.includes('baixa')) {
    return isDark ? 'text-emerald-200' : 'text-emerald-800'
  }
  return isDark ? 'text-zinc-400' : 'text-zinc-600'
}

function formatPriorityLabel(priority?: string): string {
  if (!priority) return ''
  const s = priority.toLowerCase().trim()
  if (s === 'high' || s.includes('alta')) return 'Alta'
  if (s === 'medium' || s.includes('média') || s.includes('media')) return 'Média'
  if (s === 'low' || s.includes('baixa')) return 'Baixa'
  return priority
}

function getSheetsField(demand: Demand, patterns: RegExp[]): string | null {
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

function normalizeNumber(value: unknown): number {
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

function getDemandValorNumero(demand: Demand): number {
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

function getDemandObservacoes(demand: Demand): string {
  const seiRef = getSheetsField(demand, [/sei/i, /n[ºo°]?\s*sei/i])
  return [seiRef, demand.theme, demand.description?.trim()]
    .filter((s): s is string => Boolean(s && String(s).trim()))
    .join(' · ')
}

type DemandSortCol =
  | 'status'
  | 'title'
  | 'data'
  | 'lideranca'
  | 'prioridade'
  | 'valor'
  | 'observacoes'

type DemandSortDir = 'asc' | 'desc'

function parseDemandDateMs(dateString?: string): number | null {
  if (!dateString) return null
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return null
  return date.getTime()
}

function compareTextPt(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true })
}

function ordenarDemandasPorColuna(
  lista: Demand[],
  col: DemandSortCol,
  dir: DemandSortDir
): Demand[] {
  const mult = dir === 'asc' ? 1 : -1
  return [...lista].sort((a, b) => {
    if (col === 'valor') {
      const va = getDemandValorNumero(a)
      const vb = getDemandValorNumero(b)
      const aEmpty = va <= 0
      const bEmpty = vb <= 0
      if (aEmpty && bEmpty) return 0
      if (aEmpty) return 1
      if (bEmpty) return -1
      return (va - vb) * mult
    }

    if (col === 'data') {
      const va = parseDemandDateMs(a.data_demanda || a.created_at)
      const vb = parseDemandDateMs(b.data_demanda || b.created_at)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return (va - vb) * mult
    }

    const textA =
      col === 'status'
        ? a.status || ''
        : col === 'title'
          ? a.title || ''
          : col === 'lideranca'
            ? getDemandLiderancaParaFiltro(a)
            : col === 'prioridade'
              ? formatPriorityLabel(a.priority)
              : getDemandObservacoes(a)
    const textB =
      col === 'status'
        ? b.status || ''
        : col === 'title'
          ? b.title || ''
          : col === 'lideranca'
            ? getDemandLiderancaParaFiltro(b)
            : col === 'prioridade'
              ? formatPriorityLabel(b.priority)
              : getDemandObservacoes(b)

    const aEmpty = !textA.trim()
    const bEmpty = !textB.trim()
    if (aEmpty && bEmpty) return 0
    if (aEmpty) return 1
    if (bEmpty) return -1
    return compareTextPt(textA, textB) * mult
  })
}

const DEMAND_SORT_COLUMNS: { id: DemandSortCol; label: string; align?: 'right' }[] = [
  { id: 'status', label: 'Status' },
  { id: 'title', label: 'Demanda' },
  { id: 'data', label: 'Data' },
  { id: 'lideranca', label: 'Liderança' },
  { id: 'prioridade', label: 'Prioridade' },
  { id: 'valor', label: 'Valor', align: 'right' },
  { id: 'observacoes', label: 'Observações' },
]

export function CityDemandsModal({ isOpen, onClose, cidade }: CityDemandsModalProps) {
  const { appearance } = useTheme()
  const isDarkAppearance = appearance === 'dark'
  const isCockpit = false
  const modalShellClass = isCockpit
    ? 'border-white/12 bg-[linear-gradient(165deg,rgba(22,34,44,0.92)_0%,rgba(18,30,38,0.95)_100%)] shadow-[0_24px_64px_rgba(3,12,20,0.42)]'
    : 'border-card bg-surface'
  const contentClass = isCockpit
    ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.012)_100%)]'
    : 'bg-background'
  const [demands, setDemands] = useState<Demand[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [liderancasPermitidas, setLiderancasPermitidas] = useState<string[]>([])
  const [sortCol, setSortCol] = useState<DemandSortCol>('status')
  const [sortDir, setSortDir] = useState<DemandSortDir>('asc')

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
      setFiltroStatus('todos')
      setSortCol('status')
      setSortDir('asc')
    }
  }, [isOpen, cidade, fetchDemands])

  const { demandsFiltradasEOrdenadas, ignorouFiltroLideranca } = useMemo(() => {
    const porStatus = demands.filter(
      (d) => filtroStatus === 'todos' || d.status === filtroStatus
    )
    let filtradas: Demand[]
    let ignorou = false
    if (liderancasPermitidas.length === 0) {
      filtradas = porStatus
    } else {
      const comLideranca = porStatus.filter((demand) => {
        const raw = getDemandLiderancaParaFiltro(demand)
        if (!raw) return true
        return liderancasPermitidas.some((permitido) =>
          nomesLiderancaCombinam(permitido, raw)
        )
      })
      if (comLideranca.length === 0 && porStatus.length > 0) {
        filtradas = porStatus
        ignorou = true
      } else {
        filtradas = comLideranca
      }
    }
    return {
      demandsFiltradasEOrdenadas: ordenarDemandasPorColuna(filtradas, sortCol, sortDir),
      ignorouFiltroLideranca: ignorou,
    }
  }, [demands, filtroStatus, liderancasPermitidas, sortCol, sortDir])

  const toggleSort = useCallback(
    (col: DemandSortCol) => {
      if (sortCol === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return
      }
      setSortCol(col)
      setSortDir('asc')
    },
    [sortCol]
  )

  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  const getStatusLabel = (status?: string) => {
    return status || 'Sem status'
  }

  const formatValorSemMoeda = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return '-'
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
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

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 p-4">
      <div
        className={cn(
          'flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border font-sans',
          modalShellClass
        )}
      >
        {/* Header Compacto */}
        <div className={cn('flex items-center justify-between border-b px-4 py-3', isCockpit ? 'border-white/10' : 'border-card')}>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">
              {cidade}
            </h2>
            <span className="text-xs text-text-secondary">
              {loading ? '...' : `${demandsFiltradasEOrdenadas.length} demanda${demandsFiltradasEOrdenadas.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className={cn('rounded-lg p-1.5 transition-colors', isCockpit ? 'hover:bg-white/10' : 'hover:bg-background')}
          >
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {/* Filtros */}
        {!loading && !error && demands.length > 0 && (
          <div className={cn('space-y-2 border-b px-4 py-3', isCockpit ? 'border-white/10' : 'border-card')}>
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-secondary">Filtrar por status</p>
              <div
                className={cn(
                  'flex flex-wrap gap-1.5',
                  isDarkAppearance ? 'rounded-lg bg-black/20 p-1' : 'rounded-lg bg-background/80 p-1',
                )}
                role="group"
                aria-label="Filtro de status das demandas"
              >
                <button
                  type="button"
                  onClick={() => setFiltroStatus('todos')}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    filtroStatus === 'todos'
                      ? isDarkAppearance
                        ? 'bg-white/15 text-text-primary shadow-sm'
                        : 'bg-surface text-text-primary shadow-sm ring-1 ring-border-card'
                      : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  Todos
                </button>
                {statusUnicos.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFiltroStatus(status)}
                    className={cn(
                      'max-w-[200px] truncate rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      filtroStatus === status
                        ? isDarkAppearance
                          ? 'bg-white/15 text-text-primary shadow-sm'
                          : 'bg-surface text-text-primary shadow-sm ring-1 ring-border-card'
                        : 'text-text-secondary hover:text-text-primary',
                    )}
                    title={status}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
            {liderancasPermitidas.length > 0 && (
              <p className="text-xs leading-snug text-text-secondary">
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

        {/* Content — tabela compacta */}
        <div className={cn('min-h-0 flex-1 overflow-auto', contentClass)}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-accent-gold animate-spin" />
              <span className="ml-2 text-sm text-text-secondary">Carregando...</span>
            </div>
          ) : error ? (
            <div className="m-3 rounded-lg border border-status-error/30 bg-status-error/10 p-3">
              <p className="text-xs text-status-error">{error}</p>
            </div>
          ) : demandsFiltradasEOrdenadas.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 text-text-secondary" />
              <p className="text-sm text-text-secondary">Nenhuma demanda encontrada</p>
            </div>
          ) : (
            <table className="w-full min-w-[920px] border-collapse text-left text-xs">
              <thead
                className={cn(
                  'sticky top-0 z-10 border-b',
                  isCockpit
                    ? 'border-white/10 bg-[rgba(18,30,38,0.98)]'
                    : isDarkAppearance
                      ? 'border-white/10 bg-bg-app'
                      : 'border-card bg-surface',
                )}
              >
                <tr className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                  {DEMAND_SORT_COLUMNS.map((col) => {
                    const active = sortCol === col.id
                    const SortIcon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
                    const thClass =
                      col.id === 'title'
                        ? 'min-w-[220px] px-3 py-2.5'
                        : col.id === 'lideranca'
                          ? 'min-w-[140px] px-3 py-2.5'
                          : col.id === 'observacoes'
                            ? 'min-w-[180px] px-3 py-2.5'
                            : 'whitespace-nowrap px-3 py-2.5'
                    return (
                      <th key={col.id} className={cn(thClass, col.align === 'right' && 'text-right')}>
                        <button
                          type="button"
                          onClick={() => toggleSort(col.id)}
                          className={cn(
                            'inline-flex max-w-full items-center gap-1 font-medium uppercase tracking-wide transition-colors',
                            col.align === 'right' && 'ml-auto flex-row-reverse',
                            active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
                          )}
                          title={
                            active
                              ? sortDir === 'asc'
                                ? 'Ordenado A→Z — clique para Z→A'
                                : 'Ordenado Z→A — clique para A→Z'
                              : 'Ordenar A→Z'
                          }
                          aria-label={`Ordenar por ${col.label}`}
                        >
                          <span className="truncate">{col.label}</span>
                          <SortIcon
                            className={cn('h-3 w-3 shrink-0', active ? 'opacity-100' : 'opacity-45')}
                            aria-hidden
                          />
                          {active ? (
                            <span className="sr-only">{sortDir === 'asc' ? 'A a Z' : 'Z a A'}</span>
                          ) : null}
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {demandsFiltradasEOrdenadas.map((demand, index) => {
                  const liderancaExibicao = getDemandLiderancaParaFiltro(demand)
                  const valorNum = getDemandValorNumero(demand)
                  const priorLabel = formatPriorityLabel(demand.priority)
                  const refLinha = getDemandObservacoes(demand)

                  return (
                    <tr
                      key={demand.id || `demand-${index}`}
                      className={cn(
                        'border-b align-top transition-colors',
                        isCockpit
                          ? 'border-white/8 hover:bg-white/[0.04]'
                          : isDarkAppearance
                            ? 'border-white/8 hover:bg-white/[0.04]'
                            : 'border-card/80 hover:bg-[#fff4e5]/55',
                      )}
                    >
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex max-w-[9.5rem] truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none',
                            getStatusBadgeClasses(demand.status, isDarkAppearance),
                          )}
                          title={getStatusLabel(demand.status)}
                        >
                          {getStatusLabel(demand.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="line-clamp-2 text-[13px] font-medium leading-snug text-text-primary">
                          {demand.title}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-text-secondary">
                        {formatDate(demand.data_demanda)}
                      </td>
                      <td className="px-3 py-2 text-text-primary">
                        <span className="line-clamp-2" title={liderancaExibicao || undefined}>
                          {liderancaExibicao || '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {priorLabel ? (
                          <span
                            className={cn(
                              'font-medium',
                              priorityToneClass(demand.priority, isDarkAppearance),
                            )}
                          >
                            {priorLabel}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-text-primary">
                        {valorNum > 0 ? `R$ ${formatValorSemMoeda(valorNum)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-text-muted">
                        <span className="line-clamp-2" title={refLinha || undefined}>
                          {refLinha || '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !error && demandsFiltradasEOrdenadas.length > 0 && (
          <div
            className={cn(
              'flex items-center justify-end border-t px-4 py-3',
              isCockpit ? 'border-white/10 bg-white/[0.02]' : isDarkAppearance ? 'border-white/10 bg-black/20' : 'border-card bg-background/50',
            )}
          >
            <span className="text-sm text-text-secondary">
              Total em R${' '}
              <span
                className={cn(
                  'text-base font-bold tabular-nums tracking-tight text-text-primary',
                  isDarkAppearance ? 'text-zinc-50' : undefined,
                )}
              >
                {formatValorSemMoeda(totalValorDemandas)}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
