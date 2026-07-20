'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Save, X } from 'lucide-react'
import { ghostButtonClass, primaryButtonClass } from '@/lib/premium-ui-classes'
import { cn } from '@/lib/utils'

type CityOption = {
  id: string
  name: string
  state: string
}

type FormState = {
  date: string
  city_id: string
  type: 'visita' | 'evento' | 'reuniao' | 'outro'
  description: string
  hora_evento: string
}

const emptyForm = (): FormState => ({
  date: new Date().toISOString().slice(0, 10),
  city_id: '',
  type: 'visita',
  description: '',
  hora_evento: '',
})

type Props = {
  onCreated: () => void
}

/**
 * Inclusão de visita/evento no Planejado do Fluxo Digital.
 * Mesmo padrão de /dashboard/territorio?tab=visitas (cidade obrigatória das 224).
 */
export function FluxoDigitalNovaVisita({ onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [cities, setCities] = useState<CityOption[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const loadCities = useCallback(async () => {
    setCitiesLoading(true)
    try {
      const res = await fetch('/api/campo/cities', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar cidades')
      const data = (await res.json()) as CityOption[]
      setCities([...data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar cidades')
    } finally {
      setCitiesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && cities.length === 0) void loadCities()
  }, [open, cities.length, loadCities])

  const reset = () => {
    setForm(emptyForm())
    setError(null)
    setOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.city_id) {
      setError('Selecione uma cidade')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        date: form.date,
        city_id: form.city_id,
        type: form.type,
        description: form.description || undefined,
        incluir_fluxo_digital: true,
      }
      if (form.hora_evento) payload.hora_evento = `${form.hora_evento}:00`

      const res = await fetch('/api/campo/agendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao salvar na agenda')
      }
      reset()
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fd-nova-visita">
      {!open ? (
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => setOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Nova visita na programação
        </button>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="fd-nova-visita__form">
          <div className="fd-nova-visita__head">
            <h3>Incluir na programação</h3>
            <button type="button" className={ghostButtonClass} onClick={reset} aria-label="Fechar">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <div className="fd-nova-visita__grid">
            <label className="fd-field">
              <span>Data</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </label>

            <label className="fd-field">
              <span>Cidade</span>
              <select
                required
                value={form.city_id}
                disabled={citiesLoading}
                onChange={(e) => setForm((p) => ({ ...p, city_id: e.target.value }))}
              >
                <option value="">
                  {citiesLoading ? 'Carregando…' : 'Selecione uma cidade'}
                </option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="fd-field">
              <span>Horário</span>
              <input
                type="time"
                value={form.hora_evento}
                onChange={(e) => setForm((p) => ({ ...p, hora_evento: e.target.value }))}
              />
            </label>

            <label className="fd-field">
              <span>Tipo</span>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    type: e.target.value as FormState['type'],
                  }))
                }
              >
                <option value="visita">Visita</option>
                <option value="evento">Evento</option>
                <option value="reuniao">Reunião</option>
                <option value="outro">Outro</option>
              </select>
            </label>

            <label className="fd-field fd-field--wide">
              <span>Descrição</span>
              <textarea
                rows={2}
                value={form.description}
                placeholder="Objetivo, pauta ou observações da visita"
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </label>
          </div>

          {error ? <p className="fd-nova-visita__erro">{error}</p> : null}

          <div className="fd-nova-visita__actions">
            <button type="button" className={ghostButtonClass} onClick={reset} disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
              className={cn(primaryButtonClass)}
              disabled={saving || citiesLoading}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Save className="h-3.5 w-3.5" aria-hidden />
              )}
              Salvar na programação
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
