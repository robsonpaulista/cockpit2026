'use client'

import { useCallback, useEffect, useState } from 'react'
import { ConteudoPresencaNav } from '@/components/conteudo-presenca-nav'
import { formatDate } from '@/lib/utils'
import { Calendar, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

interface City {
  id: string
  name: string
  state: string
}

interface ObraOpt {
  id: string
  obra: string
  municipio?: string | null
}

interface AgendaRow {
  id: string
  date: string
  city_id?: string | null
  type: string
  status: string
  description?: string | null
  obra_id?: string | null
  hora_evento?: string | null
  territorio?: string | null
  cities?: { name: string; state: string }
  obras?: { obra: string }
}

export default function ConteudoAgendaPage() {
  const [rows, setRows] = useState<AgendaRow[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [obras, setObras] = useState<ObraOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<AgendaRow | null>(null)
  const [form, setForm] = useState({
    date: '',
    city_id: '',
    type: 'visita',
    status: 'planejada',
    description: '',
    obra_id: '',
    hora_evento: '',
    territorio: '',
  })

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [a, c, o] = await Promise.all([
        fetch('/api/conteudo/agendas'),
        fetch('/api/campo/cities'),
        fetch('/api/obras'),
      ])
      const aj = await a.json()
      const cj = await c.json()
      const oj = await o.json()
      if (a.ok) setRows(aj ?? [])
      if (c.ok) setCities((cj as City[]).sort((x, y) => x.name.localeCompare(y.name)))
      if (o.ok) setObras(oj.obras ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const resetForm = () => {
    setForm({
      date: '',
      city_id: '',
      type: 'visita',
      status: 'planejada',
      description: '',
      obra_id: '',
      hora_evento: '',
      territorio: '',
    })
    setEditing(null)
  }

  const openEdit = (row: AgendaRow) => {
    setEditing(row)
    setForm({
      date: row.date?.slice(0, 10) ?? '',
      city_id: row.city_id ?? '',
      type: row.type,
      status: row.status,
      description: row.description ?? '',
      obra_id: row.obra_id ?? '',
      hora_evento: row.hora_evento?.slice(0, 5) ?? '',
      territorio: row.territorio ?? '',
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        date: form.date,
        city_id: form.city_id || undefined,
        type: form.type as 'visita' | 'evento' | 'reuniao' | 'outro',
        status: form.status as 'planejada' | 'concluida' | 'cancelada',
        description: form.description || undefined,
        obra_id: form.obra_id || undefined,
        hora_evento: form.hora_evento || undefined,
        territorio: form.territorio || undefined,
      }
      const url = editing ? `/api/conteudo/agendas/${editing.id}` : '/api/conteudo/agendas'
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao salvar')
      if (!editing && j.conteudos_criados > 0) {
        alert(`Agenda criada. Pacote de ${j.conteudos_criados} conteúdos em rascunho gerado (obra vinculada).`)
      }
      resetForm()
      await loadAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir esta agenda?')) return
    const r = await fetch(`/api/conteudo/agendas/${id}`, { method: 'DELETE' })
    if (r.ok) loadAll()
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-1">
        <Calendar className="h-6 w-6 text-accent-gold" />
        Agenda de campo (cards)
      </h1>
      <p className="text-sm text-text-secondary mb-4">
        Usa a tabela <code className="text-xs bg-bg-page px-1 rounded">agendas</code>. Com obra vinculada, cria
        automaticamente 6 rascunhos em conteúdos planejados.
      </p>
      <ConteudoPresencaNav />

      <form
        onSubmit={submit}
        className="rounded-xl border border-border-card bg-bg-surface p-4 shadow-card space-y-3 mb-8"
      >
        <h2 className="font-semibold text-text-primary">{editing ? 'Editar agenda' : 'Nova agenda'}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-text-secondary">
            Data *
            <input
              type="date"
              required
              className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          <label className="text-xs text-text-secondary">
            Horário
            <input
              type="time"
              className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
              value={form.hora_evento}
              onChange={(e) => setForm((f) => ({ ...f, hora_evento: e.target.value }))}
            />
          </label>
          <label className="text-xs text-text-secondary sm:col-span-2">
            Cidade
            <select
              className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm bg-bg-surface"
              value={form.city_id}
              onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
            >
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.state})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-text-secondary">
            Tipo de evento
            <select
              className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="visita">Visita</option>
              <option value="evento">Evento</option>
              <option value="reuniao">Reunião</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="text-xs text-text-secondary">
            Status
            <select
              className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="planejada">Planejada</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
          <label className="text-xs text-text-secondary sm:col-span-2">
            Obra relacionada (opcional — gera pacote de 6 conteúdos)
            <select
              className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm bg-bg-surface"
              value={form.obra_id}
              onChange={(e) => setForm((f) => ({ ...f, obra_id: e.target.value }))}
            >
              <option value="">—</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {(o.municipio ? `${o.municipio} — ` : '') + o.obra}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-text-secondary sm:col-span-2">
            Território (texto livre)
            <input
              className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
              value={form.territorio}
              onChange={(e) => setForm((f) => ({ ...f, territorio: e.target.value }))}
            />
          </label>
          <label className="text-xs text-text-secondary sm:col-span-2">
            Observações
            <textarea
              className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm min-h-[72px]"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-gold text-white px-4 py-2 text-sm font-medium"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editing ? 'Salvar alterações' : 'Cadastrar'}
          </button>
          {editing && (
            <button type="button" className="px-4 py-2 text-sm rounded-lg border border-border-card" onClick={resetForm}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      <h2 className="font-semibold mb-2">Agendas cadastradas</h2>
      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-border-card bg-bg-surface p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div>
                <p className="font-medium text-text-primary">
                  {r.cities ? `${r.cities.name} (${r.cities.state})` : 'Sem cidade'}
                  <span className="text-text-secondary font-normal"> · {formatDate(r.date)}</span>
                </p>
                <p className="text-xs text-text-secondary">
                  {r.type} · {r.status}
                  {r.obras?.obra ? ` · Obra: ${r.obras.obra}` : ''}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  className="p-2 rounded-lg border border-border-card hover:bg-bg-page"
                  onClick={() => openEdit(r)}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg text-status-danger hover:bg-status-danger/10"
                  onClick={() => remove(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
