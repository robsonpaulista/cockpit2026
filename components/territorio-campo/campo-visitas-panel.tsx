'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Plus, Save, X } from 'lucide-react'
import type { AIAgentPageContext } from '@/components/ai-agent'
import { useRegisterJarvisHostProps } from '@/contexts/jarvis-host-props-context'
import { useTerritorioMunicipio } from '@/components/territorio-campo/territorio-municipio-context'
import { cn, formatDate, monthBucketKey, parseDateOnlyLocal } from '@/lib/utils'
import {
  TseBarraRotulo,
  TseBusca,
  TseCard,
  TseCarregando,
  TseCarregarMais,
  TseDado,
  TseDados,
  TseErro,
  TseListaFiltro,
  TseStatus,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseCardClass,
  tseControleClass,
  tseLinkAcaoClass,
  tseRotuloCampoClass,
} from '@/components/tse/tse-ui'

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

type StatusAgenda = 'planejada' | 'concluida' | 'cancelada'

interface AgendaFormData {
  date: string
  city_id: string
  type: 'visita' | 'evento' | 'reuniao' | 'outro'
  status: StatusAgenda
  description: string
}

const emptyForm: AgendaFormData = {
  date: '',
  city_id: '',
  type: 'visita',
  status: 'planejada',
  description: '',
}

const PAGE_SIZE = 30
const TOTAL_MUNICIPIOS_PI = 224

const STATUS: Array<{ id: StatusAgenda; label: string; cor: string }> = [
  { id: 'planejada', label: 'Planejadas', cor: 'var(--tse-yellow)' },
  { id: 'concluida', label: 'Concluídas', cor: 'var(--tse-green)' },
  { id: 'cancelada', label: 'Canceladas', cor: 'var(--tse-zero)' },
]

const ROTULO_STATUS: Record<string, string> = {
  planejada: 'Planejada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const ROTULO_TIPO: Record<string, string> = {
  visita: 'Visita',
  evento: 'Evento',
  reuniao: 'Reunião',
  outro: 'Outro',
}

const corStatus = (status: string): string => STATUS.find((s) => s.id === status)?.cor ?? 'var(--tse-zero)'
const tempo = (agenda: Agenda): number => parseDateOnlyLocal(agenda.date)?.getTime() ?? 0
const fmt = (n: number): string => n.toLocaleString('pt-BR')
const fmtPct = (n: number): string => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

