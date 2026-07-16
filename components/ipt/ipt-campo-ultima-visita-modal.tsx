'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'

type Props = {
  municipio: string
  onClose: () => void
}

type UltimaVisita = {
  id: string
  date: string
  type: string
  status: string
  description: string | null
  horaEvento: string | null
  checkinTime: string | null
  municipio: string
}

const TIPO_LABEL: Record<string, string> = {
  visita: 'Visita',
  evento: 'Evento',
  reuniao: 'Reunião',
  outro: 'Outro',
}

function formatDataBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const dia = iso.includes('T') ? (iso.split('T')[0] ?? iso) : iso
  const [y, m, d] = dia.split('-')
  if (!y || !m || !d) return dia
  return `${d}/${m}/${y}`
}

function formatDataHoraBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  if (!iso.includes('T')) return formatDataBr(iso)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return formatDataBr(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function IptCampoUltimaVisitaModal({ municipio, onClose }: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [visita, setVisita] = useState<UltimaVisita | null>(null)

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
    setLoading(true)
    setError('')
    void fetch(`/api/campo/ultima-visita?municipio=${encodeURIComponent(municipio)}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          visita?: UltimaVisita | null
          error?: string
        }
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
        if (!cancelled) setVisita(json.visita ?? null)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Não foi possível carregar a visita.')
          setVisita(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [municipio])

  if (!mounted) return null

  return createPortal(
    <div className="ipt-foco-modal" role="presentation">
      <button
        type="button"
        className="ipt-foco-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="ipt-campo-modal__panel"
      >
        <div className="ipt-foco-modal__head">
          <div>
            <p className="ipt-foco-modal__eyebrow">Campo · presença</p>
            <h2 id={tituloId} className="ipt-foco-modal__title">
              Última visita em {municipio}
            </h2>
          </div>
          <button
            type="button"
            className="ipt-foco-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <CockpitIcon icon={X} size="sm" />
          </button>
        </div>

        <p className="ipt-foco-modal__lead">
          Registro mais recente de agenda concluída com presença no município.
        </p>

        {loading ? (
          <div className="ipt-campo-modal__empty">
            <Loader2 className="h-5 w-5 animate-spin text-[#ff9800]" aria-hidden />
            Carregando última visita…
          </div>
        ) : error ? (
          <p className="ipt-campo-modal__empty">{error}</p>
        ) : !visita ? (
          <p className="ipt-campo-modal__empty">
            Nenhuma visita concluída encontrada para este município.
          </p>
        ) : (
          <dl className="ipt-campo-modal__meta">
            <div>
              <dt>Data da agenda</dt>
              <dd>{formatDataBr(visita.date)}</dd>
            </div>
            <div>
              <dt>Check-in</dt>
              <dd>
                {visita.checkinTime
                  ? formatDataHoraBr(visita.checkinTime)
                  : 'Sem horário de check-in'}
              </dd>
            </div>
            {visita.horaEvento ? (
              <div>
                <dt>Hora prevista</dt>
                <dd>{visita.horaEvento}</dd>
              </div>
            ) : null}
            <div>
              <dt>Tipo</dt>
              <dd>{TIPO_LABEL[visita.type] ?? visita.type}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{visita.status === 'concluida' ? 'Concluída' : visita.status}</dd>
            </div>
            <div className="ipt-campo-modal__meta--wide">
              <dt>Descrição</dt>
              <dd>{visita.description?.trim() || 'Sem descrição cadastrada'}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>,
    document.body
  )
}
