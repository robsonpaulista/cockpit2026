'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { cn, formatDateShort } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Save,
  Filter,
  FileSpreadsheet,
  FileText,
  Columns2,
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  EMENDAS_LIST_COLUMN_KEYS,
  EMENDAS_LIST_COLUMN_LABELS,
  emendasDefaultVisibleColumnsRecord,
  exportEmendasListToPdf,
  exportEmendasListToXlsx,
  type EmendaListColumnKey,
} from '@/lib/emendas-list-export'

interface City {
  id: string
  name: string
  state?: string
}

export interface Emenda {
  id: string
  bloco: string | null
  exercicio: number | null
  emenda: string
  municipio_beneficiario: string | null
  funcional: string | null
  gnd: string | null
  valor_indicado: number | null
  valor_empenhado: number | null
  valor_a_empenhar: number | null
  valor_pago: number | null
  valor_a_ser_pago: number | null
  empenho: string | null
  data_empenho: string | null
  portaria_convenio: string | null
  numero_proposta: string | null
  data_pagamento: string | null
  liderancas: string | null
  alteracao: string | null
  objeto: string | null
  created_at?: string
  updated_at?: string
}

type FormState = {
  bloco: string
  exercicio: string
  emenda: string
  municipio_beneficiario: string
  funcional: string
  gnd: string
  valor_indicado: string
  valor_empenhado: string
  valor_a_empenhar: string
  valor_pago: string
  valor_a_ser_pago: string
  empenho: string
  data_empenho: string
  portaria_convenio: string
  numero_proposta: string
  data_pagamento: string
  liderancas: string
  alteracao: string
  objeto: string
}

function emptyForm(): FormState {
  return {
    bloco: '',
    exercicio: '',
    emenda: '',
    municipio_beneficiario: '',
    funcional: '',
    gnd: '',
    valor_indicado: '',
    valor_empenhado: '',
    valor_a_empenhar: '',
    valor_pago: '',
    valor_a_ser_pago: '',
    empenho: '',
    data_empenho: '',
    portaria_convenio: '',
    numero_proposta: '',
    data_pagamento: '',
    liderancas: '',
    alteracao: '',
    objeto: '',
  }
}

function rowToForm(e: Emenda): FormState {
  const n = (v: number | null | undefined) =>
    v != null && !Number.isNaN(Number(v)) ? String(v) : ''
  return {
    bloco: e.bloco ?? '',
    exercicio: e.exercicio != null && !Number.isNaN(Number(e.exercicio)) ? String(e.exercicio) : '',
    emenda: e.emenda ?? '',
    municipio_beneficiario: e.municipio_beneficiario ?? '',
    funcional: e.funcional ?? '',
    gnd: e.gnd ?? '',
    valor_indicado: n(e.valor_indicado),
    valor_empenhado: n(e.valor_empenhado),
    valor_a_empenhar: n(e.valor_a_empenhar),
    valor_pago: n(e.valor_pago),
    valor_a_ser_pago: n(e.valor_a_ser_pago),
    empenho: e.empenho ?? '',
    data_empenho: e.data_empenho ? e.data_empenho.slice(0, 10) : '',
    portaria_convenio: e.portaria_convenio ?? '',
    numero_proposta: e.numero_proposta ?? '',
    data_pagamento: e.data_pagamento ? e.data_pagamento.slice(0, 10) : '',
    liderancas: e.liderancas ?? '',
    alteracao: e.alteracao ?? '',
    objeto: e.objeto ?? '',
  }
}

