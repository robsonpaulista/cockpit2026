'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCalendarEvent, IconX } from '@tabler/icons-react'

export type WarRoomAgendaProximoItem = {
  id: string
  titulo: string
  /** YYYY-MM-DD para ordenação */
  dataKey: string
  dataLabel: string
  horario: string
  local: string
}

type Props = {
  municipio: string
  itens: WarRoomAgendaProximoItem[]
  onClose: () => void
}

/** Modal de próximos compromissos — visual clean alinhado à Expectativa de votos. */
export function WarRoomAgendaProximosModal({ municipio, itens, onClose }: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)

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

  if (!mounted) return null

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
        className="wr-visita-modal__panel"
      >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <span className="wr-visita-modal__icon" aria-hidden>
              <IconCalendarEvent className="h-4 w-4" stroke={1.75} />
            </span>
            <div className="min-w-0">
              <p className="wr-visita-modal__eyebrow">Expectativa de votos · Agenda</p>
              <h2 id={tituloId} className="wr-visita-modal__title truncate">
                Próximos 7 dias · {municipio}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="wr-visita-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <IconX className="h-4 w-4" stroke={1.75} />
          </button>
        </header>

        <p className="wr-visita-modal__lead">
          Compromissos da agenda com localização neste município.
        </p>

        {itens.length === 0 ? (
          <p className="wr-visita-modal__state">
            Nenhum compromisso encontrado para os próximos 7 dias.
          </p>
        ) : (
          <ul className="wr-agenda-proximos__list">
            {itens.map((item) => (
              <li key={item.id} className="wr-agenda-proximos__item">
                <div className="wr-agenda-proximos__when">
                  <span className="wr-agenda-proximos__data">{item.dataLabel}</span>
                  <span className="wr-agenda-proximos__hora tabular-nums">{item.horario}</span>
                </div>
                <div className="wr-agenda-proximos__body min-w-0">
                  <p className="wr-agenda-proximos__titulo truncate">{item.titulo}</p>
                  <p className="wr-agenda-proximos__local truncate">{item.local}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  )
}
