'use client'

import { useEffect, useState, useCallback, useMemo, useId } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TseCarregando,
  TseErro,
  TseModal,
  TsePill,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoNeutroClass,
  tseTabela,
} from '@/components/tse/tse-ui'

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
  /** Quando informado (ex.: veio do modal de lideranças), exibe botão Voltar. */
  onVoltar?: () => void
  voltarLabel?: string
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
    /lideran[cç]a|solicitante|nome\s*do\s*solicitante|pedido\s*por|respons[aá]vel/i.test(k.trim()),
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

function statusPillTom(status: string | undefined): 'verde' | 'amarelo' | 'neutro' {
  const sl = (status || '').toLowerCase().trim()
  if (sl.includes('resolvido') || sl.includes('concluído') || sl.includes('concluido') || sl.includes('entregue')) {
    return 'verde'
  }
  if (sl.includes('andamento') || sl.includes('progresso') || sl.includes('encaminhad')) {
    return 'amarelo'
  }
  return 'neutro'
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
    demandRecord.valor ?? demandRecord.value ?? demandRecord.custo ?? demandRecord.orcamento

  return normalizeNumber(directValue)
}

function getDemandObservacoes(demand: Demand): string {
  const seiRef = getSheetsField(demand, [/sei/i, /n[ºo°]?\s*sei/i])
  return [seiRef, demand.theme, demand.description?.trim()]
    .filter((s): s is string => Boolean(s && String(s).trim()))
    .join(' · ')
}

type DemandSortCol = 'status' | 'title' | 'data' | 'lideranca' | 'valor' | 'observacoes'
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
  dir: DemandSortDir,
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
            : getDemandObservacoes(a)
    const textB =
      col === 'status'
        ? b.status || ''
        : col === 'title'
          ? b.title || ''
          : col === 'lideranca'
            ? getDemandLiderancaParaFiltro(b)
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
  { id: 'valor', label: 'Valor', align: 'right' },
  { id: 'observacoes', label: 'Observações' },
]

export function CityDemandsModal({
  isOpen,
  onClose,
  cidade,
  onVoltar,
  voltarLabel = 'Voltar às lideranças',
}: CityDemandsModalProps) {
  const tituloId = useId()
  const [demands, setDemands] = useState<Demand[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      void fetchDemands()
    } else {
      setDemands([])
      setError(null)
      setLiderancasPermitidas([])
      setSortCol('status')
      setSortDir('asc')
    }
  }, [isOpen, cidade, fetchDemands])

  const demandsFiltradasEOrdenadas = useMemo(() => {
    const filtradas =
      liderancasPermitidas.length === 0
        ? demands
        : demands.filter((demand) => {
            const raw = getDemandLiderancaParaFiltro(demand)
            if (!raw) return false
            return liderancasPermitidas.some((permitido) => nomesLiderancaCombinam(permitido, raw))
          })
    return ordenarDemandasPorColuna(filtradas, sortCol, sortDir)
  }, [demands, liderancasPermitidas, sortCol, sortDir])

  const toggleSort = useCallback(
    (col: DemandSortCol) => {
      if (sortCol === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return
      }
      setSortCol(col)
      setSortDir('asc')
    },
    [sortCol],
  )

  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [isOpen])

  if (!isOpen) return null

  const getStatusLabel = (status?: string) => status || 'Sem status'

  const formatValorSemMoeda = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return '-'
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
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
    0,
  )

  const subtitulo = loading
    ? 'Carregando…'
    : `${demandsFiltradasEOrdenadas.length} demanda${demandsFiltradasEOrdenadas.length !== 1 ? 's' : ''}`

  return (
    <TseModal
      id={tituloId}
      titulo={cidade}
      subtitulo={subtitulo}
      onClose={onClose}
      largura="max-w-6xl"
      rodape={
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {onVoltar ? (
              <button type="button" onClick={onVoltar} className={tseBotaoNeutroClass}>
                <ArrowLeft className={tseBotaoIconeClass} aria-hidden />
                {voltarLabel}
              </button>
            ) : null}
            {!loading && !error && demandsFiltradasEOrdenadas.length > 0 ? (
              <span className="text-[12px] text-[var(--tse-muted)]">
                Total em R${' '}
                <strong className="tabular-nums text-[var(--tse-text)]">
                  {formatValorSemMoeda(totalValorDemandas)}
                </strong>
              </span>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className={tseBotaoCinzaClass}>
            Fechar
          </button>
        </>
      }
    >
      {!loading && !error && liderancasPermitidas.length > 0 ? (
        <p className="rounded-lg bg-white px-3 py-2 text-[12px] text-[var(--tse-muted)] shadow-sm">
          Filtrado por {liderancasPermitidas.length} liderança
          {liderancasPermitidas.length !== 1 ? 's' : ''}
          {liderancasPermitidas.length <= 3 ? `: ${liderancasPermitidas.join(', ')}` : ''}.
        </p>
      ) : null}

      {loading ? (
        <TseCarregando texto="Carregando demandas…" className="min-h-[20vh]" />
      ) : error ? (
        <TseErro>{error}</TseErro>
      ) : demandsFiltradasEOrdenadas.length === 0 ? (
        <TseVazio>Nenhuma demanda encontrada</TseVazio>
      ) : (
        <div className={tseTabela.container} data-tse-tabela="">
          <table className={cn(tseTabela.table, 'min-w-[920px]')}>
            <thead className={tseTabela.thead}>
              <tr>
                {DEMAND_SORT_COLUMNS.map((col) => {
                  const active = sortCol === col.id
                  const SortIcon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
                  return (
                    <th
                      key={col.id}
                      className={cn(
                        tseTabela.th,
                        col.align === 'right' && 'text-right',
                        col.id === 'title' && 'min-w-[220px]',
                        col.id === 'lideranca' && 'min-w-[140px]',
                        col.id === 'observacoes' && 'min-w-[180px]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.id)}
                        className={cn(
                          'inline-flex max-w-full items-center gap-1 font-bold uppercase tracking-wide transition-colors',
                          col.align === 'right' && 'ml-auto flex-row-reverse',
                          active
                            ? 'text-[var(--tse-text)]'
                            : 'text-[var(--tse-muted)] hover:text-[var(--tse-text)]',
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
                const refLinha = getDemandObservacoes(demand)

                return (
                  <tr key={demand.id || `demand-${index}`} className={tseTabela.tr}>
                    <td className={tseTabela.td}>
                      <TsePill tom={statusPillTom(demand.status)} className="max-w-[10rem] truncate">
                        {getStatusLabel(demand.status)}
                      </TsePill>
                    </td>
                    <td className={cn(tseTabela.td, 'font-semibold')}>
                      <span className="line-clamp-2 leading-snug">{demand.title}</span>
                    </td>
                    <td className={cn(tseTabela.td, 'whitespace-nowrap tabular-nums text-[var(--tse-muted)]')}>
                      {formatDate(demand.data_demanda)}
                    </td>
                    <td className={tseTabela.td}>
                      <span className="line-clamp-2" title={liderancaExibicao || undefined}>
                        {liderancaExibicao || '—'}
                      </span>
                    </td>
                    <td className={cn(tseTabela.td, 'whitespace-nowrap text-right tabular-nums')}>
                      {valorNum > 0 ? `R$ ${formatValorSemMoeda(valorNum)}` : '—'}
                    </td>
                    <td className={cn(tseTabela.td, 'text-[var(--tse-muted)]')}>
                      <span className="line-clamp-2" title={refLinha || undefined}>
                        {refLinha || '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </TseModal>
  )
}