function formToPayload(f: FormState): Record<string, unknown> {
  return {
    bloco: f.bloco,
    exercicio: f.exercicio,
    emenda: f.emenda,
    municipio_beneficiario: f.municipio_beneficiario,
    funcional: f.funcional,
    gnd: f.gnd,
    valor_indicado: f.valor_indicado,
    valor_empenhado: f.valor_empenhado,
    valor_a_empenhar: f.valor_a_empenhar,
    valor_pago: f.valor_pago,
    valor_a_ser_pago: f.valor_a_ser_pago,
    empenho: f.empenho,
    data_empenho: f.data_empenho,
    portaria_convenio: f.portaria_convenio,
    numero_proposta: f.numero_proposta,
    data_pagamento: f.data_pagamento,
    liderancas: f.liderancas,
    alteracao: f.alteracao,
    objeto: f.objeto,
  }
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function emendaListTdClass(col: EmendaListColumnKey): string {
  const longoTexto =
    col === 'objeto' ||
    col === 'alteracao' ||
    col === 'liderancas' ||
    col === 'portaria_convenio' ||
    col === 'empenho'
  return cn(
    'px-4 py-2 text-black',
    col === 'id' && 'max-w-[120px] truncate font-mono text-xs',
    col === 'emenda' && 'max-w-[220px] truncate font-medium',
    col === 'municipio_beneficiario' && 'max-w-[200px] truncate',
    longoTexto && 'max-w-[min(18rem,40vw)] truncate',
    (col === 'exercicio' ||
      col.startsWith('valor_') ||
      col === 'data_empenho' ||
      col === 'data_pagamento' ||
      col === 'created_at' ||
      col === 'updated_at' ||
      col === 'gnd' ||
      col === 'bloco' ||
      col === 'funcional' ||
      col === 'numero_proposta') &&
      'whitespace-nowrap',
  )
}

function emendaCellTitle(r: Emenda, col: EmendaListColumnKey): string | undefined {
  const textCols: EmendaListColumnKey[] = [
    'id',
    'bloco',
    'emenda',
    'municipio_beneficiario',
    'funcional',
    'gnd',
    'empenho',
    'portaria_convenio',
    'numero_proposta',
    'liderancas',
    'alteracao',
    'objeto',
  ]
  if (!textCols.includes(col)) return undefined
  const v = r[col as keyof Emenda]
  if (v == null) return undefined
  const s = String(v).trim()
  return s || undefined
}

function renderEmendaListCell(r: Emenda, col: EmendaListColumnKey): ReactNode {
  switch (col) {
    case 'id':
      return r.id
    case 'bloco':
      return r.bloco || '—'
    case 'exercicio':
      return r.exercicio != null ? r.exercicio : '—'
    case 'emenda':
      return r.emenda
    case 'municipio_beneficiario':
      return r.municipio_beneficiario || '—'
    case 'funcional':
      return r.funcional || '—'
    case 'gnd':
      return r.gnd || '—'
    case 'valor_indicado':
      return formatMoney(r.valor_indicado)
    case 'valor_empenhado':
      return formatMoney(r.valor_empenhado)
    case 'valor_a_empenhar':
      return formatMoney(r.valor_a_empenhar)
    case 'valor_pago':
      return formatMoney(r.valor_pago)
    case 'valor_a_ser_pago':
      return formatMoney(r.valor_a_ser_pago)
    case 'empenho':
      return r.empenho || '—'
    case 'data_empenho':
      return r.data_empenho ? formatDateShort(r.data_empenho) : '—'
    case 'portaria_convenio':
      return r.portaria_convenio || '—'
    case 'numero_proposta':
      return r.numero_proposta || '—'
    case 'data_pagamento':
      return r.data_pagamento ? formatDateShort(r.data_pagamento) : '—'
    case 'liderancas':
      return r.liderancas || '—'
    case 'alteracao':
      return r.alteracao || '—'
    case 'objeto':
      return r.objeto || '—'
    case 'created_at':
      return r.created_at ? formatDateShort(r.created_at) : '—'
    case 'updated_at':
      return r.updated_at ? formatDateShort(r.updated_at) : '—'
    default:
      return '—'
  }
}

type FiltroStatusEmenda = 'all' | 'pagas' | 'nao_pagas'

function isEmendaPaga(r: Emenda): boolean {
  const vp = Number(r.valor_pago)
  return Number.isFinite(vp) && vp > 0
}

function getEmendaSortValue(r: Emenda, col: EmendaListColumnKey): string | number {
  switch (col) {
    case 'exercicio':
      return r.exercicio ?? Number.NEGATIVE_INFINITY
    case 'valor_indicado':
    case 'valor_empenhado':
    case 'valor_a_empenhar':
    case 'valor_pago':
    case 'valor_a_ser_pago':
      return r[col] ?? Number.NEGATIVE_INFINITY
    case 'data_empenho':
    case 'data_pagamento':
    case 'created_at':
    case 'updated_at': {
      const d = r[col]
      return d ? new Date(d).getTime() : Number.NEGATIVE_INFINITY
    }
    default: {
      const v = r[col as keyof Emenda]
      if (v == null) return ''
      return String(v).toLowerCase()
    }
  }
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  )
}

