'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCalendarEvent, IconMapRoute, IconX } from '@tabler/icons-react'
import type { IptMunicipio } from '@/lib/ipt'
import type { WarRoomAgendaProximoItem } from '@/lib/war-room/agenda-proximos'
import { WarRoomAgendaSugestaoTdModal } from '@/components/war-room/war-room-agenda-sugestao-td-modal'

export type { WarRoomAgendaProximoItem } from '@/lib/war-room/agenda-proximos'

type Props = {
  municipio: string
  itens: WarRoomAgendaProximoItem[]
  hojeKey: string
  municipiosIpt: IptMunicipio[]
  agendaPorMunicipio: Map<string, WarRoomAgendaProximoItem[]>
  onClose: () => void
}

/** Modal de próximos compromissos — visual clean alinhado à Expectativa de votos. */
export function WarRoomAgendaProximosModal({
  municipio,
  itens,
  hojeKey,
  municipiosIpt,
  agendaPorMunicipio,
  onClose,
}: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)
  const [sugestaoAberta, setSugestaoAberta] = useState(false)

  const eventoPai = useMemo(() => {
    if (itens.length === 0) return null
    return [...itens].sort((a, b) => {
      const byDate = a.dataKey.localeCompare(b.dataKey)
      if (byDate !== 0) return byDate
      return a.horario.localeCompare(b.horario, 'pt-BR')
    })[0]
  }, [itens])

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sugestaoAberta) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, sugestaoAberta])

  if (!mounted) return null

  return createPortal(
    <>
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
            Compromissos com localização ou badge de cidade no título deste município.
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

          {eventoPai ? (
            <div className="wr-agenda-proximos__actions">
              <button
                type="button"
                className="wr-agenda-proximos__sugestao-btn"
                onClick={() => setSugestaoAberta(true)}
              >
                <IconMapRoute className="h-4 w-4 shrink-0" stroke={1.75} aria-hidden />
                <span>
                  Sugerir agenda no TD · até {eventoPai.dataLabel}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {sugestaoAberta && eventoPai ? (
        <WarRoomAgendaSugestaoTdModal
          cidadePai={municipio}
          dataPaiKey={eventoPai.dataKey}
          hojeKey={hojeKey}
          municipios={municipiosIpt}
          agendaPorMunicipio={agendaPorMunicipio}
          onClose={() => setSugestaoAberta(false)}
        />
      ) : null}
    </>,
    document.body,
  )
}
