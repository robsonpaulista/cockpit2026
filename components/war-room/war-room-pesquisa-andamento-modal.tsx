'use client'

import { CheckCircle2, Loader2, Radio, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  fetchCidadesPesquisa,
  finalizarPesquisaAndamento,
  savePesquisaAndamento,
} from '@/lib/war-room/pesquisas-andamento-client'
import {
  isPesquisaAndamentoEmCampo,
  isPesquisaAndamentoFinalizadaRecente,
  type WarRoomPesquisaAndamento,
} from '@/lib/war-room/pesquisas-andamento'
import { cn } from '@/lib/utils'

type CityOption = {
  id: string
  name: string
}

type Props = {
  initial?: WarRoomPesquisaAndamento | null
  onClose: () => void
  onSaved: (item: WarRoomPesquisaAndamento) => void
}

function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function normalizeCity(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Modal para incluir ou editar pesquisa em andamento (data, instituto, cidade). */
export function WarRoomPesquisaAndamentoModal({ initial, onClose, onSaved }: Props) {
  const tituloId = useId()
  const listId = useId()
  const [mounted, setMounted] = useState(false)
  const [cities, setCities] = useState<CityOption[]>([])
  const [data, setData] = useState(initial?.data || todayIso())
  const [instituto, setInstituto] = useState(initial?.instituto ?? '')
  const [cidade, setCidade] = useState(initial?.cidade ?? '')
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editing = Boolean(initial?.id)
  const emCampo = initial ? isPesquisaAndamentoEmCampo(initial) : true
  const finalizadaRecente = initial
    ? isPesquisaAndamentoFinalizadaRecente(initial)
    : false

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const mapped = await fetchCidadesPesquisa()
        if (!cancelled) setCities(mapped)
      } catch {
        /* cidade continua digitável */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const cidadeMatch = useMemo(() => {
    const key = normalizeCity(cidade)
    if (!key) return null
    return cities.find((c) => normalizeCity(c.name) === key) ?? null
  }, [cidade, cities])

  const handleSubmit = async () => {
    const cidadeNome = cidadeMatch?.name || cidade.trim()
    if (!data || !instituto.trim() || !cidadeNome) {
      setError('Preencha data, instituto e cidade.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await savePesquisaAndamento({
      id: initial?.id ?? null,
      data,
      instituto: instituto.trim(),
      cidade: cidadeNome,
      cidadeId: cidadeMatch?.id ?? initial?.cidadeId ?? null,
      status: initial?.status ?? 'em_campo',
    })
    setSaving(false)
    if (result.error || !result.item) {
      setError(result.error ?? 'Não foi possível salvar.')
      return
    }
    onSaved(result.item)
  }

  const handleFinalizar = async () => {
    if (!initial?.id) return
    const cidadeNome = cidadeMatch?.name || cidade.trim()
    if (!data || !instituto.trim() || !cidadeNome) {
      setError('Preencha data, instituto e cidade.')
      return
    }
    setFinalizing(true)
    setError(null)
    const result = await finalizarPesquisaAndamento({
      id: initial.id,
      data,
      instituto: instituto.trim(),
      cidade: cidadeNome,
      cidadeId: cidadeMatch?.id ?? initial.cidadeId ?? null,
    })
    setFinalizing(false)
    if (result.error || !result.item) {
      setError(result.error ?? 'Não foi possível finalizar.')
      return
    }
    onSaved(result.item)
  }

  if (!mounted) return null

  const busy = saving || finalizing

  return createPortal(
    <div className="wr-visita-modal" role="presentation">
      <button
        type="button"
        className="wr-visita-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="wr-visita-modal__panel wr-pesquisa-andamento-modal__panel"
      >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <span className="wr-visita-modal__icon" aria-hidden>
              <Radio className="h-4 w-4" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <p className="wr-visita-modal__eyebrow">War Room · Pesquisas</p>
              <h2 id={tituloId} className="wr-visita-modal__title truncate">
                {editing ? 'Editar pesquisa em andamento' : 'Incluir pesquisa em andamento'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="wr-visita-modal__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </header>

        <p className="wr-visita-modal__lead">
          {finalizadaRecente
            ? 'Pesquisa finalizada — permanece neste card por até 24 horas após a conclusão.'
            : 'Mesmo formato das finalizadas: data, instituto e cidade. O sinal intermitente indica que o campo ainda está aberto.'}
        </p>

        <form
          className="wr-pesquisa-andamento-modal__form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <label className="wr-pesquisa-andamento-modal__field">
            <span>Data</span>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
            />
          </label>
          <label className="wr-pesquisa-andamento-modal__field">
            <span>Instituto</span>
            <input
              type="text"
              value={instituto}
              onChange={(e) => setInstituto(e.target.value)}
              placeholder="Ex.: Opinar"
              autoComplete="off"
              required
            />
          </label>
          <label className="wr-pesquisa-andamento-modal__field">
            <span>Cidade</span>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex.: Teresina"
              list={listId}
              autoComplete="off"
              required
            />
            <datalist id={listId}>
              {cities.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </label>

          {error ? (
            <p className="wr-pesquisa-andamento-modal__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="wr-pesquisa-andamento-modal__actions">
            {editing && emCampo ? (
              <button
                type="button"
                className="wr-pesquisa-andamento-modal__finalize"
                disabled={busy}
                onClick={() => void handleFinalizar()}
              >
                {finalizing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                Marcar como finalizada
              </button>
            ) : null}
            <button
              type="button"
              className="wr-pesquisa-andamento-modal__cancel"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={cn(
                'wr-pesquisa-andamento-modal__save',
                saving && 'is-busy',
              )}
              disabled={busy}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
              ) : null}
              {editing ? 'Salvar' : 'Incluir'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
