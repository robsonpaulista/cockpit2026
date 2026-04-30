'use client'

import { useEffect, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Loader2,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { useTheme } from '@/contexts/theme-context'

interface Agenda {
  id: string
  date: string
  city_id?: string
  type: string
  status: string
  description?: string
  cities?: {
    id: string
    name: string
    state: string
  }
  visits?: Array<{
    id: string
    checkin_time?: string
    photos: string[]
    videos: string[]
  }>
}

interface City {
  id: string
  name: string
  state: string
}

interface AgendaFormData {
  date: string
  city_id: string
  type: 'visita' | 'evento' | 'reuniao' | 'outro'
  status: 'planejada' | 'concluida' | 'cancelada'
  description: string
}

const emptyForm: AgendaFormData = {
  date: '',
  city_id: '',
  type: 'visita',
  status: 'planejada',
  description: '',
}

export default function CampoPage() {
  const { theme, appearance } = useTheme()
  const isDarkAppearance = appearance === 'dark'
  const isCockpitDark = theme === 'cockpit' && isDarkAppearance
  const sectionShellClass = isDarkAppearance
    ? 'border-white/12 bg-[linear-gradient(165deg,rgba(22,34,44,0.82)_0%,rgba(18,30,38,0.86)_100%)] shadow-[0_10px_32px_rgba(3,12,20,0.28)]'
    : 'border-border-card bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.86)_100%)] shadow-[0_12px_28px_rgba(15,23,42,0.08)]'
  const innerPanelClass = isDarkAppearance
    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)]'
    : 'border-border-card/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(248,244,238,0.72)_100%)]'
  const innerItemClass = isDarkAppearance
    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)]'
    : 'border-border-card/60 bg-bg-surface/85'
  const metricTrackClass = isDarkAppearance ? 'bg-white/10' : 'bg-border-card/60'
  const premiumPrimaryBarClass = isDarkAppearance
    ? 'bg-[linear-gradient(135deg,rgba(45,212,191,0.95)_0%,rgba(14,165,183,0.95)_100%)]'
    : 'bg-[linear-gradient(135deg,rgb(var(--accent-gold))_0%,rgb(var(--accent-gold-dark))_100%)]'
  const monthlyBarClass = isDarkAppearance
    ? 'bg-[linear-gradient(180deg,rgba(45,212,191,0.9)_0%,rgba(14,165,183,0.9)_100%)]'
    : 'bg-[linear-gradient(180deg,rgb(var(--accent-gold))_0%,rgb(var(--accent-gold-dark))_100%)]'
  const [agendas, setAgendas] = useState<Agenda[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState<AgendaFormData>(emptyForm)
  const [query, setQuery] = useState('')
  const [filterCity, setFilterCity] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'planejada' | 'concluida' | 'cancelada'>('all')
  const [showAllAgendas, setShowAllAgendas] = useState(false)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([fetchAgendas(), fetchCities()])
  }, [])

  const fetchCities = async () => {
    try {
      const response = await fetch('/api/campo/cities')
      if (!response.ok) return
      const data = (await response.json()) as City[]
      setCities([...data].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error) {
      console.error('Erro ao buscar cidades:', error)
    }
  }

  const fetchAgendas = async () => {
    try {
      const response = await fetch('/api/campo/agendas')
      if (!response.ok) return
      const data = (await response.json()) as Agenda[]
      setAgendas(data)
    } catch (error) {
      console.error('Erro ao buscar agendas:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditingAgendaId(null)
    setFormError(null)
    setFormData(emptyForm)
  }

  const startEditAgenda = (agenda: Agenda) => {
    setEditingAgendaId(agenda.id)
    setFormError(null)
    setFormData({
      date: agenda.date,
      city_id: agenda.city_id ?? '',
      type: (agenda.type as AgendaFormData['type']) ?? 'visita',
      status: (agenda.status as AgendaFormData['status']) ?? 'planejada',
      description: agenda.description ?? '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      const isEditing = Boolean(editingAgendaId)
      const url = isEditing ? `/api/campo/agendas/${editingAgendaId}` : '/api/campo/agendas'
      const method = isEditing ? 'PUT' : 'POST'
      const payload = isEditing
        ? { ...formData, city_id: formData.city_id || undefined }
        : { date: formData.date, city_id: formData.city_id || undefined, type: formData.type, description: formData.description }
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? 'Erro ao salvar agenda')
      }
      await fetchAgendas()
      resetForm()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao salvar agenda')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (agendaId: string) => {
    setDeletingId(agendaId)
    try {
      const response = await fetch(`/api/campo/agendas/${agendaId}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? 'Erro ao excluir agenda')
      }
      if (editingAgendaId === agendaId) resetForm()
      await fetchAgendas()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erro ao excluir agenda')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCheckin = async (agendaId: string) => {
    try {
      const response = await fetch(`/api/campo/visits/${agendaId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (response.ok) await fetchAgendas()
    } catch (error) {
      console.error('Erro ao fazer check-in:', error)
    }
  }

  const agendasOrdenadasDesc = [...agendas].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const agendasConcluidas = agendas.filter((agenda) => agenda.status === 'concluida')
  const ultimasRealizadas = [...agendasConcluidas].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4)
  const cityPresenceMap = agendasConcluidas.reduce<Record<string, { name: string; count: number }>>((acc, agenda) => {
    if (!agenda.cities?.name) return acc
    const key = agenda.cities.id ?? agenda.cities.name
    const previous = acc[key]
    acc[key] = { name: agenda.cities.name, count: (previous?.count ?? 0) + 1 }
    return acc
  }, {})
  const cityPresence = Object.values(cityPresenceMap).sort((a, b) => b.count - a.count)
  const cityMaisPresenca = cityPresence[0] ?? null
  const cityMenosPresenca = cityPresence[cityPresence.length - 1] ?? null
  const pipelineDistribuicao: Array<{
    label: string
    value: number
    tone: 'planejada' | 'concluida' | 'cancelada'
  }> = [
    { label: 'Planejadas', value: agendas.filter((a) => a.status === 'planejada').length, tone: 'planejada' },
    { label: 'Concluídas', value: agendas.filter((a) => a.status === 'concluida').length, tone: 'concluida' },
    { label: 'Canceladas', value: agendas.filter((a) => a.status === 'cancelada').length, tone: 'cancelada' },
  ]
  const pipelineBarClass = (tone: 'planejada' | 'concluida' | 'cancelada') => {
    if (tone === 'concluida') {
      return isDarkAppearance
        ? 'bg-[linear-gradient(135deg,rgba(52,211,153,0.95)_0%,rgba(16,185,129,0.95)_100%)]'
        : 'bg-[linear-gradient(135deg,rgb(var(--success))_0%,rgba(21,128,61,1)_100%)]'
    }
    if (tone === 'cancelada') {
      return isDarkAppearance
        ? 'bg-[linear-gradient(135deg,rgba(251,191,36,0.95)_0%,rgba(245,158,11,0.95)_100%)]'
        : 'bg-[linear-gradient(135deg,rgb(var(--warning))_0%,rgba(180,122,16,1)_100%)]'
    }
    return premiumPrimaryBarClass
  }
  const totalPipeline = pipelineDistribuicao.reduce((sum, item) => sum + item.value, 0)
  const cityBars = cityPresence.slice(0, 5)
  const cityBarsMax = cityBars[0]?.count ?? 1
  const agendasFiltradas = agendasOrdenadasDesc.filter((agenda) => {
    const matchCity = filterCity === 'all' || agenda.city_id === filterCity
    const matchStatus = filterStatus === 'all' || agenda.status === filterStatus
    const cityName = agenda.cities?.name?.toLowerCase() ?? ''
    const description = agenda.description?.toLowerCase() ?? ''
    const matchQuery = query.trim() === '' || cityName.includes(query.toLowerCase()) || description.includes(query.toLowerCase())
    const agendaDate = new Date(agenda.date)
    const monthKey = `${agendaDate.getFullYear()}-${agendaDate.getMonth()}`
    const matchMonth = selectedMonthKey === null || monthKey === selectedMonthKey
    return matchCity && matchStatus && matchQuery && matchMonth
  })
  const agendasListadas = showAllAgendas ? agendasFiltradas : agendasFiltradas.slice(0, 8)
  const statusBadgeClass = (status: Agenda['status']) => {
    if (status === 'concluida') return 'bg-status-success/10 text-status-success'
    if (status === 'cancelada') return 'bg-status-danger/10 text-status-danger'
    return 'bg-accent-gold-soft text-accent-gold'
  }
  const completionRate = agendas.length > 0 ? Math.round((agendasConcluidas.length / agendas.length) * 100) : 0
  const quickCityOptions = cities
  const monthBuckets = Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date()
    // Normaliza no dia 1 para evitar salto de mês em datas como 30/31.
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - idx))
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const label = d.toLocaleDateString('pt-BR', { month: 'short' })
    return { key, label, value: 0 }
  })
  agendasConcluidas.forEach((agenda) => {
    const d = new Date(agenda.date)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const bucket = monthBuckets.find((m) => m.key === key)
    if (bucket) bucket.value += 1
  })
  const monthMax = Math.max(...monthBuckets.map((m) => m.value), 1)
  const selectedMonthLabel = selectedMonthKey ? monthBuckets.find((month) => month.key === selectedMonthKey)?.label ?? null : null

  return (
    <div className={cn('min-h-screen', isCockpitDark ? 'sidebar-cockpit-shell' : 'bg-bg-surface')}>
      <div className="px-4 py-6 lg:px-6">
        <section className="mb-6 animate-reveal">
          <div className={cn('rounded-2xl border p-5 backdrop-blur', sectionShellClass)}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
                <MapPinned className="h-4 w-4 text-accent-gold" />
                Resumo de campo
              </h2>
              <span className="text-xs font-medium text-text-secondary">{agendas.length} agendas no total</span>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={cn('rounded-xl border p-3', innerPanelClass)}>
                <div className="mb-6 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Presença & últimas agendas</p>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Top 5 + 3 recentes</span>
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div className="space-y-2">
                    {cityBars.length === 0 ? (
                      <p className="text-sm text-text-secondary">Sem dados de presença ainda.</p>
                    ) : (
                      cityBars.map((city) => (
                        <div key={city.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm text-text-primary">
                            <span className="truncate pr-2 font-medium">{city.name}</span>
                            <span className="font-medium">{city.count}</span>
                          </div>
                          <div className={cn('h-1.5 overflow-hidden rounded-full', metricTrackClass)}>
                            <div className={cn('h-full rounded-full transition-all duration-700 ease-out', premiumPrimaryBarClass)} style={{ width: `${(city.count / cityBarsMax) * 100}%` }} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="space-y-2">
                    {ultimasRealizadas.length === 0 ? (
                      <p className="text-sm text-text-secondary">Nenhuma agenda concluída ainda.</p>
                    ) : (
                      ultimasRealizadas.slice(0, 3).map((agenda) => (
                        <div key={agenda.id} className={cn('grid h-7 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border px-2', innerItemClass)}>
                          <p className="truncate text-sm font-medium text-text-primary">{agenda.cities?.name ?? 'Cidade não informada'}</p>
                          <span className="text-xs text-text-secondary">{formatDate(agenda.date)}</span>
                          <span className="rounded-md bg-status-success/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-success">
                            {agenda.type}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className={cn('rounded-xl border p-3', innerPanelClass)}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Ritmo mensal</p>
                <div className="grid h-44 grid-cols-6 items-end gap-2">
                  {monthBuckets.map((month) => (
                    <button
                      key={month.key}
                      type="button"
                      onClick={() => setSelectedMonthKey((prev) => (prev === month.key ? null : month.key))}
                      className={cn(
                        'flex h-full flex-col items-center justify-end gap-2 rounded-lg px-1 pb-1 transition-colors',
                        selectedMonthKey === month.key ? (isDarkAppearance ? 'bg-white/10' : 'bg-bg-app/70') : 'hover:bg-bg-app/40',
                      )}
                    >
                      <span className="text-[10px] font-semibold text-text-secondary">{month.value}</span>
                      <div className="flex h-28 w-full items-end">
                        <div
                          className={cn('w-full rounded-t-md transition-all duration-700 ease-out', monthlyBarClass)}
                          style={{ height: `${Math.max((month.value / monthMax) * 100, month.value > 0 ? 14 : 5)}%` }}
                        />
                      </div>
                      <span className="text-[10px] uppercase text-text-muted">{month.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 animate-reveal animate-reveal-2">
          <div className={cn('rounded-2xl border p-5 backdrop-blur', sectionShellClass)}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-text-primary">{editingAgendaId ? 'Editar agenda na própria página' : 'Nova agenda estratégica'}</h2>
              {editingAgendaId ? (
                <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-lg border border-border-card px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-app">
                  <X className="h-4 w-4" />
                  Cancelar edição
                </button>
              ) : null}
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 xl:grid-cols-12">
              <div className="xl:col-span-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">Data</label>
                <input type="date" required value={formData.date} onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))} className="w-full rounded-xl border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40" />
              </div>
              <div className="xl:col-span-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">Cidade</label>
                <select value={formData.city_id} onChange={(e) => setFormData((prev) => ({ ...prev, city_id: e.target.value }))} className="w-full rounded-xl border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40" required>
                  <option value="">Selecione uma cidade</option>
                  {quickCityOptions.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="xl:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">Tipo</label>
                <select value={formData.type} onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as AgendaFormData['type'] }))} className="w-full rounded-xl border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40">
                  <option value="visita">Visita</option>
                  <option value="evento">Evento</option>
                  <option value="reuniao">Reunião</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="xl:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">Status</label>
                <select value={formData.status} onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as AgendaFormData['status'] }))} className="w-full rounded-xl border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40">
                  <option value="planejada">Planejada</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div className="xl:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">Ação</label>
                <button type="submit" disabled={saving} className={cn(sidebarPrimaryCTAButtonClass(isCockpitDark), 'w-full justify-center')}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingAgendaId ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
              <div className="xl:col-span-12">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">Descrição</label>
                <textarea rows={2} value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="Detalhes da agenda, objetivos e observações." className="w-full rounded-xl border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40" />
              </div>
            </form>
            {formError ? (
              <div className="mt-4 rounded-lg border border-status-danger/30 bg-status-danger/10 p-3 text-sm text-status-danger">{formError}</div>
            ) : null}
          </div>
        </section>

        <section className="animate-reveal animate-reveal-3">
          <div className={cn('rounded-2xl border p-6 backdrop-blur', sectionShellClass)}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-text-primary">Agenda inteligente</h2>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Filter className="h-3.5 w-3.5" />
                <span>{agendasFiltradas.length} agendas encontradas</span>
              </div>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
              <div className="relative lg:col-span-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por cidade ou descrição" className="w-full rounded-xl border border-border-card bg-bg-surface py-2.5 pl-9 pr-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40" />
              </div>
              <div className="lg:col-span-3">
                <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-full rounded-xl border border-border-card bg-bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40">
                  <option value="all">Todas as cidades</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-3">
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} className="w-full rounded-xl border border-border-card bg-bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40">
                  <option value="all">Todos os status</option>
                  <option value="planejada">Planejada</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div className="lg:col-span-2">
                <button type="button" onClick={() => setShowAllAgendas((prev) => !prev)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border-card bg-bg-surface px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-bg-app">
                  {showAllAgendas ? 'Mostrar menos' : 'Ver todas'}
                  <ChevronRight className={cn('h-4 w-4 transition-transform', showAllAgendas && 'rotate-90')} />
                </button>
              </div>
            </div>
            {selectedMonthLabel ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-card bg-bg-app/50 px-3 py-2 text-xs text-text-secondary">
                <span>
                  Filtrando agendas de <strong className="uppercase text-text-primary">{selectedMonthLabel}</strong>.
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMonthKey(null)}
                  className="rounded-md border border-border-card px-2 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-bg-surface"
                >
                  Limpar período
                </button>
              </div>
            ) : null}
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              {pipelineDistribuicao.map((item) => {
                const pct = totalPipeline > 0 ? (item.value / totalPipeline) * 100 : 0
                return (
                  <div key={item.label} className={cn('rounded-xl border p-3', innerPanelClass)}>
                    <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
                      <span>{item.label}</span>
                      <span>{item.value}</span>
                    </div>
                    <div className={cn('h-2 overflow-hidden rounded-full', metricTrackClass)}>
                      <div className={cn('h-full rounded-full transition-all duration-700', pipelineBarClass(item.tone))} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            {loading ? (
              <div className="grid grid-cols-1 gap-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-xl bg-bg-app" />
                ))}
              </div>
            ) : agendasListadas.length === 0 ? (
              <div className="rounded-xl border border-border-card bg-bg-app/60 p-6 text-center text-sm text-text-secondary">
                Nenhuma agenda encontrada para os filtros selecionados.
              </div>
            ) : (
              <div className="space-y-3">
                {agendasListadas.map((agenda) => (
                  <article key={agenda.id} className={cn('group rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card', innerPanelClass)}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={cn('rounded-lg px-2 py-1 text-xs font-semibold', statusBadgeClass(agenda.status))}>{agenda.status}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(agenda.date)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                            <Clock3 className="h-3.5 w-3.5" />
                            {agenda.type}
                          </span>
                        </div>
                        <h3 className="truncate text-sm font-semibold text-text-primary">{agenda.cities?.name ?? 'Cidade não informada'}</h3>
                        {agenda.description ? <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{agenda.description}</p> : null}
                        {agenda.status === 'concluida' && agenda.visits?.[0] ? (
                          <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-status-success/10 px-2 py-1 text-xs text-status-success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Check-in registrado
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => startEditAgenda(agenda)} className="inline-flex items-center gap-1 rounded-lg border border-border-card px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-app hover:text-text-primary">
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        {agenda.status === 'planejada' ? (
                          <button type="button" onClick={() => handleCheckin(agenda.id)} className="inline-flex items-center gap-1 rounded-lg bg-status-success/90 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-status-success">
                            <Plus className="h-3.5 w-3.5" />
                            Check-in
                          </button>
                        ) : null}
                        <button type="button" onClick={() => handleDelete(agenda.id)} disabled={deletingId === agenda.id} className="inline-flex items-center gap-1 rounded-lg border border-status-danger/40 px-2.5 py-1.5 text-xs font-medium text-status-danger transition-colors hover:bg-status-danger/10 disabled:opacity-60">
                          {deletingId === agenda.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Excluir
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
