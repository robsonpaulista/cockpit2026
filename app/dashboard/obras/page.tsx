'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { Building2, Search, Plus, Edit, Trash2, Loader2, Upload, RefreshCw, Maximize2, Minimize2, FileSearch, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, CheckCircle, Columns3, FileDown, BadgeDollarSign, HardHat } from 'lucide-react'
import * as XLSX from 'xlsx'
import { cn } from '@/lib/utils'
import { ObrasImportModal } from '@/components/obras-import-modal'
import { ObraFormModal, OBRAS_TIPOS } from '@/components/obra-form-modal'
import { ObrasShell } from '@/components/obras/obras-shell'
import { ghostButtonClass, primaryButtonClass } from '@/lib/premium-ui-classes'
import { typographySectionTitleClass, typographySectionLeadClass } from '@/lib/typography-chrome'

type ObraTipoAba = string

/** Aba única na UI que agrupa Recap 2025 + Recap 2026 (e outras abas Recap do storage). */
const RECAP_UI_TAB = 'Recap'

function normalizeObraTipo(tipo: string | null | undefined): string {
  return (tipo ?? '').trim() || 'obras diversas'
}

/** Nome da aba no JSON local (Recap 2025 / Recap 2026) — necessário para APIs de storage. */
function recapStorageTabOf(obra: { tipo?: string | null }, fallback?: string): string {
  const t = normalizeObraTipo(obra.tipo)
  if (/^recap\b/i.test(t)) return t
  return fallback?.trim() || t
}