export default function EmendasPage() {
  const router = useRouter()
  const isCockpit = false
  const pageShellClass = 'bg-white'
  const sectionShellClass = isCockpit
    ? 'rounded-2xl border p-5 backdrop-blur border-white/12 bg-[linear-gradient(165deg,rgba(22,34,44,0.82)_0%,rgba(18,30,38,0.86)_100%)] shadow-[0_10px_32px_rgba(3,12,20,0.28)]'
    : 'rounded-2xl bg-surface p-6 shadow-sm'
  const innerPanelClass = isCockpit
    ? 'rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)] p-3'
    : 'rounded-xl border border-card bg-background/50 p-3'
  const { canAccess, isAdmin, loading: permLoading } = usePermissions()
  const [rows, setRows] = useState<Emenda[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [cities, setCities] = useState<City[]>([])
  const [filteredCities, setFilteredCities] = useState<City[]>([])
  const [loadingCities, setLoadingCities] = useState(false)
  const [municipioBusca, setMunicipioBusca] = useState('')
  const [filterExercicio, setFilterExercicio] = useState<string>('')
  const [filterEmenda, setFilterEmenda] = useState<string>('')
  const [filterMunicipio, setFilterMunicipio] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<FiltroStatusEmenda>('all')
  const [visibleColumns, setVisibleColumns] = useState<Record<EmendaListColumnKey, boolean>>(() =>
    emendasDefaultVisibleColumnsRecord(),
  )
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const columnPickerRef = useRef<HTMLDivElement>(null)
  const [sortColumn, setSortColumn] = useState<EmendaListColumnKey | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  const municipiosBeneficiariosNaBase = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const m = r.municipio_beneficiario?.trim()
      if (m) set.add(m)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [rows])

  useEffect(() => {
    if (filterMunicipio === '') return
    if (!municipiosBeneficiariosNaBase.includes(filterMunicipio)) {
      setFilterMunicipio('')
    }
  }, [municipiosBeneficiariosNaBase, filterMunicipio])

  const filteredRows = useMemo(() => {
    const ex = filterExercicio.trim()
    const em = filterEmenda.trim().toLowerCase()
    return rows.filter((r) => {
      if (ex !== '') {
        const y = parseInt(ex, 10)
        const exSóDígitos = /^\d+$/.test(ex)
        if (exSóDígitos && Number.isFinite(y) && y >= 1900 && y <= 2100 && ex.length === 4) {
          if (r.exercicio !== y) return false
        } else if (!String(r.exercicio ?? '').includes(ex)) {
          return false
        }
      }
      if (em && !r.emenda.toLowerCase().includes(em)) return false
      if (filterMunicipio !== '' && (r.municipio_beneficiario ?? '').trim() !== filterMunicipio) {
        return false
      }
      if (filterStatus === 'pagas' && !isEmendaPaga(r)) return false
      if (filterStatus === 'nao_pagas' && isEmendaPaga(r)) return false
      return true
    })
  }, [rows, filterExercicio, filterEmenda, filterMunicipio, filterStatus])

  const toggleSort = useCallback((col: EmendaListColumnKey) => {
    if (sortColumn === col) {
      setSortAsc((asc) => !asc)
    } else {
      setSortColumn(col)
      setSortAsc(true)
    }
  }, [sortColumn])

  const sortedFilteredRows = useMemo(() => {
    if (!sortColumn) return filteredRows
    return [...filteredRows].sort((a, b) => {
      const va = getEmendaSortValue(a, sortColumn)
      const vb = getEmendaSortValue(b, sortColumn)
      const cmp =
        typeof va === 'string' && typeof vb === 'string'
          ? va.localeCompare(vb, 'pt-BR')
          : Number(va) - Number(vb)
      return sortAsc ? cmp : -cmp
    })
  }, [filteredRows, sortColumn, sortAsc])

  const filtrosAtivos =
    filterExercicio.trim() !== '' ||
    filterEmenda.trim() !== '' ||
    filterMunicipio !== '' ||
    filterStatus !== 'all'

  const descricaoFiltrosExport = useMemo(() => {
    const partes: string[] = []
    const ex = filterExercicio.trim()
    if (ex) partes.push(`Exercício: ${ex}`)
    const em = filterEmenda.trim()
    if (em) partes.push(`Emenda contém: ${em}`)
    if (filterMunicipio) partes.push(`Município/beneficiário: ${filterMunicipio}`)
    if (filterStatus === 'pagas') partes.push('Status: pagas (valor pago > 0)')
    if (filterStatus === 'nao_pagas') partes.push('Status: não pagas')
    return partes.length > 0
      ? `Filtros ativos — ${partes.join(' · ')}`
      : 'Sem filtros (lista completa carregada)'
  }, [filterExercicio, filterEmenda, filterMunicipio, filterStatus])

  const activeColumnList = useMemo(
    () => EMENDAS_LIST_COLUMN_KEYS.filter((k) => visibleColumns[k]),
    [visibleColumns],
  )

  const rowsParaExportar = useMemo(
    () =>
      filteredRows.map((r) => ({
        id: r.id,
        bloco: r.bloco,
        exercicio: r.exercicio,
        emenda: r.emenda,
        municipio_beneficiario: r.municipio_beneficiario,
        funcional: r.funcional,
        gnd: r.gnd,
        valor_indicado: r.valor_indicado,
        valor_empenhado: r.valor_empenhado,
        valor_a_empenhar: r.valor_a_empenhar,
        valor_pago: r.valor_pago,
        valor_a_ser_pago: r.valor_a_ser_pago,
        empenho: r.empenho,
        data_empenho: r.data_empenho,
        portaria_convenio: r.portaria_convenio,
        numero_proposta: r.numero_proposta,
        data_pagamento: r.data_pagamento,
        liderancas: r.liderancas,
        alteracao: r.alteracao,
        objeto: r.objeto,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    [filteredRows],
  )

  const totaisFiltrados = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        const indicado = Number(r.valor_indicado)
        const empenhado = Number(r.valor_empenhado)
        const pago = Number(r.valor_pago)
        if (Number.isFinite(indicado)) acc.valorIndicado += indicado
        if (Number.isFinite(empenhado)) acc.valorEmpenhado += empenhado
        if (Number.isFinite(pago)) acc.valorPago += pago
        return acc
      },
      { valorIndicado: 0, valorEmpenhado: 0, valorPago: 0 },
    )
  }, [filteredRows])

  const toggleColumn = useCallback((col: EmendaListColumnKey) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [col]: !prev[col] }
      const n = EMENDAS_LIST_COLUMN_KEYS.filter((k) => next[k]).length
      return n === 0 ? prev : next
    })
  }, [])

  const handleExportXlsx = useCallback(() => {
    void exportEmendasListToXlsx(rowsParaExportar, filtrosAtivos, activeColumnList)
  }, [rowsParaExportar, filtrosAtivos, activeColumnList])

  const handleExportPdf = useCallback(() => {
    void exportEmendasListToPdf(
      rowsParaExportar,
      filtrosAtivos,
      descricaoFiltrosExport,
      activeColumnList,
    )
  }, [rowsParaExportar, filtrosAtivos, descricaoFiltrosExport, activeColumnList])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/emendas')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erro ao carregar')
        setRows([])
        return
      }
      setRows(data.emendas ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (permLoading) return
    if (!isAdmin && !canAccess('emendas')) {
      router.replace('/dashboard')
      return
    }
    void load()
  }, [permLoading, isAdmin, canAccess, router, load])

  useEffect(() => {
    if (!showColumnPicker) return
    const onDoc = (e: MouseEvent) => {
      const el = columnPickerRef.current
      if (el && !el.contains(e.target as Node)) setShowColumnPicker(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [showColumnPicker])

  useEffect(() => {
    if (!modalOpen) return
    setMunicipioBusca('')
    if (cities.length > 0) {
      setFilteredCities(cities)
    }
  }, [modalOpen, cities])

  useEffect(() => {
    if (!modalOpen) return
    if (cities.length > 0) return

    let cancelled = false
    const run = async () => {
      setLoadingCities(true)
      try {
        let res = await fetch('/api/campo/cities')
        if (!res.ok) {
          await fetch('/api/campo/cities/sync', { method: 'POST' })
          res = await fetch('/api/campo/cities')
        }
        if (cancelled || !res.ok) return
        const data = (await res.json()) as City[]
        if (!Array.isArray(data) || cancelled) return
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        setCities(sorted)
        setFilteredCities(sorted)
      } catch (e) {
        console.error('Emendas: erro ao carregar municípios', e)
      } finally {
        if (!cancelled) setLoadingCities(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [modalOpen, cities.length])

  const openCreate = () => {
    setError(null)
    setEditingId(null)
    setIsDuplicating(false)
    setForm(emptyForm())
    setShowColumnPicker(false)
    setModalOpen(true)
  }

  const openEdit = (e: Emenda) => {
    setError(null)
    setEditingId(e.id)
    setIsDuplicating(false)
    setForm(rowToForm(e))
    setShowColumnPicker(false)
    setModalOpen(true)
  }

  /**
   * Abre o modal pré-preenchido com os dados da emenda informada, mas em
   * modo de criação (sem `editingId`), de forma que ao salvar seja gerado
   * um novo registro idêntico — sem nenhuma alteração no nome da emenda,
   * para não atrapalhar o ganho de tempo da duplicação.
   */
  const openDuplicate = (e: Emenda) => {
    setError(null)
    setEditingId(null)
    setIsDuplicating(true)
    setForm(rowToForm(e))
    setShowColumnPicker(false)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setIsDuplicating(false)
    setForm(emptyForm())
    setShowColumnPicker(false)
  }

  const save = async () => {
    if (!form.emenda.trim()) {
      setError('Preencha o campo Emenda.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = formToPayload(form)
      const url = editingId ? `/api/emendas/${editingId}` : '/api/emendas'
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar')
        return
      }
      closeModal()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (e: Emenda) => {
    if (!window.confirm(`Excluir a emenda "${e.emenda}"?`)) return
    setDeletingId(e.id)
    setError(null)
    try {
      const res = await fetch(`/api/emendas/${e.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erro ao excluir')
        return
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeletingId(null)
    }
  }

  if (permLoading) {
    return (
      <div className={cn('flex min-h-[40vh] flex-1 items-center justify-center', pageShellClass)}>
        <Loader2 className="h-8 w-8 animate-spin text-accent-gold" aria-hidden />
      </div>
    )
  }

  const filterInputClass = isCockpit
    ? 'min-w-[5.5rem] max-w-[9rem] rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-text-primary placeholder:text-secondary/70 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft'
    : 'min-w-[5.5rem] max-w-[10rem] rounded-lg border border-card bg-surface px-2 py-1.5 text-xs text-text-primary placeholder:text-secondary/70 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft'

  const filterSelectClass = isCockpit
    ? 'min-w-[6.5rem] max-w-[11rem] rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft'
    : 'min-w-[6.5rem] max-w-[11rem] rounded-lg border border-card bg-surface px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft'

  const tableShellClass = isCockpit
    ? 'flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]'
    : 'flex min-h-0 flex-col overflow-hidden rounded-xl border border-card bg-white'

  const tableScrollClass =
    'min-h-0 max-h-[min(70vh,calc(100dvh-14rem))] flex-1 overflow-auto overscroll-contain [scrollbar-width:thin]'

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', pageShellClass)}>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-6 lg:px-6">
        <div className={cn(sectionShellClass, 'flex min-h-0 flex-1 flex-col')}>
          <div className="mb-6 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-text-primary sm:text-xl">Emendas</h1>
              <p className="mt-1 text-sm text-secondary">
                Cadastro e acompanhamento de emendas (institucional).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleExportXlsx}
                disabled={loading}
                title="Exportar para Excel: registros filtrados e colunas visíveis"
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  isCockpit
                    ? 'border-white/20 bg-white/5 text-text-primary hover:bg-white/10'
                    : 'border-card bg-transparent text-text-primary hover:bg-background',
                )}
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
                Excel
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={loading}
                title="Exportar para PDF: registros filtrados e colunas visíveis"
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  isCockpit
                    ? 'border-white/20 bg-white/5 text-text-primary hover:bg-white/10'
                    : 'border-card bg-transparent text-text-primary hover:bg-background',
                )}
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                PDF
              </button>
              <button
                type="button"
                onClick={openCreate}
                className={sidebarPrimaryCTAButtonClass(isCockpit, 'shrink-0')}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Nova emenda
              </button>
            </div>
          </div>

          {error && (
            <div
              className="mb-4 shrink-0 rounded-xl border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className={cn(innerPanelClass, 'mb-4 shrink-0')}>
            <div className="flex flex-nowrap items-center gap-x-2 sm:gap-3 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
              <Filter className="h-3.5 w-3.5 shrink-0 text-secondary" aria-hidden />
              <span className="text-xs font-semibold text-text-primary shrink-0">Filtros</span>
              <span className="hidden sm:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />

              <label className="flex min-w-0 shrink-0 items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                  Exercício
                </span>
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  step={1}
                  inputMode="numeric"
                  value={filterExercicio}
                  onChange={(ev) => setFilterExercicio(ev.target.value)}
                  placeholder="Ano"
                  className={filterInputClass}
                />
              </label>

              <span className="hidden sm:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />

              <label className="flex min-w-[8rem] max-w-[14rem] flex-1 items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                  Emenda
                </span>
                <input
                  type="search"
                  value={filterEmenda}
                  onChange={(ev) => setFilterEmenda(ev.target.value)}
                  placeholder="Contém…"
                  className={cn(filterInputClass, 'min-w-[6rem] max-w-none flex-1')}
                  autoComplete="off"
                />
              </label>

              <span className="hidden sm:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />

              <label className="flex min-w-0 max-w-[min(22rem,48vw)] shrink-0 items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                  Município / Benef.
                </span>
                <select
                  value={filterMunicipio}
                  onChange={(ev) => setFilterMunicipio(ev.target.value)}
                  title="Valores cadastrados na base — filtro exato"
                  className={cn(
                    filterSelectClass,
                    'min-w-[9rem] max-w-[min(18rem,40vw)] flex-1 truncate',
                  )}
                >
                  <option value="">Todos</option>
                  {municipiosBeneficiariosNaBase.map((m) => (
                    <option key={m} value={m} title={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <span className="hidden sm:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />

              <label className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                  Status
                </span>
                <select
                  value={filterStatus}
                  onChange={(ev) => setFilterStatus(ev.target.value as FiltroStatusEmenda)}
                  className={filterSelectClass}
                  title="Pagas: valor pago maior que zero"
                >
                  <option value="all">Todos</option>
                  <option value="pagas">Pagas</option>
                  <option value="nao_pagas">Não pagas</option>
                </select>
              </label>

              {filtrosAtivos ? (
                <>
                  <span className="hidden md:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />
                  <button
                    type="button"
                    onClick={() => {
                      setFilterExercicio('')
                      setFilterEmenda('')
                      setFilterMunicipio('')
                      setFilterStatus('all')
                    }}
                    className="shrink-0 rounded-lg border border-card bg-transparent px-2.5 py-1.5 text-xs font-medium text-secondary hover:border-accent-gold/40 hover:text-text-primary"
                  >
                    Limpar
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-secondary">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                {loading
                  ? 'Carregando…'
                  : filtrosAtivos
                    ? `${filteredRows.length} de ${rows.length} emenda(s)`
                    : `${rows.length} emenda(s)`}
              </span>
              {!loading && (
                <span className="hidden h-4 w-px shrink-0 bg-border-card opacity-60 sm:block" aria-hidden />
              )}
              {!loading && (
                <span className="whitespace-nowrap">
                  <strong>Indicado:</strong> {formatMoney(totaisFiltrados.valorIndicado)}
                </span>
              )}
              {!loading && (
                <span className="whitespace-nowrap">
                  <strong>Empenhado:</strong> {formatMoney(totaisFiltrados.valorEmpenhado)}
                </span>
              )}
              {!loading && (
                <span className="whitespace-nowrap">
                  <strong>Pago:</strong> {formatMoney(totaisFiltrados.valorPago)}
                </span>
              )}
            </div>
            <div className="relative" ref={columnPickerRef}>
              <button
                type="button"
                onClick={() => setShowColumnPicker((s) => !s)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  isCockpit
                    ? 'border-white/20 bg-white/5 text-text-primary hover:bg-white/10'
                    : 'border-card bg-surface text-text-primary hover:bg-background',
                  showColumnPicker && (isCockpit ? 'ring-2 ring-accent-gold/40' : 'ring-2 ring-accent-gold/30'),
                )}
                aria-expanded={showColumnPicker}
                aria-haspopup="true"
              >
                <Columns2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Colunas
              </button>
              {showColumnPicker ? (
                <div
                  className={cn(
                    'absolute right-0 top-full z-30 mt-1 min-w-[min(100vw-2rem,280px)] max-w-[min(100vw-2rem,320px)] rounded-xl py-2 shadow-lg',
                    isCockpit
                      ? 'border border-white/12 bg-[linear-gradient(165deg,rgba(22,34,44,0.96)_0%,rgba(18,30,38,0.98)_100%)]'
                      : 'border border-card bg-bg-surface',
                  )}
                  role="menu"
                >
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-secondary">
                    Todos os campos — tabela e exportação
                  </div>
                  <div className="max-h-[min(70vh,26rem)] overflow-y-auto overscroll-contain [scrollbar-width:thin]">
                    {EMENDAS_LIST_COLUMN_KEYS.map((col) => (
                      <label
                        key={col}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-text-primary',
                          isCockpit ? 'hover:bg-white/10' : 'hover:bg-background',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns[col]}
                          onChange={() => toggleColumn(col)}
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 rounded border-card text-accent-gold focus:ring-accent-gold',
                            isCockpit && 'border-white/30 bg-white/5',
                          )}
                        />
                        <span className="min-w-0 leading-snug">{EMENDAS_LIST_COLUMN_LABELS[col]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className={cn('min-h-0 flex-1', tableShellClass)}>
            {loading ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent-gold" aria-hidden />
              </div>
            ) : rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-secondary">Nenhuma emenda cadastrada.</p>
            ) : filteredRows.length === 0 ? (
              <p className="p-8 text-center text-sm text-secondary">
                Nenhuma emenda corresponde aos filtros. Ajuste ou use Limpar.
              </p>
            ) : (
              <div className={tableScrollClass}>
                <table
                  className={cn(
                    'w-full text-left text-sm',
                    activeColumnList.length > 10
                      ? 'min-w-[1400px]'
                      : activeColumnList.length > 6
                        ? 'min-w-[1100px]'
                        : activeColumnList.length >= 4
                          ? 'min-w-[720px]'
                          : 'min-w-[480px]',
                  )}
                >
                  <thead>
                    <tr
                      className={cn(
                        'sticky top-0 z-10 border-b',
                        isCockpit ? 'border-white/10 bg-white/[0.06]' : 'border-card bg-white',
                      )}
                    >
                      {activeColumnList.map((col) => {
                        const isActive = sortColumn === col
                        return (
                          <th
                            key={col}
                            className={cn(
                              'px-4 py-2 font-semibold',
                              isCockpit ? 'text-text-primary' : 'text-black',
                            )}
                            scope="col"
                            aria-sort={
                              isActive ? (sortAsc ? 'ascending' : 'descending') : 'none'
                            }
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort(col)}
                              className={cn(
                                'flex w-full items-center gap-1 text-left transition-colors',
                                isCockpit ? 'hover:text-accent-gold' : 'hover:text-accent-gold',
                              )}
                              title={`Ordenar ${EMENDAS_LIST_COLUMN_LABELS[col]} (${isActive && !sortAsc ? 'A→Z' : 'Z→A'})`}
                            >
                              {EMENDAS_LIST_COLUMN_LABELS[col]}
                              {isActive ? (
                                sortAsc ? (
                                  <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                )
                              ) : (
                                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                              )}
                            </button>
                          </th>
                        )
                      })}
                      <th
                        className={cn(
                          'w-28 px-4 py-2 text-right font-semibold',
                          isCockpit ? 'text-text-primary' : 'text-black',
                        )}
                        scope="col"
                      >
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFilteredRows.map((r) => (
                      <tr
                        key={r.id}
                        className={cn(
                          'border-b hover:bg-accent-gold-soft/25',
                          isCockpit ? 'border-white/10' : 'border-card/80',
                        )}
                      >
                      {activeColumnList.map((col) => (
                        <td key={col} className={emendaListTdClass(col)} title={emendaCellTitle(r, col)}>
                          {renderEmendaListCell(r, col)}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="rounded-lg p-2 text-accent-gold hover:bg-accent-gold-soft/70"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDuplicate(r)}
                            className="rounded-lg p-2 text-text-secondary hover:bg-accent-gold-soft/70 hover:text-text-primary"
                            title="Duplicar"
                            aria-label="Duplicar emenda"
                          >
                            <Copy className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(r)}
                            disabled={deletingId === r.id}
                            className="rounded-lg p-2 text-status-danger hover:bg-status-danger/10 disabled:opacity-50"
                            title="Excluir"
                          >
                            {deletingId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden />
                            )}
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
      </div>

      {modalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="emenda-modal-title"
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border-card bg-bg-surface shadow-2xl">
            <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-border-card bg-bg-surface px-5 py-4">
              <h2 id="emenda-modal-title" className="text-base font-semibold text-text-primary">
                {editingId ? 'Editar Emenda' : isDuplicating ? 'Duplicar Emenda' : 'Nova Emenda'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-text-secondary hover:bg-accent-gold-soft/60 hover:text-text-primary"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <Field label="Bloco">
                    <input
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.bloco}
                      onChange={(ev) => setForm((s) => ({ ...s, bloco: ev.target.value }))}
                    />
                  </Field>
                  <Field label="Emenda">
                    <input
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.emenda}
                      onChange={(ev) => setForm((s) => ({ ...s, emenda: ev.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Exercício">
                    <input
                      type="number"
                      min={1900}
                      max={2100}
                      step={1}
                      inputMode="numeric"
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.exercicio}
                      onChange={(ev) => setForm((s) => ({ ...s, exercicio: ev.target.value }))}
                      placeholder="Ano da emenda"
                    />
                  </Field>
                  <Field label="Município / Beneficiário">
                    <p className="text-[0.7rem] leading-snug text-text-secondary">
                      Pode ser um dos 224 municípios do Piauí ou o nome de um órgão, secretaria ou outro
                      beneficiário.
                    </p>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.municipio_beneficiario}
                      onChange={(ev) =>
                        setForm((s) => ({ ...s, municipio_beneficiario: ev.target.value }))
                      }
                      placeholder="Ex.: Teresina, SESAPI, Secretaria Municipal de Saúde…"
                      autoComplete="off"
                    />
                    {loadingCities ? (
                      <div className="flex items-center gap-2 rounded-xl border border-border-card bg-bg-app px-3 py-2.5">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-gold" aria-hidden />
                        <span className="text-sm text-text-secondary">Carregando municípios…</span>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-xl border border-border-card/80 bg-bg-app/40 p-3">
                        <span className="text-xs font-medium text-text-secondary">
                          Atalho: escolher município do Piauí
                        </span>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                          placeholder="Buscar município (ex.: Teresina, Parnaíba…)"
                          value={municipioBusca}
                          onChange={(ev) => {
                            const q = ev.target.value
                            setMunicipioBusca(q)
                            const t = q.trim().toLowerCase()
                            if (!t) setFilteredCities(cities)
                            else
                              setFilteredCities(
                                cities.filter((c) => c.name.toLowerCase().includes(t))
                              )
                          }}
                          autoComplete="off"
                        />
                        <select
                          className="w-full rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                          style={{ maxHeight: 220, overflowY: 'auto' }}
                          value={
                            cities.find(
                              (c) => c.name.trim() === form.municipio_beneficiario.trim()
                            )?.id ?? ''
                          }
                          onChange={(ev) => {
                            const id = ev.target.value
                            if (!id) return
                            const city = cities.find((c) => c.id === id)
                            setForm((s) => ({
                              ...s,
                              municipio_beneficiario: city?.name?.trim() ?? '',
                            }))
                          }}
                        >
                          <option value="">Selecione para preencher o campo acima</option>
                          {(filteredCities.length > 0 ? filteredCities : cities).map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name}
                            </option>
                          ))}
                        </select>
                        {cities.length > 0 && (
                          <p className="text-[0.65rem] leading-snug text-text-secondary">
                            Lista com {cities.length} municípios. A escolha copia o nome para o
                            beneficiário.
                          </p>
                        )}
                      </div>
                    )}
                  </Field>
                  <Field label="Funcional">
                    <input
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.funcional}
                      onChange={(ev) => setForm((s) => ({ ...s, funcional: ev.target.value }))}
                    />
                  </Field>
                  <Field label="GND">
                    <input
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.gnd}
                      onChange={(ev) => setForm((s) => ({ ...s, gnd: ev.target.value }))}
                    />
                  </Field>
                  <Field label="Valor indicado">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.valor_indicado}
                      onChange={(ev) => setForm((s) => ({ ...s, valor_indicado: ev.target.value }))}
                    />
                  </Field>
                  <Field label="Valor empenhado">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.valor_empenhado}
                      onChange={(ev) => setForm((s) => ({ ...s, valor_empenhado: ev.target.value }))}
                    />
                  </Field>
                  <Field label="Valor a empenhar">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.valor_a_empenhar}
                      onChange={(ev) => setForm((s) => ({ ...s, valor_a_empenhar: ev.target.value }))}
                    />
                  </Field>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <Field label="Valor pago">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.valor_pago}
                      onChange={(ev) => setForm((s) => ({ ...s, valor_pago: ev.target.value }))}
                    />
                  </Field>
                  <Field label="Valor a ser pago">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.valor_a_ser_pago}
                      onChange={(ev) => setForm((s) => ({ ...s, valor_a_ser_pago: ev.target.value }))}
                    />
                  </Field>
                  <Field label="Empenho">
                    <input
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.empenho}
                      onChange={(ev) => setForm((s) => ({ ...s, empenho: ev.target.value }))}
                    />
                  </Field>
                  <Field label="Data do empenho">
                    <input
                      type="date"
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.data_empenho}
                      onChange={(ev) => setForm((s) => ({ ...s, data_empenho: ev.target.value }))}
                    />
                  </Field>
                  <Field label="Portaria / Convênio">
                    <input
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.portaria_convenio}
                      onChange={(ev) => setForm((s) => ({ ...s, portaria_convenio: ev.target.value }))}
                    />
                  </Field>
                  <Field label="Nº da proposta">
                    <input
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.numero_proposta}
                      onChange={(ev) => setForm((s) => ({ ...s, numero_proposta: ev.target.value }))}
                    />
                  </Field>
                  <Field label="Pagamento">
                    <input
                      type="date"
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.data_pagamento}
                      onChange={(ev) => setForm((s) => ({ ...s, data_pagamento: ev.target.value }))}
                    />
                  </Field>
                  <Field label="Lideranças">
                    <input
                      className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                      value={form.liderancas}
                      onChange={(ev) => setForm((s) => ({ ...s, liderancas: ev.target.value }))}
                    />
                  </Field>
                </div>
              </div>

              <Field label="Alteração">
                <input
                  className="rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                  value={form.alteracao}
                  onChange={(ev) => setForm((s) => ({ ...s, alteracao: ev.target.value }))}
                />
              </Field>
              <Field label="Objeto">
                <textarea
                  rows={4}
                  className="resize-y rounded-xl border border-border-card bg-bg-app px-3 py-2 text-sm text-text-primary outline-none ring-accent-gold/30 focus:ring-2"
                  value={form.objeto}
                  onChange={(ev) => setForm((s) => ({ ...s, objeto: ev.target.value }))}
                />
              </Field>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border-card bg-bg-surface px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-border-card bg-bg-app px-4 py-2 text-sm font-medium text-text-primary hover:bg-accent-gold-soft/50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className={sidebarPrimaryCTAButtonClass(isCockpit, 'min-w-[120px]')}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" aria-hidden />
                )}
                Salvar
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