export function CampoVisitasPanel() {
  const { municipio, noMunicipio } = useTerritorioMunicipio()
  const [agendas, setAgendas] = useState<Agenda[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null)
  const [formAberto, setFormAberto] = useState<boolean>(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState<AgendaFormData>(emptyForm)
  const [query, setQuery] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<StatusAgenda | null>(null)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null)
  const [limite, setLimite] = useState<number>(PAGE_SIZE)

  const contextoAgenteCampo = useMemo<AIAgentPageContext>(
    () => ({
      kind: 'campo',
      cidades: cities.map((city) => city.name),
      totalAgendas: agendas.length,
    }),
    [agendas.length, cities],
  )

  useRegisterJarvisHostProps({
    pageContext: contextoAgenteCampo,
    loadingKPIs: loading,
    kpisCount: agendas.length,
  })

  const fetchCities = useCallback(async () => {
    try {
      const response = await fetch('/api/campo/cities')
      if (!response.ok) return
      const data = (await response.json()) as City[]
      setCities([...data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    } catch (error) {
      console.error('Erro ao buscar cidades:', error)
    }
  }, [])

  const fetchAgendas = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    void Promise.all([fetchAgendas(), fetchCities()])
  }, [fetchAgendas, fetchCities])

  useEffect(() => {
    setLimite(PAGE_SIZE)
  }, [municipio, filterStatus, selectedMonthKey])

  const resetForm = () => {
    setEditingAgendaId(null)
    setFormError(null)
    setFormData(emptyForm)
    setFormAberto(false)
  }

  const abrirNovaAgenda = () => {
    const cidadeDoFiltro = municipio ? cities.find((c) => noMunicipio(c.name)) : undefined
    setEditingAgendaId(null)
    setFormError(null)
    setFormData({ ...emptyForm, city_id: cidadeDoFiltro?.id ?? '' })
    setFormAberto(true)
  }

  const startEditAgenda = (agenda: Agenda) => {
    setEditingAgendaId(agenda.id)
    setFormError(null)
    setFormData({
      date: agenda.date,
      city_id: agenda.city_id ?? '',
      type: (agenda.type as AgendaFormData['type']) ?? 'visita',
      status: (agenda.status as StatusAgenda) ?? 'planejada',
      description: agenda.description ?? '',
    })
    setFormAberto(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      const isEditing = Boolean(editingAgendaId)
      const url = isEditing ? `/api/campo/agendas/${editingAgendaId}` : '/api/campo/agendas'
      const payload = isEditing
        ? { ...formData, city_id: formData.city_id || undefined }
        : {
            date: formData.date,
            city_id: formData.city_id || undefined,
            type: formData.type,
            description: formData.description,
          }
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
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

  const handleDelete = async (agenda: Agenda) => {
    if (!window.confirm(`Excluir a agenda de ${agenda.cities?.name ?? 'cidade não informada'}?`)) return
    setDeletingId(agenda.id)
    try {
      const response = await fetch(`/api/campo/agendas/${agenda.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? 'Erro ao excluir agenda')
      }
      if (editingAgendaId === agenda.id) resetForm()
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

  const agendasEscopo = agendas.filter((agenda) => noMunicipio(agenda.cities?.name))
  const concluidas = agendasEscopo.filter((agenda) => agenda.status === 'concluida')
  const ultimaConcluida = concluidas.reduce<Agenda | null>(
    (maisRecente, agenda) => (!maisRecente || tempo(agenda) > tempo(maisRecente) ? agenda : maisRecente),
    null,
  )
  const contagemStatus = STATUS.map((s) => ({
    ...s,
    valor: agendasEscopo.filter((agenda) => agenda.status === s.id).length,
  }))
  const taxaConclusao = agendasEscopo.length ? (concluidas.length / agendasEscopo.length) * 100 : 0

  const presencaPorCidade = new Map<string, number>()
  for (const agenda of concluidas) {
    const nome = agenda.cities?.name
    if (nome) presencaPorCidade.set(nome, (presencaPorCidade.get(nome) ?? 0) + 1)
  }
  const cidadesVisitadas = presencaPorCidade.size
  const universo = municipio ? 1 : TOTAL_MUNICIPIOS_PI
  const topCidades = [...presencaPorCidade.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxTopCidade = topCidades[0]?.[1] ?? 0

  const meses = Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date()
    // Normaliza no dia 1 para evitar salto de mês em datas como 30/31.
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - idx))
    return {
      id: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
      valor: 0,
      cor: 'var(--tse-green)',
    }
  })
  for (const agenda of concluidas) {
    const mes = meses.find((m) => m.id === monthBucketKey(agenda.date))
    if (mes) mes.valor += 1
  }
  const mesSelecionado = meses.find((m) => m.id === selectedMonthKey) ?? null

  const termo = query.trim().toLowerCase()
  const agendasFiltradas = agendasEscopo
    .filter((agenda) => {
      const matchStatus = !filterStatus || agenda.status === filterStatus
      const matchQuery =
        !termo ||
        (agenda.cities?.name ?? '').toLowerCase().includes(termo) ||
        (agenda.description ?? '').toLowerCase().includes(termo)
      const matchMonth = !selectedMonthKey || monthBucketKey(agenda.date) === selectedMonthKey
      return matchStatus && matchQuery && matchMonth
    })
    .sort((a, b) => tempo(b) - tempo(a))

  const escopoLabel = municipio ?? 'Piauí'

  if (loading && agendas.length === 0) return <TseCarregando texto="Carregando Campo & Agenda…" />

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[270px_1fr]">
      <aside className="space-y-4">
        <section className={tseCardClass}>
          <h2 className="text-xl font-bold">Dados Gerais</h2>
          <p className="mt-2 text-[10px] font-semibold text-[var(--tse-muted)]">Campo &amp; Agenda · {escopoLabel}</p>
          <TseDados>
            <TseDado rotulo="Agendas" valor={fmt(agendasEscopo.length)} />
            <TseDado rotulo="Cidades visitadas" valor={fmt(cidadesVisitadas)} sufixo={`/ ${fmt(universo)}`} />
            <TseDado rotulo="Última visita" valor={ultimaConcluida ? formatDate(ultimaConcluida.date) : '—'} />
          </TseDados>
          <TseBarraRotulo pct={taxaConclusao} rotulo={fmtPct(taxaConclusao)} />
          <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Agendas concluídas</p>
        </section>

        <TseListaFiltro titulo="Status" itens={contagemStatus} ativo={filterStatus} onChange={setFilterStatus} />

        <TseListaFiltro
          titulo="Visitas concluídas por mês"
          itens={meses}
          ativo={selectedMonthKey}
          onChange={setSelectedMonthKey}
        />

        {!municipio && topCidades.length > 0 ? (
          <section className={tseCardClass}>
            <h2 className="text-[15px] font-bold">Cidades mais visitadas</h2>
            <ul className="mt-3 space-y-2.5 text-[13px]">
              {topCidades.map(([nome, total]) => (
                <li key={nome}>
                  <div className="flex justify-between gap-2">
                    <span className="truncate uppercase">{nome}</span>
                    <strong className="tabular-nums">{fmt(total)}</strong>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#EEEEEE]">
                    <div
                      className="h-full bg-[var(--tse-green)]"
                      style={{ width: `${maxTopCidade ? (total / maxTopCidade) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>

      <main className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterStatus ?? ''}
              onChange={(e) => setFilterStatus((e.target.value || null) as StatusAgenda | null)}
              className={tseControleClass}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              {STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {ROTULO_STATUS[s.id]}
                </option>
              ))}
            </select>
            {mesSelecionado ? (
              <button
                type="button"
                onClick={() => setSelectedMonthKey(null)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)] px-2.5 text-[13px] font-semibold"
              >
                Mês: {mesSelecionado.label}
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TseBusca value={query} onChange={setQuery} placeholder="Buscar cidade ou descrição" />
            <button type="button" onClick={abrirNovaAgenda} className={tseBotaoPrimarioClass}>
              <Plus className="h-4 w-4" />
              Nova agenda
            </button>
          </div>
        </div>

        {formAberto ? (
          <TseCard
            className="mt-4"
            titulo={editingAgendaId ? 'Editar agenda' : 'Nova agenda'}
            acao={
              <button type="button" onClick={resetForm} className={tseLinkAcaoClass}>
                Cancelar
              </button>
            }
          >
            <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
              <label className="xl:col-span-3">
                <span className={tseRotuloCampoClass}>Data</span>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className={tseCampoClass}
                />
              </label>
              <label className="xl:col-span-3">
                <span className={tseRotuloCampoClass}>Cidade</span>
                <select
                  value={formData.city_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, city_id: e.target.value }))}
                  className={tseCampoClass}
                  required
                >
                  <option value="">Selecione uma cidade</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="xl:col-span-2">
                <span className={tseRotuloCampoClass}>Tipo</span>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as AgendaFormData['type'] }))}
                  className={tseCampoClass}
                >
                  {Object.entries(ROTULO_TIPO).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="xl:col-span-2">
                <span className={tseRotuloCampoClass}>Status</span>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as StatusAgenda }))}
                  className={tseCampoClass}
                >
                  {STATUS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {ROTULO_STATUS[s.id]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end xl:col-span-2">
                <button type="submit" disabled={saving} className={cn(tseBotaoPrimarioClass, 'h-9 w-full')}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingAgendaId ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
              <label className="md:col-span-2 xl:col-span-12">
                <span className={tseRotuloCampoClass}>Descrição</span>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Detalhes da agenda, objetivos e observações."
                  className={cn(tseCampoClass, 'h-auto py-2')}
                />
              </label>
            </form>
          </TseCard>
        ) : null}

        {formError ? (
          <div className="mt-3">
            <TseErro>{formError}</TseErro>
          </div>
        ) : null}

        <section className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-white px-5 py-4 shadow-sm">
          <div className="min-w-[180px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-bold uppercase">Agenda de campo</p>
              <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold text-white">
                {escopoLabel}
              </span>
            </div>
            <p className="text-[15px] text-[var(--tse-muted)]">
              {fmt(agendasEscopo.length)} agendas · {fmt(cidadesVisitadas)}{' '}
              {cidadesVisitadas === 1 ? 'cidade visitada' : 'cidades visitadas'}
            </p>
          </div>
          {contagemStatus
            .filter((s) => s.id !== 'cancelada')
            .map((s) => (
              <div key={s.id} className="text-right">
                <p className="text-3xl font-black">{fmt(s.valor)}</p>
                <p className="text-[13px] lowercase text-[var(--tse-muted)]">{s.label}</p>
              </div>
            ))}
        </section>

        <p className="mt-4 text-[12px] text-[var(--tse-muted)]">
          {fmt(agendasFiltradas.length)} {agendasFiltradas.length === 1 ? 'agenda' : 'agendas'}
          {filterStatus || selectedMonthKey || termo ? ' com os filtros aplicados' : ''} · mais recentes primeiro
        </p>

        {agendasFiltradas.length === 0 ? (
          <div className="mt-3">
            <TseVazio>
              {municipio && agendasEscopo.length === 0
                ? `Nenhuma agenda registrada em ${municipio}.`
                : 'Nenhuma agenda encontrada para os filtros selecionados.'}
            </TseVazio>
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 min-[1600px]:grid-cols-3">
              {agendasFiltradas.slice(0, limite).map((agenda) => (
                <article key={agenda.id} className="flex flex-col rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-[15px] font-bold uppercase leading-tight">
                      {agenda.cities?.name ?? 'Cidade não informada'}
                    </p>
                    <span className="shrink-0 text-[13px] tabular-nums">{formatDate(agenda.date)}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--tse-muted)]">{ROTULO_TIPO[agenda.type] ?? agenda.type}</p>
                  {agenda.description ? (
                    <p className="mt-2 line-clamp-3 break-words text-[13px] leading-relaxed">{agenda.description}</p>
                  ) : null}
                  {agenda.status === 'concluida' && agenda.visits?.[0] ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--tse-olive)]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Check-in registrado
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    <TseStatus cor={corStatus(agenda.status)}>{ROTULO_STATUS[agenda.status] ?? agenda.status}</TseStatus>
                    <div className="flex items-center gap-3">
                      {agenda.status === 'planejada' ? (
                        <button type="button" onClick={() => void handleCheckin(agenda.id)} className={tseLinkAcaoClass}>
                          Check-in
                        </button>
                      ) : null}
                      <button type="button" onClick={() => startEditAgenda(agenda)} className={tseLinkAcaoClass}>
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(agenda)}
                        disabled={deletingId === agenda.id}
                        className="text-[12px] font-bold uppercase tracking-wide text-[var(--tse-muted)] hover:text-red-600 disabled:opacity-60"
                      >
                        {deletingId === agenda.id ? 'Excluindo…' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <TseCarregarMais restantes={agendasFiltradas.length - limite} onClick={() => setLimite((n) => n + PAGE_SIZE)} />
          </>
        )}
      </main>
    </div>
  )
}
