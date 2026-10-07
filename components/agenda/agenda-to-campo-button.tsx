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
  createCampoVisitaFromEvento,
  fetchCampoCidades,
  type CampoGoogleLink,
} from '@/lib/services/agenda-google-client'
import { TERRITORIO_CAMPO_TAB_VISITAS, territorioCampoHref } from '@/lib/territorio-campo-route'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'
import {
  TseErro,
  tseBotaoCinzaClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseRotuloCampoClass,
} from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'

export type { CampoGoogleLink }

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
}

const FORM_VAZIO: FormState = { date: '', city_id: '', type: 'visita', description: '', hora_evento: '' }

const botaoBase =
  'inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] font-bold transition-colors'

export function AgendaToCampoButton({ event, linked, onLinked }: AgendaToCampoButtonProps) {
  const [open, setOpen] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)
  const [cities, setCities] = useState<CampoCityOption[]>([])
  const [loadingCities, setLoadingCities] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [cidadeSugerida, setCidadeSugerida] = useState<string | undefined>()

  const prefill = useMemo(() => {
    if (cities.length === 0) return null
    return buildCampoPrefillFromCalendarEvent(event, cities)
  }, [cities, event])

  const loadCities = useCallback(async () => {
    setLoadingCities(true)
    try {
      setCities(await fetchCampoCidades())
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
    })
    setCidadeSugerida(prefill.cidadeSugerida)
  }, [prefill])

  const openModal = () => {
    setError(null)
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const id = await createCampoVisitaFromEvento({
        date: form.date,
        type: form.type,
        description: form.description,
        googleEventId: event.id,
        cityId: form.city_id || undefined,
        horaEvento: form.hora_evento || undefined,
      })
      onLinked(event.id, { id, date: form.date, status: 'planejada', type: form.type })
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
        className={cn(botaoBase, 'border border-[var(--tse-green)] bg-white text-[var(--tse-olive)] hover:bg-[var(--tse-bar)]')}
        title="Abrir Território · Visitas"
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Em Campo
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={cn(botaoBase, 'bg-[#E8E8E8] text-[var(--tse-text)] hover:bg-[#DDDDDD]')}
        title="Criar visita em Território · Visitas a partir deste compromisso"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--tse-yellow)]" aria-hidden />
        Campo
      </button>

      {open && mounted
        ? createPortal(
            <div style={TSE_TOKENS} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white text-[var(--tse-text)] shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="agenda-campo-title"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#EEEEEE] px-5 py-4">
                  <div className="min-w-0">
                    <h3 id="agenda-campo-title" className="text-[15px] font-bold">
                      Registrar em Campo
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--tse-muted)]">
                      {event.summary || 'Compromisso do Google Calendar'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md p-1 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)]"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {loadingCities && cities.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-[13px] text-[var(--tse-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--tse-yellow)]" />
                    Carregando cidades…
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <label>
                        <span className={tseRotuloCampoClass}>Data</span>
                        <input
                          type="date"
                          required
                          value={form.date}
                          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                          className={tseCampoClass}
                        />
                      </label>
                      <label>
                        <span className={tseRotuloCampoClass}>Horário</span>
                        <input
                          type="time"
                          value={form.hora_evento}
                          onChange={(e) => setForm((f) => ({ ...f, hora_evento: e.target.value }))}
                          className={tseCampoClass}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className={tseRotuloCampoClass}>Município</span>
                      <select
                        value={form.city_id}
                        onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
                        className={tseCampoClass}
                      >
                        <option value="">Selecione o município</option>
                        {cities.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.state}
                          </option>
                        ))}
                      </select>
                      {!form.city_id && cidadeSugerida ? (
                        <span className="mt-1 block text-[12px] font-semibold text-[var(--tse-gold-text)]">
                          Sugestão detectada: {cidadeSugerida} — confirme no seletor acima
                        </span>
                      ) : null}
                    </label>

                    <label className="block">
                      <span className={tseRotuloCampoClass}>Tipo</span>
                      <select
                        value={form.type}
                        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CampoAgendaType }))}
                        className={tseCampoClass}
                      >
                        {(Object.keys(CAMPO_TYPE_LABELS) as CampoAgendaType[]).map((t) => (
                          <option key={t} value={t}>
                            {CAMPO_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block text-[11px] text-[var(--tse-muted)]">
                        VIAGEM e OBRAS → visita · EVENTO → evento · REUNIÃO → reunião
                      </span>
                    </label>

                    <label className="block">
                      <span className={tseRotuloCampoClass}>Descrição</span>
                      <textarea
                        rows={4}
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        className={cn(tseCampoClass, 'h-auto resize-y py-2')}
                      />
                    </label>

                    {error ? <TseErro>{error}</TseErro> : null}

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#EEEEEE] pt-3">
                      <button type="button" onClick={() => setOpen(false)} className={tseBotaoCinzaClass}>
                        Cancelar
                      </button>
                      <button type="submit" disabled={saving} className={tseBotaoPrimarioClass}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                        {saving ? 'Salvando…' : 'Criar visita'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