interface Obra {
  id: string
  municipio?: string
  obra: string
  tipo?: string | null
  orgao?: string
  sei?: string
  sei_url?: string | null
  sei_medicao?: string
  sei_ultimo_andamento?: string | null
  sei_ultimo_andamento_data?: string | null
  sei_ultimo_status?: string | null
  sei_ultimo_status_data?: string | null
  sei_plano_trabalho_url?: string | null
  sei_plano_trabalho_tipo?: string | null
  sei_plano_trabalho_numero?: string | null
  sei_alerta_andamento_desatualizado?: boolean
  sei_data_mais_recente_concluido?: string | null
  sei_descricao_mais_recente_concluido?: string | null
  sei_todos_andamentos_concluidos?: boolean
  status?: string
  publicacao_os?: string
  solicitacao_medicao?: string
  data_medicao?: string
  status_medicao?: string
  valor_total?: number
  valor_pago?: number
  data_pagamento?: string
  nro_doc?: string
  imagem_url?: string | null
  doe_edicao?: string | null
  doe_resumo?: string | null
  doe_pdf_url?: string | null
  doe_nota_uuid?: string | null
  doe_encontrados?: number | null
  doe_registros?: Array<{
    edicao: string
    titulo?: string | null
    dia?: string | null
    resumo: string
    pdfUrl?: string | null
    notaUuid: string
  }> | null
  doe_consultado_em?: string | null
  created_at?: string
  updated_at?: string
}

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [recapObras, setRecapObras] = useState<Obra[]>([])
  const [recapTabs, setRecapTabs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMunicipio, setFilterMunicipio] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterStatusMedicao, setFilterStatusMedicao] = useState('')
  const [filterOrgao, setFilterOrgao] = useState('')
  const [filterPagamento, setFilterPagamento] = useState<'' | 'pago' | 'nao_pago'>('')
  const [activeTab, setActiveTab] = useState<ObraTipoAba>(RECAP_UI_TAB)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [formObra, setFormObra] = useState<Obra | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [editingSeiObraId, setEditingSeiObraId] = useState<string | null>(null)
  const [editingSeiUrl, setEditingSeiUrl] = useState('')
  const [savingSeiUrl, setSavingSeiUrl] = useState(false)

  type EditableField = 'status' | 'publicacao_os' | 'data_medicao' | 'status_medicao'
  const [editingCell, setEditingCell] = useState<{ obraId: string; field: EditableField } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingCell, setSavingCell] = useState(false)
  const [seiStatusUpdating, setSeiStatusUpdating] = useState(false)
  const [seiStatusProgress, setSeiStatusProgress] = useState({ current: 0, total: 0, lastError: '' })
  type SortColumn = 'municipio' | 'obra' | 'orgao' | 'sei' | 'valor_total' | 'sei_ultimo_andamento' | 'sei_ultimo_status' | 'sei_plano_trabalho_url' | 'doe_edicao' | 'doe_resumo' | 'status' | 'publicacao_os' | 'data_medicao' | 'status_medicao'
  const TABLE_COLUMNS: SortColumn[] = ['municipio', 'obra', 'orgao', 'sei', 'valor_total', 'sei_ultimo_andamento', 'sei_ultimo_status', 'sei_plano_trabalho_url', 'doe_edicao', 'doe_resumo', 'status', 'publicacao_os', 'data_medicao', 'status_medicao']
  const COLUMN_LABELS: Record<SortColumn, string> = {
    municipio: 'Município', obra: 'Obra', orgao: 'Órgão', sei: 'SEI',
    valor_total: 'Valor Total', sei_ultimo_andamento: 'Últ. andamento SEI', sei_ultimo_status: 'Últ. Status SEI',
    sei_plano_trabalho_url: 'Plano / Relatório',
    doe_edicao: 'DOE edição', doe_resumo: 'DOE resumo',
    status: 'Status', publicacao_os: 'Pub. OS', data_medicao: 'Data Medição', status_medicao: 'Status Medição',
  }
  const [visibleColumns, setVisibleColumns] = useState<Record<SortColumn, boolean>>(() => {
    if (typeof window === 'undefined') return TABLE_COLUMNS.reduce((acc, c) => ({ ...acc, [c]: true }), {} as Record<SortColumn, boolean>)
    try {
      const saved = window.localStorage.getItem('obras-visible-columns')
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>
        const out = TABLE_COLUMNS.reduce((acc, c) => ({ ...acc, [c]: parsed[c] !== false }), {} as Record<SortColumn, boolean>)
        return out
      }
    } catch { /* ignore */ }
    return TABLE_COLUMNS.reduce((acc, c) => ({ ...acc, [c]: true }), {} as Record<SortColumn, boolean>)
  })
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const columnPickerRef = useRef<HTMLDivElement>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  useEffect(() => {
    fetchObras()
    void fetchRecap()
  }, [])

  const isRecapTab = useMemo(
    () => activeTab === RECAP_UI_TAB || recapTabs.includes(activeTab),
    [recapTabs, activeTab],
  )

  useEffect(() => {
    if (recapTabs.length === 0) return
    if (activeTab === RECAP_UI_TAB) return
    if (recapTabs.includes(activeTab)) {
      setActiveTab(RECAP_UI_TAB)
    }
  }, [recapTabs, activeTab])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false)
      if (e.key === 'Escape' && showColumnPicker) setShowColumnPicker(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen, showColumnPicker])

  useEffect(() => {
    if (!showColumnPicker) return
    const onMouseDown = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false)
      }
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [showColumnPicker])

  useEffect(() => {
    try {
      window.localStorage.setItem('obras-visible-columns', JSON.stringify(visibleColumns))
    } catch { /* ignore */ }
  }, [visibleColumns])

  const toggleColumn = (col: SortColumn) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [col]: !prev[col] }
      const visibleCount = TABLE_COLUMNS.filter((c) => next[c]).length
      if (visibleCount === 0) return prev
      return next
    })
  }

  const visibleColsList = useMemo(() => TABLE_COLUMNS.filter((c) => visibleColumns[c]), [visibleColumns])

  const handleExportExcel = () => {
    const rows = sortedObras.map((o) => {
      const row: Record<string, string | number> = {}
      visibleColsList.forEach((col) => {
        const label = COLUMN_LABELS[col]
        const v = o[col]
        if (col === 'valor_total') row[label] = typeof v === 'number' ? v : 0
        else if (col === 'publicacao_os' || col === 'data_medicao') row[label] = v && typeof v === 'string' ? (formatDateFull(v) ?? v) : ''
        else if (col === 'sei_ultimo_andamento' || col === 'sei_ultimo_status') {
          const dataStr = col === 'sei_ultimo_andamento' ? o.sei_ultimo_andamento_data : o.sei_ultimo_status_data
          const dataFmt = dataStr && typeof dataStr === 'string' ? (() => { try { const d = new Date(dataStr); return Number.isNaN(d.getTime()) ? dataStr : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return dataStr; } })() : ''
          row[label] = [dataFmt, (v && String(v)) || ''].filter(Boolean).join(' — ') || '-'
        } else if (col === 'doe_edicao') {
          row[label] =
            o.doe_encontrados === 0
              ? 'Sem ocorrência'
              : typeof v === 'string'
                ? v
                : ''
        } else if (col === 'doe_resumo') {
          row[label] = typeof v === 'string' ? v : ''
        } else {
          row[label] = v != null ? String(v) : ''
        }
      })
      return row
    })
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'Nenhum registro' }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lista de Obras')
    XLSX.writeFile(wb, `lista-obras-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleSeiCellDoubleClick = (obra: Obra) => {
    if (obra.sei_url?.trim()) {
      const url = obra.sei_url.startsWith('http') ? obra.sei_url : 'https://' + obra.sei_url
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    setEditingSeiObraId(obra.id)
    setEditingSeiUrl('')
  }

  /** Interpreta YYYY-MM-DD como data local (evita dia a menos por UTC). */
  const parseDateOnly = (dateString: string): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null
    const m = dateString.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    const y = parseInt(m[1], 10)
    const mo = parseInt(m[2], 10) - 1
    const d = parseInt(m[3], 10)
    const date = new Date(y, mo, d)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const toYyyyMmDd = (dateString?: string): string => {
    if (!dateString) return ''
    const d = parseDateOnly(dateString)
    if (!d) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const SEI_ANDAMENTO_DELAY_MS = 3500
  const DOE_BUSCA_DELAY_MS = 2500
  const [doeUpdating, setDoeUpdating] = useState(false)
  const [doeProgress, setDoeProgress] = useState({ current: 0, total: 0, lastError: '' })

  const handleConsultarDoe = async () => {
    if (!isRecapTab) {
      alert('A consulta DOE funciona nas abas importadas (storage local).')
      return
    }
    const alvos = filteredObras.filter((o) => (o.sei ?? '').trim())
    if (alvos.length === 0) {
      alert('Nenhuma obra com SEI na aba atual.')
      return
    }
    if (
      !window.confirm(
        `Consultar Diário Oficial do PI para ${alvos.length} SEI(s) do Recap?\nCada SEI será buscado em diario.pi.gov.br e o resumo será salvo no storage local.`,
      )
    ) {
      return
    }
    setDoeUpdating(true)
    setDoeProgress({ current: 0, total: alvos.length, lastError: '' })
    let ok = 0
    let lastError = ''
    for (let i = 0; i < alvos.length; i++) {
      const obra = alvos[i]
      const tabName = recapStorageTabOf(obra)
      setDoeProgress({ current: i + 1, total: alvos.length, lastError })
      try {
        const res = await fetch('/api/obras/doe-busca', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            obraId: obra.id,
            sei: obra.sei,
            tabName,
            persist: true,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.obra) {
          ok++
          const updated = { ...data.obra, tipo: data.obra.tipo ?? tabName }
          setRecapObras((prev) =>
            prev.map((o) => (o.id === obra.id ? { ...o, ...updated } : o)),
          )
        } else {
          lastError = data.error || `Status ${res.status}`
          setDoeProgress((p) => ({ ...p, lastError }))
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Erro de rede'
        setDoeProgress((p) => ({ ...p, lastError }))
      }
      if (i < alvos.length - 1) {
        await new Promise((r) => setTimeout(r, DOE_BUSCA_DELAY_MS))
      }
    }
    setDoeProgress((p) => ({ ...p, lastError }))
    setDoeUpdating(false)
    alert(
      `DOE: ${ok} de ${alvos.length} consultados.${lastError ? ` Último erro: ${lastError}` : ''}`,
    )
  }

  const handleAtualizarAndamentosSei = async () => {
    if (isRecapTab) {
      const alvos = filteredObras.filter(
        (o) => (o.sei ?? '').trim() || (o.sei_url ?? '').trim(),
      )
      if (alvos.length === 0) {
        alert('Nenhuma obra Recap com número SEI nesta aba.')
        return
      }
      if (
        !window.confirm(
          `Atualizar andamentos SEI de ${alvos.length} obra(s) do Recap?\n` +
            'Resolve o link do processo na Pesquisa Pública e grava o andamento no banco.',
        )
      ) {
        return
      }
      setSeiStatusUpdating(true)
      setSeiStatusProgress({ current: 0, total: alvos.length, lastError: '' })
      let ok = 0
      let lastError = ''
      for (let i = 0; i < alvos.length; i++) {
        const obra = alvos[i]
        const tabName = recapStorageTabOf(obra)
        setSeiStatusProgress({ current: i + 1, total: alvos.length, lastError })
        try {
          const res = await fetch('/api/obras/recap/sei-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              obraId: obra.id,
              tabName,
              sei: obra.sei,
              url: obra.sei_url,
            }),
          })
          const data = await res.json().catch(() => ({}))
          if (res.ok && data.obra) {
            ok++
            setRecapObras((prev) =>
              prev.map((o) =>
                o.id === obra.id ? { ...o, ...data.obra, tipo: tabName } : o,
              ),
            )
          } else {
            lastError = data.error || data.details || `Status ${res.status}`
            setSeiStatusProgress((p) => ({ ...p, lastError }))
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'Erro de rede'
          setSeiStatusProgress((p) => ({ ...p, lastError }))
        }
        if (i < alvos.length - 1) {
          await new Promise((r) => setTimeout(r, SEI_ANDAMENTO_DELAY_MS))
        }
      }
      setSeiStatusProgress((p) => ({ ...p, lastError }))
      setSeiStatusUpdating(false)
      alert(
        `Recap SEI: ${ok} de ${alvos.length} atualizados.${lastError ? ` Último erro: ${lastError}` : ''}`,
      )
      return
    }

    // Buscar TODAS as obras (sem filtros) para incluir as de qualquer aba/filtro
    let todasObras: Obra[] = []
    try {
      const res = await fetch('/api/obras')
      if (res.ok) {
        const data = await res.json()
        todasObras = data.obras ?? []
      }
    } catch {
      alert('Erro ao carregar a lista de obras.')
      return
    }
    const comLink = todasObras.filter((o) => o.sei_url?.trim())
    if (comLink.length === 0) {
      alert('Nenhuma obra com link do SEI preenchido.')
      return
    }
    if (!window.confirm(`Atualizar último andamento SEI de ${comLink.length} obra(s)? Será feita uma requisição por obra, com intervalo de alguns segundos para evitar bloqueio.`)) {
      return
    }
    setSeiStatusUpdating(true)
    setSeiStatusProgress({ current: 0, total: comLink.length, lastError: '' })
    let ok = 0
    let lastError = ''
    for (let i = 0; i < comLink.length; i++) {
      const obra = comLink[i]
      const url = obra.sei_url!.startsWith('http') ? obra.sei_url! : 'https://' + obra.sei_url!
      setSeiStatusProgress({ current: i + 1, total: comLink.length, lastError })
      try {
        const res = await fetch('/api/obras/sei-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.descricao != null) {
          const patchRes = await fetch(`/api/obras/${obra.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sei_ultimo_andamento: data.descricao,
              sei_ultimo_andamento_data: data.dataIso ?? data.data ?? null,
              sei_alerta_andamento_desatualizado: data.alerta_andamento_desatualizado ?? false,
              sei_data_mais_recente_concluido: data.sei_data_mais_recente_concluido ?? null,
              sei_descricao_mais_recente_concluido: data.sei_descricao_mais_recente_concluido ?? null,
              sei_todos_andamentos_concluidos: data.todos_andamentos_concluidos ?? false,
              sei_ultimo_status: data.sei_ultimo_status ?? null,
              sei_ultimo_status_data: data.sei_ultimo_status_data ?? null,
              sei_plano_trabalho_url: data.sei_plano_trabalho_url ?? null,
              sei_plano_trabalho_tipo: data.sei_plano_trabalho_tipo ?? null,
              sei_plano_trabalho_numero: data.sei_plano_trabalho_numero ?? null,
            }),
          })
          if (patchRes.ok) {
            ok++
            const { obra: updated } = await patchRes.json()
            setObras((prev) => prev.map((o) => (o.id === obra.id ? { ...o, ...updated } : o)))
          }
        } else {
          lastError = data.error || data.details || `Status ${res.status}`
          setSeiStatusProgress((p) => ({ ...p, lastError }))
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Erro de rede'
        setSeiStatusProgress((p) => ({ ...p, lastError }))
      }
      if (i < comLink.length - 1) {
        await new Promise((r) => setTimeout(r, SEI_ANDAMENTO_DELAY_MS))
      }
    }
    setSeiStatusProgress((p) => ({ ...p, lastError }))
    setSeiStatusUpdating(false)
    alert(`Concluído: ${ok} de ${comLink.length} andamentos atualizados.${lastError ? ` Último erro: ${lastError}` : ''}`)
  }

  const [updatingSeiObraId, setUpdatingSeiObraId] = useState<string | null>(null)

  const handleAtualizarAndamentoSeiUnico = async (obra: Obra) => {
    if (isRecapTab) {
      if (!(obra.sei ?? '').trim() && !(obra.sei_url ?? '').trim()) return
      const tabName = recapStorageTabOf(obra)
      setUpdatingSeiObraId(obra.id)
      try {
        const res = await fetch('/api/obras/recap/sei-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            obraId: obra.id,
            tabName,
            sei: obra.sei,
            url: obra.sei_url,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.obra) {
          setRecapObras((prev) =>
            prev.map((o) =>
              o.id === obra.id ? { ...o, ...data.obra, tipo: tabName } : o,
            ),
          )
        } else {
          alert(data.error || data.details || 'Erro ao atualizar andamento SEI.')
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Erro de rede')
      } finally {
        setUpdatingSeiObraId(null)
      }
      return
    }

    if (!obra.sei_url?.trim()) return
    const url = obra.sei_url.startsWith('http') ? obra.sei_url : 'https://' + obra.sei_url
    setUpdatingSeiObraId(obra.id)
    try {
      const res = await fetch('/api/obras/sei-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.descricao != null) {
        const patchRes = await fetch(`/api/obras/${obra.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sei_ultimo_andamento: data.descricao,
            sei_ultimo_andamento_data: data.dataIso ?? data.data ?? null,
            sei_alerta_andamento_desatualizado: data.alerta_andamento_desatualizado ?? false,
            sei_data_mais_recente_concluido: data.sei_data_mais_recente_concluido ?? null,
            sei_descricao_mais_recente_concluido: data.sei_descricao_mais_recente_concluido ?? null,
            sei_todos_andamentos_concluidos: data.todos_andamentos_concluidos ?? false,
            sei_ultimo_status: data.sei_ultimo_status ?? null,
            sei_ultimo_status_data: data.sei_ultimo_status_data ?? null,
            sei_plano_trabalho_url: data.sei_plano_trabalho_url ?? null,
            sei_plano_trabalho_tipo: data.sei_plano_trabalho_tipo ?? null,
            sei_plano_trabalho_numero: data.sei_plano_trabalho_numero ?? null,
          }),
        })
        if (patchRes.ok) {
          const { obra: updated } = await patchRes.json()
          setObras((prev) => prev.map((o) => (o.id === obra.id ? { ...o, ...updated } : o)))
        } else {
          const err = (await patchRes.json().catch(() => ({}))).error
          alert(err || 'Erro ao salvar andamento.')
        }
      } else {
        alert(data.error || 'Não foi possível obter o andamento do SEI.')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao atualizar.')
    } finally {
      setUpdatingSeiObraId(null)
    }
  }

  const startEditCell = (obra: Obra, field: EditableField) => {
    setEditingCell({ obraId: obra.id, field })
    const val = obra[field]
    setEditingValue(
      field === 'publicacao_os' || field === 'data_medicao' ? toYyyyMmDd(val) : (val || '')
    )
  }

  const saveEditCell = async () => {
    if (!editingCell) return
    setSavingCell(true)
    try {
      const payload: Record<string, string | null> = {
        [editingCell.field]: editingValue.trim() || null,
      }
      const res = await fetch(`/api/obras/${editingCell.obraId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const { obra: updated } = await res.json()
        setObras((prev) =>
          prev.map((o) => (o.id === editingCell.obraId ? { ...o, ...updated } : o))
        )
      }
    } finally {
      setSavingCell(false)
      setEditingCell(null)
      setEditingValue('')
    }
  }

  const cancelEditCell = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  const handleDeleteObra = async (obra: Obra) => {
    if (!window.confirm(`Excluir a obra "${obra.obra}"?`)) return
    setDeletingId(obra.id)
    try {
      const res = await fetch(`/api/obras/${obra.id}`, { method: 'DELETE' })
      if (res.ok) await fetchObras()
      else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Erro ao excluir obra.')
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleSeiUrlOpen = async () => {
    let url = editingSeiUrl.trim()
    if (!url) return
    if (!editingSeiObraId) return
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    setSavingSeiUrl(true)
    try {
      if (isRecapTab) {
        const obra = recapObras.find((o) => o.id === editingSeiObraId)
        if (!obra?.sei?.trim()) {
          alert('Obra Recap sem número SEI — não é possível salvar o link no banco.')
          return
        }
        const tabName = recapStorageTabOf(obra)
        const res = await fetch('/api/obras/recap/sei-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            obraId: obra.id,
            tabName,
            sei: obra.sei,
            url,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          const savedUrl = (data.sei_url as string) || url
          setRecapObras((prev) =>
            prev.map((o) =>
              o.id === editingSeiObraId
                ? { ...o, sei_url: savedUrl, tipo: tabName }
                : o,
            ),
          )
          window.open(savedUrl, '_blank', 'noopener,noreferrer')
        } else {
          alert(data.error || 'Erro ao salvar link SEI.')
        }
        return
      }

      const res = await fetch(`/api/obras/${editingSeiObraId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sei_url: url }),
      })
      if (res.ok) {
        setObras((prev) =>
          prev.map((o) =>
            o.id === editingSeiObraId ? { ...o, sei_url: url } : o
          )
        )
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } finally {
      setSavingSeiUrl(false)
      setEditingSeiObraId(null)
      setEditingSeiUrl('')
    }
  }

  const fetchObras = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/obras')
      if (response.ok) {
        const data = await response.json()
        setObras(data.obras || [])
      }
    } catch (error) {
      console.error('Erro ao buscar obras:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecap = async () => {
    try {
      const response = await fetch('/api/obras/recap', { cache: 'no-store' })
      if (!response.ok) return
      const data = (await response.json()) as {
        tabs?: string[]
        obras?: Obra[]
      }
      setRecapTabs(Array.isArray(data.tabs) ? data.tabs : [])
      setRecapObras(
        (Array.isArray(data.obras) ? data.obras : []).map((o) => ({
          ...o,
          tipo: o.tipo ?? null,
        })),
      )
    } catch (error) {
      console.error('Erro ao buscar recap storage:', error)
    }
  }

  const tabs = useMemo(() => {
    // Pavimentação e Obras diversas ficam ocultas; Recap 2025/2026 viram uma aba única.
    const extras = new Set<string>()
    if (recapTabs.length > 0) extras.add(RECAP_UI_TAB)
    for (const obra of obras) {
      const t = normalizeObraTipo(obra.tipo)
      if ((OBRAS_TIPOS as readonly string[]).includes(t as (typeof OBRAS_TIPOS)[number])) continue
      if (recapTabs.includes(t) || /^recap\b/i.test(t)) continue
      extras.add(t)
    }
    return [...extras].sort((a, b) => {
      if (a === RECAP_UI_TAB) return -1
      if (b === RECAP_UI_TAB) return 1
      return a.localeCompare(b, 'pt-BR')
    })
  }, [obras, recapTabs])

  const filteredObras = useMemo(() => {
    const source = isRecapTab ? recapObras : obras
    let items = isRecapTab
      ? [...source]
      : source.filter((obra) => normalizeObraTipo(obra.tipo) === activeTab)

    if (filterMunicipio) {
      const alvo = filterMunicipio.trim().toLowerCase()
      items = items.filter(
        (o) => (o.municipio ?? '').trim().toLowerCase() === alvo,
      )
    }
    if (filterStatus) {
      items = items.filter((o) => (o.status ?? '') === filterStatus)
    }
    if (filterStatusMedicao) {
      items = items.filter((o) => (o.status_medicao ?? '') === filterStatusMedicao)
    }
    if (filterOrgao) {
      items = items.filter((o) => (o.orgao ?? '') === filterOrgao)
    }
    if (filterPagamento === 'pago') {
      items = items.filter((o) => o.valor_pago && o.valor_pago > 0)
    } else if (filterPagamento === 'nao_pago') {
      items = items.filter((o) => !o.valor_pago || o.valor_pago <= 0)
    }
    if (!searchTerm) return items
    const term = searchTerm.toLowerCase()
    return items.filter((obra) => {
      return (
        obra.obra?.toLowerCase().includes(term) ||
        obra.municipio?.toLowerCase().includes(term) ||
        obra.orgao?.toLowerCase().includes(term) ||
        obra.sei?.toLowerCase().includes(term) ||
        obra.sei_medicao?.toLowerCase().includes(term)
      )
    })
  }, [
    obras,
    recapObras,
    isRecapTab,
    searchTerm,
    activeTab,
    filterMunicipio,
    filterStatus,
    filterStatusMedicao,
    filterOrgao,
    filterPagamento,
  ])

  const toggleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortAsc((a) => !a)
    } else {
      setSortColumn(col)
      setSortAsc(true)
    }
  }

  const sortedObras = useMemo(() => {
    if (!sortColumn) return filteredObras
    const getVal = (o: Obra): string | number => {
      switch (sortColumn) {
        case 'municipio': return (o.municipio ?? '').toLowerCase()
        case 'obra': return (o.obra ?? '').toLowerCase()
        case 'orgao': return (o.orgao ?? '').toLowerCase()
        case 'sei': return (o.sei ?? '').toLowerCase()
        case 'valor_total': return o.valor_total ?? 0
        case 'sei_ultimo_andamento': return o.sei_ultimo_andamento_data ? new Date(o.sei_ultimo_andamento_data).getTime() : 0
        case 'sei_ultimo_status': return o.sei_ultimo_status_data ? new Date(o.sei_ultimo_status_data).getTime() : (o.sei_ultimo_status ?? '').toLowerCase()
        case 'sei_plano_trabalho_url': return (o.sei_plano_trabalho_tipo ?? o.sei_plano_trabalho_numero ?? o.sei_plano_trabalho_url ?? '').toLowerCase()
        case 'doe_edicao': return (o.doe_edicao ?? '').toLowerCase()
        case 'doe_resumo': return (o.doe_resumo ?? '').toLowerCase()
        case 'status': return (o.status ?? '').toLowerCase()
        case 'publicacao_os': {
          const d = parseDateOnly(o.publicacao_os ?? '')
          return d ? d.getTime() : 0
        }
        case 'data_medicao': {
          const d = parseDateOnly(o.data_medicao ?? '')
          return d ? d.getTime() : 0
        }
        case 'status_medicao': return (o.status_medicao ?? '').toLowerCase()
        default: return ''
      }
    }
    return [...filteredObras].sort((a, b) => {
      const va = getVal(a)
      const vb = getVal(b)
      const cmp = typeof va === 'string' && typeof vb === 'string'
        ? va.localeCompare(vb, 'pt-BR')
        : (Number(va) - Number(vb))
      return sortAsc ? cmp : -cmp
    })
  }, [filteredObras, sortColumn, sortAsc])

  // Obter valores únicos para filtros a partir da fonte ativa (Recap unificado ou DB)
  const filterSource = isRecapTab ? recapObras : obras

  const municipios = useMemo(() => {
    return Array.from(
      new Set(
        filterSource
          .map((o) => (o.municipio ?? '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [filterSource])

  const statusList = useMemo(() => {
    return Array.from(new Set(filterSource.map((o) => o.status).filter(Boolean))).sort()
  }, [filterSource])

  const statusMedicaoList = useMemo(() => {
    return Array.from(new Set(filterSource.map((o) => o.status_medicao).filter(Boolean))).sort()
  }, [filterSource])

  const orgaos = useMemo(() => {
    return Array.from(new Set(filterSource.map((o) => o.orgao).filter(Boolean))).sort()
  }, [filterSource])

  const formatCurrency = (value?: number) => {
    if (!value) return '-'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const hubTabs = useMemo(
    () =>
      tabs.map((tipo) => {
        const count =
          tipo === RECAP_UI_TAB
            ? recapObras.length
            : obras.filter((o) => normalizeObraTipo(o.tipo) === tipo).length
        const label = tipo.charAt(0).toUpperCase() + tipo.slice(1)
        return {
          id: tipo,
          label: count > 0 ? `${label} (${count})` : label,
          icon: HardHat,
        }
      }),
    [tabs, obras, recapObras],
  )

  const formatDateFull = (dateString?: string) => {
    if (!dateString) return '-'
    const date = parseDateOnly(dateString)
    if (!date) return dateString
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const selectClass =
    'h-9 w-full rounded-lg border border-card bg-background px-3 text-xs text-text-primary outline-none focus:border-[#ff9800]'

  const obrasMainContent = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cn(typographySectionTitleClass, 'flex items-center gap-2 text-base')}>
            <HardHat className="h-4 w-4 text-[#ff9800]" aria-hidden />
            Lista de obras
          </h2>
          <p className={cn(typographySectionLeadClass, 'mt-1')}>
            {filteredObras.length} registro{filteredObras.length !== 1 ? 's' : ''} em {activeTab}
            {searchTerm || filterMunicipio || filterStatus || filterStatusMedicao || filterOrgao || filterPagamento
              ? ' · filtros ativos'
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFormObra(null)
              setShowFormModal(true)
            }}
            className={cn(primaryButtonClass, 'h-9 px-3')}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova obra
          </button>
          <button
            type="button"
            onClick={() => {
              void fetchObras()
              void fetchRecap()
            }}
            disabled={loading}
            className={cn(ghostButtonClass, 'h-9 disabled:opacity-50')}
            title="Atualizar lista"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className={cn(ghostButtonClass, 'h-9')}
            title="Importa planilha para storage local (data/obras-recap.json)"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar
          </button>
          <button
            type="button"
            onClick={handleAtualizarAndamentosSei}
            disabled={
              seiStatusUpdating ||
              (isRecapTab
                ? filteredObras.filter(
                    (o) => (o.sei ?? '').trim() || (o.sei_url ?? '').trim(),
                  ).length === 0
                : obras.filter((o) => o.sei_url?.trim()).length === 0)
            }
            className={cn(ghostButtonClass, 'h-9 disabled:opacity-50')}
            title={
              isRecapTab
                ? 'Resolve o link do processo pelo número SEI e grava o andamento no banco'
                : 'Buscar último andamento (andamento/Aberto) em cada link SEI'
            }
          >
            <FileSearch className={cn('h-3.5 w-3.5', seiStatusUpdating && 'animate-pulse')} />
            {seiStatusUpdating
              ? `SEI (${seiStatusProgress.current}/${seiStatusProgress.total})`
              : 'Andamentos SEI'}
          </button>
          <button
            type="button"
            onClick={() => void handleConsultarDoe()}
            disabled={
              doeUpdating ||
              !isRecapTab ||
              filteredObras.filter((o) => (o.sei ?? '').trim()).length === 0
            }
            className={cn(ghostButtonClass, 'h-9 disabled:opacity-50')}
            title={
              isRecapTab
                ? 'Buscar cada SEI no Diário Oficial do PI e salvar o resumo no storage local'
                : 'Disponível nas abas importadas (storage local)'
            }
          >
            <FileSearch className={cn('h-3.5 w-3.5', doeUpdating && 'animate-pulse')} />
            {doeUpdating ? `DOE (${doeProgress.current}/${doeProgress.total})` : 'Consultar DOE'}
          </button>
          <div className="relative" ref={columnPickerRef}>
            <button
              type="button"
              onClick={() => setShowColumnPicker((v) => !v)}
              className={cn(ghostButtonClass, 'h-9')}
              title="Mostrar ou ocultar colunas"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Colunas
            </button>
            {showColumnPicker && (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-xl border border-card bg-surface py-2 shadow-sm">
                <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-text-muted">
                  Colunas visíveis
                </div>
                {TABLE_COLUMNS.map((col) => (
                  <label
                    key={col}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-bg-app"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[col]}
                      onChange={() => toggleColumn(col)}
                      className="rounded border-card"
                    />
                    <span className="text-xs">{COLUMN_LABELS[col]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={sortedObras.length === 0}
            className={cn(ghostButtonClass, 'h-9 disabled:opacity-50')}
            title="Exportar lista visível para Excel"
          >
            <FileDown className="h-3.5 w-3.5" />
            Exportar
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            className={cn(ghostButtonClass, 'h-9')}
            title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{fullscreen ? 'Sair' : 'Tela cheia'}</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-card bg-surface p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Buscar por nome, município, órgão, SEI…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-lg border border-card bg-background pl-8 pr-3 text-xs text-text-primary outline-none focus:border-[#ff9800]"
            />
          </div>
          <select
            value={filterMunicipio}
            onChange={(e) => setFilterMunicipio(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos os municípios</option>
            {municipios.map((municipio) => (
              <option key={municipio} value={municipio}>
                {municipio}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos os status</option>
            {statusList.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={filterStatusMedicao}
            onChange={(e) => setFilterStatusMedicao(e.target.value)}
            className={selectClass}
          >
            <option value="">Status de medição</option>
            {statusMedicaoList.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={filterOrgao}
            onChange={(e) => setFilterOrgao(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos os órgãos</option>
            {orgaos.map((orgao) => (
              <option key={orgao} value={orgao}>
                {orgao}
              </option>
            ))}
          </select>
          <select
            value={filterPagamento}
            onChange={(e) => setFilterPagamento(e.target.value as '' | 'pago' | 'nao_pago')}
            className={selectClass}
          >
            <option value="">Pagamento: todos</option>
            <option value="pago">Somente pagos</option>
            <option value="nao_pago">Somente não pagos</option>
          </select>
        </div>
      </div>

      <article className="overflow-hidden rounded-xl border border-card bg-surface shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-[#ff9800]" />
              <span className="ml-2 text-sm text-text-secondary">Carregando obras...</span>
            </div>
          ) : filteredObras.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <Building2 className="mx-auto mb-3 h-12 w-12 text-text-muted opacity-40" />
              <p className="text-sm text-text-secondary">
                {searchTerm || filterMunicipio || filterStatus || filterStatusMedicao || filterOrgao || filterPagamento
                  ? 'Nenhuma obra encontrada com os filtros aplicados'
                  : `Nenhuma obra do tipo "${activeTab}" cadastrada.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="obras-table w-full text-[13px]">
                <thead className="bg-background border-b border-card">
                  <tr>
                    {visibleColsList.map((col) => {
                      const isActive = sortColumn === col
                      const isFirstVisible = visibleColsList[0] === col
                      const stickyClass = isFirstVisible ? 'sticky left-0 z-10 bg-background border-r border-card' : ''
                      const thClass = [
                        'px-2.5 py-1.5 text-left text-[11px] font-medium text-secondary uppercase tracking-wider',
                        stickyClass,
                        col === 'municipio'
                          ? 'w-px whitespace-nowrap'
                          : col === 'obra'
                            ? 'w-full min-w-[14rem]'
                            : col === 'orgao' || col === 'sei' || col === 'valor_total' || col === 'status' || col === 'publicacao_os' || col === 'data_medicao' || col === 'status_medicao'
                              ? 'w-px whitespace-nowrap'
                              : col === 'sei_ultimo_andamento' || col === 'sei_ultimo_status'
                                ? 'min-w-[10rem] max-w-[14rem]'
                                : col === 'sei_plano_trabalho_url' || col === 'doe_edicao'
                                  ? 'w-px whitespace-nowrap'
                                  : col === 'doe_resumo'
                                    ? 'min-w-[10rem] max-w-[16rem]'
                                    : 'w-px whitespace-nowrap',
                      ].filter(Boolean).join(' ')
                      return (
                        <th key={col} className={thClass}>
                          <button
                            type="button"
                            onClick={() => toggleSort(col)}
                            className="flex items-center gap-1 hover:text-text-primary transition-colors w-full text-left"
                            title={`Ordenar ${COLUMN_LABELS[col]} (${sortColumn === col && !sortAsc ? 'A→Z' : 'Z→A'})`}
                          >
                            {COLUMN_LABELS[col]}
                            {isActive ? (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                          </button>
                        </th>
                      )
                    })}
                    <th className="px-2.5 py-1.5 text-left text-[11px] font-medium text-secondary uppercase tracking-wider w-px whitespace-nowrap">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card bg-surface">
                  {sortedObras.map((obra) => {
                    const isPago = Boolean(obra.valor_pago && obra.valor_pago > 0)
                    return (
                    <tr key={obra.id} className={cn('group transition-colors', isPago && 'obras-row-pago')}>
                      {visibleColumns.municipio && (
                        <td className={`px-2.5 py-1.5 w-px whitespace-nowrap ${visibleColsList[0] === 'municipio' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}>
                          <div className="font-medium text-text-primary">{obra.municipio || '-'}</div>
                          {isRecapTab && obra.tipo ? (
                            <div className="mt-0.5 text-[10px] text-text-secondary">
                              {normalizeObraTipo(obra.tipo)}
                            </div>
                          ) : null}
                        </td>
                      )}
                      {visibleColumns.obra && (
                        <td className={`px-2.5 py-1.5 w-full min-w-[14rem] max-w-[28rem] ${visibleColsList[0] === 'obra' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}>
                          <span className="font-medium leading-snug text-text-primary line-clamp-2" title={obra.obra}>{obra.obra}</span>
                        </td>
                      )}
                      {visibleColumns.orgao && (
                        <td className={`px-2.5 py-1.5 w-px whitespace-nowrap ${visibleColsList[0] === 'orgao' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}>
                          <span className="text-secondary">{obra.orgao || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.sei && (
                      <td
                        className={`px-2.5 py-1.5 w-px whitespace-nowrap cursor-pointer align-middle ${visibleColsList[0] === 'sei' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}
                        onDoubleClick={() => handleSeiCellDoubleClick(obra)}
                        title="Duplo clique para definir link do SEI no site do governo"
                      >
                        {editingSeiObraId === obra.id ? (
                          <div className="flex min-w-[16rem] flex-col gap-1.5">
                            <input
                              type="url"
                              value={editingSeiUrl}
                              onChange={(e) => setEditingSeiUrl(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSeiUrlOpen()
                                if (e.key === 'Escape') {
                                  setEditingSeiObraId(null)
                                  setEditingSeiUrl('')
                                }
                              }}
                              placeholder="Cole o link md_pesq_processo_exibir.php?…"
                              className="px-2 py-1.5 text-sm border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleSeiUrlOpen}
                                disabled={!editingSeiUrl.trim() || savingSeiUrl}
                                className="px-3 py-1 text-xs bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {savingSeiUrl ? 'Salvando...' : 'Abrir e salvar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSeiObraId(null)
                                  setEditingSeiUrl('')
                                }}
                                className="px-3 py-1 text-xs border border-card rounded-lg hover:bg-background"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[13px] text-secondary font-mono tabular-nums">{obra.sei || '-'}</span>
                        )}
                      </td>
                      )}
                      {visibleColumns.valor_total && (
                      <td className={`px-2.5 py-1.5 w-px whitespace-nowrap tabular-nums ${visibleColsList[0] === 'valor_total' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}>
                        <div className="font-medium text-text-primary">
                          {formatCurrency(obra.valor_total)}
                        </div>
                      </td>
                      )}
                      {visibleColumns.sei_ultimo_andamento && (
                      <td className={`px-2.5 py-1.5 max-w-[14rem] ${visibleColsList[0] === 'sei_ultimo_andamento' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}>
                        {obra.sei_ultimo_andamento || obra.sei_ultimo_andamento_data ? (
                          <div className="text-[12px] leading-snug">
                            {obra.sei_todos_andamentos_concluidos && (
                              <div className="flex items-center gap-1 text-emerald-600 mb-1" title="Todos os protocolos foram concluídos. Exibindo o último andamento.">
                                <CheckCircle className="w-4 h-4 shrink-0" />
                                <span className="text-xs font-medium">Todos concluídos</span>
                              </div>
                            )}
                            {obra.sei_alerta_andamento_desatualizado && (
                              <div
                                className="flex items-center gap-1 text-amber-600 mb-1"
                                title={
                                  obra.sei_data_mais_recente_concluido
                                    ? (() => {
                                        try {
                                          const d = new Date(obra.sei_data_mais_recente_concluido)
                                          const fmt = Number.isNaN(d.getTime()) ? obra.sei_data_mais_recente_concluido : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                                          const hist = obra.sei_descricao_mais_recente_concluido?.trim()
                                          return hist ? `Registro mais recente: ${fmt} - ${hist}. Verifique o SEI.` : `Registro mais recente: ${fmt}. Verifique o SEI.`
                                        } catch {
                                          return obra.sei_descricao_mais_recente_concluido?.trim() ? `Registro mais recente: ${obra.sei_descricao_mais_recente_concluido}. Verifique o SEI.` : 'Registro mais recente. Verifique o SEI.'
                                        }
                                      })()
                                    : 'Registro mais recente. Verifique o SEI.'
                                }
                              >
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span className="text-xs font-medium">Andamento desatualizado</span>
                              </div>
                            )}
                            {obra.sei_ultimo_andamento_data && (
                              <div className="text-text-secondary font-mono text-xs mb-0.5">
                                {(() => {
                                  try {
                                    const d = new Date(obra.sei_ultimo_andamento_data)
                                    return Number.isNaN(d.getTime()) ? obra.sei_ultimo_andamento_data : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                                  } catch {
                                    return obra.sei_ultimo_andamento_data
                                  }
                                })()}
                              </div>
                            )}
                            <div className="text-text-primary line-clamp-2" title={obra.sei_ultimo_andamento ?? undefined}>
                              {obra.sei_ultimo_andamento || '-'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-text-secondary">—</span>
                        )}
                      </td>
                      )}
                      {visibleColumns.sei_ultimo_status && (
                      <td className={`px-2.5 py-1.5 max-w-[12rem] ${visibleColsList[0] === 'sei_ultimo_status' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}>
                        {obra.sei_ultimo_status || obra.sei_ultimo_status_data ? (
                          <div className="text-[12px] leading-snug">
                            {obra.sei_ultimo_status_data && (
                              <div className="text-text-secondary font-mono text-xs mb-0.5">
                                {(() => {
                                  try {
                                    const d = new Date(obra.sei_ultimo_status_data)
                                    return Number.isNaN(d.getTime()) ? obra.sei_ultimo_status_data : d.toLocaleDateString('pt-BR')
                                  } catch {
                                    return obra.sei_ultimo_status_data
                                  }
                                })()}
                              </div>
                            )}
                            <div className="text-text-primary line-clamp-2" title={obra.sei_ultimo_status ?? undefined}>
                              {obra.sei_ultimo_status || '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-text-secondary">—</span>
                        )}
                      </td>
                      )}
                      {visibleColumns.sei_plano_trabalho_url && (
                      <td className={`px-2.5 py-1.5 max-w-[12rem] ${visibleColsList[0] === 'sei_plano_trabalho_url' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}>
                        {obra.sei_plano_trabalho_url ? (
                          <div className="text-sm">
                            {obra.sei_plano_trabalho_tipo && (
                              <div className="text-text-secondary text-xs mb-0.5 line-clamp-1" title={obra.sei_plano_trabalho_tipo}>
                                {obra.sei_plano_trabalho_tipo}
                              </div>
                            )}
                            <a
                              href={obra.sei_plano_trabalho_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent-gold hover:underline font-mono text-xs"
                              title={obra.sei_plano_trabalho_url}
                            >
                              {obra.sei_plano_trabalho_numero || 'Abrir documento'}
                            </a>
                          </div>
                        ) : (
                          <span className="text-sm text-text-secondary">—</span>
                        )}
                      </td>
                      )}
                      {visibleColumns.doe_edicao && (
                        <td
                          className={`px-2.5 py-1.5 max-w-[10rem] ${
                            visibleColsList[0] === 'doe_edicao'
                              ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card'
                              : ''
                          }`}
                        >
                          {obra.doe_encontrados != null ? (
                            <div className="text-sm space-y-1">
                              {obra.doe_encontrados === 0 ? (
                                <span className="text-text-secondary">Sem ocorrência</span>
                              ) : (
                                <>
                                  <div className="text-xs font-semibold text-accent-gold">
                                    {obra.doe_encontrados} registro
                                    {obra.doe_encontrados === 1 ? '' : 's'}
                                  </div>
                                  {(obra.doe_registros?.length
                                    ? obra.doe_registros
                                    : [{ edicao: obra.doe_edicao || '—', pdfUrl: obra.doe_pdf_url }]
                                  ).map((reg, idx) => (
                                    <div key={`${obra.id}-ed-${idx}`} className="text-text-primary">
                                      <div className="line-clamp-2" title={reg.edicao}>
                                        {reg.edicao}
                                      </div>
                                      {reg.pdfUrl ? (
                                        <a
                                          href={reg.pdfUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-accent-gold hover:underline"
                                        >
                                          PDF edição
                                        </a>
                                      ) : null}
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-text-secondary">—</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.doe_resumo && (
                        <td
                          className={`px-2.5 py-1.5 max-w-[16rem] ${
                            visibleColsList[0] === 'doe_resumo'
                              ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card'
                              : ''
                          }`}
                        >
                          {obra.doe_registros && obra.doe_registros.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-auto pr-1">
                              {obra.doe_registros.map((reg, idx) => (
                                <div
                                  key={`${obra.id}-res-${reg.notaUuid || idx}`}
                                  className="text-sm border border-border-card/70 rounded-lg p-2 bg-background/60"
                                >
                                  <div className="text-[11px] font-semibold text-accent-gold mb-1">
                                    Resumo {idx + 1}
                                    {obra.doe_registros && obra.doe_registros.length > 1
                                      ? `/${obra.doe_registros.length}`
                                      : ''}
                                    {reg.titulo ? ` · ${reg.titulo}` : ''}
                                  </div>
                                  <div
                                    className="text-text-primary whitespace-pre-wrap line-clamp-6"
                                    title={reg.resumo}
                                  >
                                    {reg.resumo}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : obra.doe_resumo ? (
                            <div
                              className="text-sm text-text-primary line-clamp-6 whitespace-pre-wrap"
                              title={obra.doe_resumo}
                            >
                              {obra.doe_resumo}
                            </div>
                          ) : (
                            <span className="text-sm text-text-secondary">—</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.status && (
                      <td
                        className={`px-2.5 py-1.5 whitespace-nowrap cursor-pointer align-top ${visibleColsList[0] === 'status' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}
                        onDoubleClick={() => startEditCell(obra, 'status')}
                        title="Duplo clique para editar"
                      >
                        {editingCell?.obraId === obra.id && editingCell?.field === 'status' ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditCell()
                                if (e.key === 'Escape') cancelEditCell()
                              }}
                              className="px-2 py-1 text-sm border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft w-40"
                              autoFocus
                            />
                            <div className="flex gap-1">
                              <button type="button" onClick={saveEditCell} disabled={savingCell} className="px-2 py-0.5 text-xs bg-accent-gold text-white rounded">Salvar</button>
                              <button type="button" onClick={cancelEditCell} className="px-2 py-0.5 text-xs border rounded">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              obra.status?.toLowerCase().includes('concluída') || obra.status?.toLowerCase().includes('concluida')
                                ? 'bg-green-100 text-green-800'
                                : obra.status?.toLowerCase().includes('andamento')
                                ? 'bg-blue-100 text-blue-800'
                                : obra.status?.toLowerCase().includes('paralisada')
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {obra.status || '-'}
                          </span>
                        )}
                      </td>
                      )}
                      {visibleColumns.publicacao_os && (
                      <td
                        className={`px-2.5 py-1.5 whitespace-nowrap cursor-pointer align-top ${visibleColsList[0] === 'publicacao_os' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}
                        onDoubleClick={() => startEditCell(obra, 'publicacao_os')}
                        title="Duplo clique para editar"
                      >
                        {editingCell?.obraId === obra.id && editingCell?.field === 'publicacao_os' ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="date"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditCell()
                                if (e.key === 'Escape') cancelEditCell()
                              }}
                              className="px-2 py-1 text-sm border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                              autoFocus
                            />
                            <div className="flex gap-1">
                              <button type="button" onClick={saveEditCell} disabled={savingCell} className="px-2 py-0.5 text-xs bg-accent-gold text-white rounded">Salvar</button>
                              <button type="button" onClick={cancelEditCell} className="px-2 py-0.5 text-xs border rounded">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-secondary">
                            {obra.publicacao_os ? formatDateFull(obra.publicacao_os) : '-'}
                            {obra.solicitacao_medicao && (
                              <div className="text-xs text-secondary mt-0.5">Solicitada: {formatDateFull(obra.solicitacao_medicao)}</div>
                            )}
                          </div>
                        )}
                      </td>
                      )}
                      {visibleColumns.data_medicao && (
                      <td
                        className={`px-2.5 py-1.5 whitespace-nowrap cursor-pointer align-top ${visibleColsList[0] === 'data_medicao' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}
                        onDoubleClick={() => startEditCell(obra, 'data_medicao')}
                        title="Duplo clique para editar"
                      >
                        {editingCell?.obraId === obra.id && editingCell?.field === 'data_medicao' ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="date"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditCell()
                                if (e.key === 'Escape') cancelEditCell()
                              }}
                              className="px-2 py-1 text-sm border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                              autoFocus
                            />
                            <div className="flex gap-1">
                              <button type="button" onClick={saveEditCell} disabled={savingCell} className="px-2 py-0.5 text-xs bg-accent-gold text-white rounded">Salvar</button>
                              <button type="button" onClick={cancelEditCell} className="px-2 py-0.5 text-xs border rounded">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-secondary">
                            {obra.data_medicao ? formatDateFull(obra.data_medicao) : '-'}
                          </div>
                        )}
                      </td>
                      )}
                      {visibleColumns.status_medicao && (
                      <td
                        className={`px-2.5 py-1.5 whitespace-nowrap cursor-pointer align-top ${visibleColsList[0] === 'status_medicao' ? 'sticky left-0 z-10 bg-surface group-hover:bg-background/50 border-r border-card' : ''}`}
                        onDoubleClick={() => startEditCell(obra, 'status_medicao')}
                        title="Duplo clique para editar"
                      >
                        {editingCell?.obraId === obra.id && editingCell?.field === 'status_medicao' ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditCell()
                                if (e.key === 'Escape') cancelEditCell()
                              }}
                              className="px-2 py-1 text-sm border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft w-40"
                              autoFocus
                            />
                            <div className="flex gap-1">
                              <button type="button" onClick={saveEditCell} disabled={savingCell} className="px-2 py-0.5 text-xs bg-accent-gold text-white rounded">Salvar</button>
                              <button type="button" onClick={cancelEditCell} className="px-2 py-0.5 text-xs border rounded">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              obra.status_medicao?.toLowerCase().includes('concluída') || obra.status_medicao?.toLowerCase().includes('concluida')
                                ? 'bg-green-100 text-green-800'
                                : obra.status_medicao?.toLowerCase().includes('pendente')
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {obra.status_medicao || '-'}
                          </span>
                        )}
                      </td>
                      )}
                      <td className="px-2.5 py-1.5 w-px whitespace-nowrap">
                        <div className="flex items-center gap-0.5">
                          {isPago && (
                            <span className="mr-0.5" title={`Pago: ${formatCurrency(obra.valor_pago)}${obra.data_pagamento ? ' em ' + formatDateFull(obra.data_pagamento) : ''}${obra.nro_doc ? ' — Doc: ' + obra.nro_doc : ''}`}>
                              <BadgeDollarSign className="w-3.5 h-3.5 text-emerald-600" />
                            </span>
                          )}
                          {(obra.sei_url?.trim() ||
                            (isRecapTab && (obra.sei ?? '').trim())) && (
                            <button
                              type="button"
                              onClick={() => handleAtualizarAndamentoSeiUnico(obra)}
                              disabled={updatingSeiObraId === obra.id || seiStatusUpdating}
                              className="rounded-md p-1.5 hover:bg-background transition-colors disabled:opacity-50"
                              title="Atualizar andamento SEI desta obra"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 text-secondary ${updatingSeiObraId === obra.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setFormObra(obra)
                              setShowFormModal(true)
                            }}
                            className="rounded-md p-1.5 hover:bg-background transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5 text-secondary" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteObra(obra)}
                            disabled={deletingId === obra.id}
                            className="rounded-md p-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </article>
    </div>
  )

  return (
    <>
      {fullscreen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f6f5f2]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ebe8e4] bg-white px-4 py-3 lg:px-6">
            <h2 className="text-base font-semibold tracking-tight text-text-primary">Obras — Tela cheia</h2>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className={cn(ghostButtonClass, 'h-9')}
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Sair da tela cheia
            </button>
          </div>
          <div className="px-4 py-6 lg:px-6">{obrasMainContent}</div>
        </div>
      ) : (
        <ObrasShell
          tabs={hubTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          {obrasMainContent}
        </ObrasShell>
      )}

      {showImportModal && (
        <ObrasImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={(tipoAba) => {
            void fetchRecap()
            if (tipoAba?.trim()) setActiveTab(RECAP_UI_TAB)
            setShowImportModal(false)
          }}
        />
      )}

      {showFormModal && (
        <ObraFormModal
          obra={formObra}
          defaultTipo={
            formObra
              ? undefined
              : activeTab === RECAP_UI_TAB
                ? recapTabs.includes('Recap 2026')
                  ? 'Recap 2026'
                  : recapTabs[0] || 'obras diversas'
                : activeTab
          }
          extraTipos={[
            ...recapTabs,
            ...tabs.filter(
              (t) =>
                t !== RECAP_UI_TAB &&
                !(OBRAS_TIPOS as readonly string[]).includes(t as (typeof OBRAS_TIPOS)[number]),
            ),
          ]}
          onClose={() => {
            setShowFormModal(false)
            setFormObra(null)
          }}
          onSuccess={() => {
            fetchObras()
            setShowFormModal(false)
            setFormObra(null)
          }}
        />
      )}
    </>
  )
}
