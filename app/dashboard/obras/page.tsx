'use client'

import { useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/header'
import { Building2, MapPin, Calendar, DollarSign, User, Filter, Search, Plus, Edit, Trash2, Loader2, Upload, RefreshCw, Maximize2, Minimize2, FileSearch, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ObrasImportModal } from '@/components/obras-import-modal'
import { ObraFormModal, OBRAS_TIPOS } from '@/components/obra-form-modal'

type ObraTipoAba = 'pavimentação' | 'obras diversas'

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
  status?: string
  publicacao_os?: string
  solicitacao_medicao?: string
  data_medicao?: string
  status_medicao?: string
  valor_total?: number
  created_at?: string
  updated_at?: string
}

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMunicipio, setFilterMunicipio] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterStatusMedicao, setFilterStatusMedicao] = useState('')
  const [filterOrgao, setFilterOrgao] = useState('')
  const [activeTab, setActiveTab] = useState<ObraTipoAba>('pavimentação')
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
  type SortColumn = 'municipio' | 'obra' | 'orgao' | 'sei' | 'valor_total' | 'sei_ultimo_andamento' | 'status' | 'publicacao_os' | 'data_medicao' | 'status_medicao'
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  useEffect(() => {
    fetchObras()
  }, [filterMunicipio, filterStatus, filterStatusMedicao, filterOrgao])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen])

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

  const handleAtualizarAndamentosSei = async () => {
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
      const params = new URLSearchParams()
      if (filterMunicipio) params.append('municipio', filterMunicipio)
      if (filterStatus) params.append('status', filterStatus)
      if (filterStatusMedicao) params.append('status_medicao', filterStatusMedicao)
      if (filterOrgao) params.append('orgao', filterOrgao)

      const response = await fetch(`/api/obras?${params.toString()}`)
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

  // Filtrar obras por aba (tipo) e depois por termo de busca
  const filteredObras = useMemo(() => {
    const porTipo = obras.filter((obra) => {
      const t = (obra.tipo ?? '').trim() || 'obras diversas'
      return t === activeTab
    })
    if (!searchTerm) return porTipo
    const term = searchTerm.toLowerCase()
    return porTipo.filter((obra) => {
      return (
        obra.obra?.toLowerCase().includes(term) ||
        obra.municipio?.toLowerCase().includes(term) ||
        obra.orgao?.toLowerCase().includes(term) ||
        obra.sei?.toLowerCase().includes(term) ||
        obra.sei_medicao?.toLowerCase().includes(term)
      )
    })
  }, [obras, searchTerm, activeTab])

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

  // Obter valores únicos para filtros
  const municipios = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.municipio).filter(Boolean))).sort()
  }, [obras])

  const statusList = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.status).filter(Boolean))).sort()
  }, [obras])

  const statusMedicaoList = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.status_medicao).filter(Boolean))).sort()
  }, [obras])

  const orgaos = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.orgao).filter(Boolean))).sort()
  }, [obras])

  const formatCurrency = (value?: number) => {
    if (!value) return '-'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatPercent = (value?: number) => {
    if (!value) return '-'
    return `${value.toFixed(1)}%`
  }

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

  const obrasMainContent = (
    <>
      {/* Filtros e Busca */}
      <div className="mb-6 bg-surface rounded-xl border border-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Busca */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type="text"
                  placeholder="Buscar por nome, localização, cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                />
              </div>
            </div>

            {/* Filtro Município */}
            <div>
              <select
                value={filterMunicipio}
                onChange={(e) => setFilterMunicipio(e.target.value)}
                className="w-full px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Todos os municípios</option>
                {municipios.map((municipio) => (
                  <option key={municipio} value={municipio}>
                    {municipio}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Status */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Todos os status</option>
                {statusList.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Status Medição */}
            <div>
              <select
                value={filterStatusMedicao}
                onChange={(e) => setFilterStatusMedicao(e.target.value)}
                className="w-full px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Todos os status de medição</option>
                {statusMedicaoList.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filtro Órgão */}
          <div className="mt-4">
            <select
              value={filterOrgao}
              onChange={(e) => setFilterOrgao(e.target.value)}
              className="w-full px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            >
              <option value="">Todos os órgãos</option>
              {orgaos.map((orgao) => (
                <option key={orgao} value={orgao}>
                  {orgao}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-bg-surface rounded-xl border border-border-card shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-accent-gold" />
              <span className="text-sm font-medium text-text-secondary">Total de Obras</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{obras.length}</p>
          </div>
          <div className="bg-bg-surface rounded-xl border border-border-card shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-accent-gold" />
              <span className="text-sm font-medium text-text-secondary">Valor Total Orçado</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">
              {formatCurrency(obras.reduce((sum, o) => sum + (o.valor_total || 0), 0))}
            </p>
          </div>
          <div className="bg-bg-surface rounded-xl border border-border-card shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-accent-gold" />
              <span className="text-sm font-medium text-text-secondary">Com Medição</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">
              {obras.filter((o) => o.data_medicao).length}
            </p>
          </div>
          <div className="bg-bg-surface rounded-xl border border-border-card shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5 text-accent-gold" />
              <span className="text-sm font-medium text-text-secondary">Órgãos Diferentes</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">
              {orgaos.length}
            </p>
          </div>
        </div>

        {/* Tabela de Obras */}
        <div className="bg-bg-surface rounded-2xl border border-border-card shadow-card overflow-hidden">
          <div className="p-6 border-b border-border-card flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent-gold" />
              Lista de Obras ({filteredObras.length})
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setFormObra(null)
                  setShowFormModal(true)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova obra
              </button>
              <button
                onClick={() => fetchObras()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 border border-border-card rounded-lg hover:bg-bg-app transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Atualizar lista"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-border-card rounded-lg hover:bg-bg-app transition-colors"
              >
                <Upload className="w-4 h-4" />
                Importar do Excel
              </button>
              <button
                onClick={handleAtualizarAndamentosSei}
                disabled={seiStatusUpdating || obras.filter((o) => o.sei_url?.trim()).length === 0}
                className="flex items-center gap-2 px-4 py-2 border border-border-card rounded-lg hover:bg-bg-app transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Buscar último andamento (andamento/Aberto) em cada link SEI"
              >
                <FileSearch className={`w-4 h-4 ${seiStatusUpdating ? 'animate-pulse' : ''}`} />
                {seiStatusUpdating ? `Andamentos SEI (${seiStatusProgress.current}/${seiStatusProgress.total})` : 'Atualizar andamentos SEI'}
              </button>
              <button
                onClick={() => setFullscreen((f) => !f)}
                className="flex items-center gap-2 px-4 py-2 border border-border-card rounded-lg hover:bg-bg-app transition-colors"
                title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              >
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              </button>
            </div>
          </div>

          {/* Abas por tipo */}
          <div className="flex border-b border-border-card">
            {(OBRAS_TIPOS as readonly string[]).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setActiveTab(tipo as ObraTipoAba)}
                className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tipo
                    ? 'border-accent-gold text-accent-gold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                <span className="ml-2 text-xs text-text-secondary">
                  ({obras.filter((o) => ((o.tipo ?? '').trim() || 'obras diversas') === tipo).length})
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-accent-gold animate-spin" />
              <span className="ml-2 text-sm text-secondary">Carregando obras...</span>
            </div>
          ) : filteredObras.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-secondary mx-auto mb-4 opacity-50" />
              <p className="text-sm text-secondary">
                {searchTerm || filterMunicipio || filterStatus || filterStatusMedicao || filterOrgao
                  ? 'Nenhuma obra encontrada com os filtros aplicados'
                  : `Nenhuma obra do tipo "${activeTab === 'pavimentação' ? 'Pavimentação' : 'Obras diversas'}" cadastrada.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-card">
                  <tr>
                    {(['municipio', 'obra', 'orgao', 'sei', 'valor_total', 'sei_ultimo_andamento', 'status', 'publicacao_os', 'data_medicao', 'status_medicao'] as const).map((col) => {
                      const labels: Record<SortColumn, string> = {
                        municipio: 'Município', obra: 'Obra', orgao: 'Órgão', sei: 'SEI',
                        valor_total: 'Valor Total', sei_ultimo_andamento: 'Últ. andamento SEI',
                        status: 'Status', publicacao_os: 'Pub. OS', data_medicao: 'Data Medição', status_medicao: 'Status Medição',
                      }
                      const isActive = sortColumn === col
                      const thClass = col === 'municipio' ? 'sticky left-0 z-10 px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider bg-background border-r border-card min-w-[120px]' :
                        col === 'obra' ? 'px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider min-w-[320px]' :
                        col === 'sei_ultimo_andamento' ? 'px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider min-w-[200px]' :
                        'px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider'
                      return (
                        <th key={col} className={thClass}>
                          <button
                            type="button"
                            onClick={() => toggleSort(col)}
                            className="flex items-center gap-1 hover:text-primary transition-colors w-full text-left"
                            title={`Ordenar ${labels[col]} (${sortColumn === col && !sortAsc ? 'A→Z' : 'Z→A'})`}
                          >
                            {labels[col]}
                            {isActive ? (sortAsc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
                          </button>
                        </th>
                      )
                    })}
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider w-28">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card bg-surface">
                  {sortedObras.map((obra) => (
                    <tr key={obra.id} className="group hover:bg-background/50 transition-colors">
                      <td className="sticky left-0 z-10 px-6 py-4 whitespace-nowrap bg-surface group-hover:bg-background/50 border-r border-card min-w-[120px]">
                        <div className="text-sm font-semibold text-primary">{obra.municipio || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap min-w-[320px]">
                        <span className="text-sm font-semibold text-primary">{obra.obra}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-secondary">{obra.orgao || '-'}</span>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer align-top"
                        onDoubleClick={() => handleSeiCellDoubleClick(obra)}
                        title="Duplo clique para definir link do SEI no site do governo"
                      >
                        {editingSeiObraId === obra.id ? (
                          <div className="flex flex-col gap-2 min-w-[280px]">
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
                              placeholder="Cole o link do SEI (site do governo)"
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
                          <span className="text-sm text-secondary font-mono">{obra.sei || '-'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-primary">
                          {formatCurrency(obra.valor_total)}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[280px]">
                        {obra.sei_ultimo_andamento || obra.sei_ultimo_andamento_data ? (
                          <div className="text-sm">
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
                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer align-top"
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
                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer align-top"
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
                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer align-top"
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
                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer align-top"
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setFormObra(obra)
                              setShowFormModal(true)
                            }}
                            className="p-2 rounded-lg hover:bg-background transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4 text-secondary" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteObra(obra)}
                            disabled={deletingId === obra.id}
                            className="p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
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
    </>
  )

  return (
    <div className="min-h-screen bg-background">
      {fullscreen ? (
        <div className="fixed inset-0 z-50 bg-bg-app overflow-y-auto">
          <div className="sticky top-0 z-10 bg-bg-surface border-b border-border-card px-4 lg:px-6 py-3 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-text-primary">Obras — Tela cheia</h2>
            <button
              onClick={() => setFullscreen(false)}
              className="flex items-center gap-2 px-4 py-2 border border-border-card rounded-lg hover:bg-bg-app transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
              Sair da tela cheia
            </button>
          </div>
          <div className="px-4 py-6 lg:px-6">{obrasMainContent}</div>
        </div>
      ) : (
        <>
          <Header title="Obras" subtitle="Gestão de obras e projetos" showFilters={false} />
          <div className="px-4 py-6 lg:px-6">{obrasMainContent}</div>
        </>
      )}

      {/* Modal de Importação */}
      {showImportModal && (
        <ObrasImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            fetchObras()
            setShowImportModal(false)
          }}
        />
      )}

      {/* Modal de formulário (criar / editar obra) */}
      {showFormModal && (
        <ObraFormModal
          obra={formObra}
          defaultTipo={formObra ? undefined : activeTab}
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
    </div>
  )
}
