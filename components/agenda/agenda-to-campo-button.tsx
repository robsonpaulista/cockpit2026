'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Calendar, CheckCircle2, Loader2, MapPin, X } from 'lucide-react'
import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import {
  buildCampoPrefillFromCalendarEvent,
  CAMPO_TYPE_LABELS,
  type CampoAgendaType,
  type CampoCityOption,
} from '@/lib/agenda/calendar-to-campo'
import {
  TERRITORIO_CAMPO_TAB_VISITAS,
  territorioCampoHref,
} from '@/lib/territorio-campo-route'

export interface CampoGoogleLink {
  id: string
  date: string
  status: string
  type: string
}

interface AgendaToCampoButtonProps {
  event: CalendarEventRow
  linked?: CampoGoogleLink
  onLinked: (eventId: string, link: CampoGoogleLink) => void
}

interface FormState {
  date: string
  city_id: string
  type: CampoAgendaType
  description: string
  hora_evento: string
  incluir_fluxo_digital: boolean
}

export function AgendaToCampoButton({ event, linked, onLinked }: AgendaToCampoButtonProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [cities, setCities] = useState<CampoCityOption[]>([])
  const [loadingCities, setLoadingCities] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    date: '',
    city_id: '',
    type: 'visita',
    description: '',
    hora_evento: '',
    incluir_fluxo_digital: false,
  })
  const [cidadeSugerida, setCidadeSugerida] = useState<string | undefined>()

  const prefill = useMemo(() => {
    if (cities.length === 0) return null
    return buildCampoPrefillFromCalendarEvent(event, cities)
  }, [cities, event])

  const loadCities = useCallback(async () => {
    setLoadingCities(true)
    try {
      const res = await fetch('/api/campo/cities')
      if (!res.ok) return
      const data = (await res.json()) as CampoCityOption[]
      setCities(data)
    } catch {
      setCities([])
    } finally {
      setLoadingCities(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || cities.length > 0) return
    void loadCities()
  }, [cities.length, loadCities, open])

  useEffect(() => {
    if (!prefill) return
    setForm({
      date: prefill.date,
      city_id: prefill.city_id,
      type: prefill.type,
      description: prefill.description,
      hora_evento: prefill.hora_evento?.slice(0, 5) ?? '',
      incluir_fluxo_digital: false,
    })
    setCidadeSugerida(prefill.cidadeSugerida)
  }, [prefill])

  const openModal = () => {
    setError(null)
    setOpen(true)
    if (cities.length === 0) void loadCities()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const payload: Record<string, string | boolean> = {
        date: form.date,
        type: form.type,
        description: form.description,
        google_event_id: event.id,
        incluir_fluxo_digital: form.incluir_fluxo_digital,
      }
      if (form.city_id) payload.city_id = form.city_id
      if (form.hora_evento) payload.hora_evento = `${form.hora_evento}:00`

      const res = await fetch('/api/campo/agendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await res.json()) as { id?: string; error?: string; existingId?: string }

      if (res.status === 409 && data.existingId) {
        onLinked(event.id, {
          id: data.existingId,
          date: form.date,
          status: 'planejada',
          type: form.type,
        })
        setOpen(false)
        return
      }

      if (!res.ok) {
        throw new Error(data.error ?? 'Erro ao registrar visita')
      }

      onLinked(event.id, {
        id: data.id!,
        date: form.date,
        status: 'planejada',
        type: form.type,
      })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar visita')
    } finally {
      setSaving(false)
    }
  }

  if (linked) {
    return (
      <Link
        href={territorioCampoHref(TERRITORIO_CAMPO_TAB_VISITAS)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-status-success/40 bg-status-success/10 px-3 py-1.5 text-sm font-medium text-status-success transition-colors hover:bg-status-success/15"
        title="Abrir Campo & Agenda"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        Em Campo
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 rounded-lg border border-card bg-surface px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-background"
        title="Criar visita em Campo & Agenda a partir deste compromisso"
      >
        <MapPin className="h-4 w-4 shrink-0 text-accent-gold" aria-hidden />
        Registrar em Campo
      </button>

      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-card bg-surface shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="agenda-campo-title"
              >
                <div className="flex items-start justify-between gap-3 border-b border-card p-4">
                  <div>
                    <h3 id="agenda-campo-title" className="text-base font-semibold text-text-primary">
                      Registrar em Campo & Agenda
                    </h3>
                    <p className="mt-1 text-xs text-secondary line-clamp-2">
                      {event.summary || 'Compromisso do Google Calendar'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1 text-secondary hover:bg-background hover:text-text-primary"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {loadingCities && cities.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-sm text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando cidades…
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-secondary">Data</label>
                        <input
                          type="date"
                          required
                          value={form.date}
                          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                          className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-secondary">Horário</label>
                        <input
                          type="time"
                          value={form.hora_evento}
                          onChange={(e) => setForm((f) => ({ ...f, hora_evento: e.target.value }))}
                          className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-secondary">Município</label>
                      <select
                        value={form.city_id}
                        onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
                        className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                      >
                        <option value="">Selecione o município</option>
                        {cities.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.state}
                          </option>
                        ))}
                      </select>
                      {!form.city_id && cidadeSugerida ? (
                        <p className="mt-1 text-xs text-status-warning">
                          Sugestão detectada: {cidadeSugerida} — confirme no seletor acima
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-secondary">Tipo</label>
                      <select
                        value={form.type}
                        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CampoAgendaType }))}
                        className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                      >
                        {(Object.keys(CAMPO_TYPE_LABELS) as CampoAgendaType[]).map((t) => (
                          <option key={t} value={t}>
                            {CAMPO_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-secondary">
                        VIAGEM e OBRAS → visita · EVENTO → evento · REUNIÃO → reunião
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-secondary">Descrição</label>
                      <textarea
                        rows={4}
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        className="w-full resize-y rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                      />
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        checked={form.incluir_fluxo_digital}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, incluir_fluxo_digital: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-card"
                      />
                      Incluir no Fluxo Digital (programação)
                    </label>

                    {error ? (
                      <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
                        {error}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-card pt-3">
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="rounded-lg px-4 py-2 text-sm text-secondary hover:bg-background"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-accent-gold px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-gold/90 disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Salvando…
                          </>
                        ) : (
                          <>
                            <Calendar className="h-4 w-4" />
                            Criar visita
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
