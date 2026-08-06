'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCalendarEvent, IconMapRoute, IconX } from '@tabler/icons-react'
import type { IptMunicipio } from '@/lib/ipt'
import type { WarRoomAgendaProximoItem } from '@/lib/war-room/agenda-proximos'
import { AGENDA_PROXIMOS_JANELA_DIAS } from '@/lib/war-room/agenda-proximos'
import { WarRoomAgendaFluxoPanel } from '@/components/war-room/war-room-agenda-fluxo-panel'
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

function sortItens(itens: WarRoomAgendaProximoItem[]): WarRoomAgendaProximoItem[] {
  return [...itens].sort((a, b) => {
    const byDate = a.dataKey.localeCompare(b.dataKey)
    if (byDate !== 0) return byDate
    return a.horario.localeCompare(b.horario, 'pt-BR')
  })
}

/** Modal de próximos compromissos + fluxo operacional da visita. */
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

  const ordenados = useMemo(() => sortItens(itens), [itens])

  const [selectedId, setSelectedId] = useState<string | null>(ordenados[0]?.id ?? null)

  useEffect(() => {
    if (ordenados.length === 0) {
      setSelectedId(null)
      return
    }
    setSelectedId((prev) =>
      prev && ordenados.some((i) => i.id === prev) ? prev : ordenados[0].id,
    )
  }, [ordenados])

  const selecionado = useMemo(
    () => ordenados.find((i) => i.id === selectedId) ?? ordenados[0] ?? null,
    [ordenados, selectedId],
  )

  const fluxoKey = selecionado
    ? `${selecionado.dataKey}:${selecionado.id}`
    : `sem-agenda:${hojeKey}`

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
          className="wr-visita-modal__panel wr-agenda-proximos__panel"
        >
          <header className="wr-visita-modal__head wr-agenda-proximos__head">
            <div className="wr-visita-modal__head-main min-w-0">
              <span className="wr-visita-modal__icon" aria-hidden>
                <IconCalendarEvent className="h-4 w-4" stroke={1.75} />
              </span>
              <div className="min-w-0">
                <p className="wr-visita-modal__eyebrow">Expectativa de votos · Agenda</p>
                <h2 id={tituloId} className="wr-visita-modal__title truncate">
                  Operação de campo · {municipio}
                </h2>
              </div>
            </div>
            <div className="wr-agenda-proximos__head-actions">
              {selecionado ? (
                <button
                  type="button"
                  className="wr-agenda-proximos__sugestao-btn"
                  onClick={() => setSugestaoAberta(true)}
                >
                  <IconMapRoute className="h-3.5 w-3.5 shrink-0" stroke={1.75} aria-hidden />
                  <span>Sugerir agenda no TD · até {selecionado.dataLabel}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="wr-visita-modal__close"
                onClick={onClose}
                aria-label="Fechar"
              >
                <IconX className="h-4 w-4" stroke={1.75} />
              </button>
            </div>
          </header>

          <div className="wr-agenda-proximos__layout wr-agenda-proximos__layout--stack">
            <section className="wr-agenda-proximos__col wr-agenda-proximos__col--agenda" aria-label="Compromissos">
              <div className="wr-agenda-proximos__section-head">
                <p className="wr-agenda-proximos__section-label">
                  Compromissos · {AGENDA_PROXIMOS_JANELA_DIAS} dias
                </p>
                <p className="wr-agenda-proximos__section-sub">
                  Selecione o item para acompanhar o fluxo operacional.
                </p>
              </div>

              {ordenados.length === 0 ? (
                <p className="wr-visita-modal__state wr-agenda-proximos__empty">
                  Nenhum compromisso encontrado para os próximos {AGENDA_PROXIMOS_JANELA_DIAS}{' '}
                  dias.
                </p>
              ) : (
                <ul className="wr-agenda-proximos__list">
                  {ordenados.map((item) => {
                    const ativo = item.id === selecionado?.id
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={
                            ativo
                              ? 'wr-agenda-proximos__item wr-agenda-proximos__item--active'
                              : 'wr-agenda-proximos__item'
                          }
                          aria-pressed={ativo}
                          onClick={() => setSelectedId(item.id)}
                        >
                          <div className="wr-agenda-proximos__when">
                            <span className="wr-agenda-proximos__data">{item.dataLabel}</span>
                            <span className="wr-agenda-proximos__hora tabular-nums">
                              {item.horario}
                            </span>
                          </div>
                          <div className="wr-agenda-proximos__body min-w-0">
                            <p className="wr-agenda-proximos__titulo">{item.titulo}</p>
                            <p className="wr-agenda-proximos__local">{item.local}</p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section
              className="wr-agenda-proximos__col wr-agenda-proximos__col--fluxo"
              aria-label="Fluxo operacional"
            >
              <WarRoomAgendaFluxoPanel
                municipio={municipio}
                fluxoKey={fluxoKey}
                temAgendamento={Boolean(selecionado)}
                prazoLabel={selecionado?.dataLabel ?? null}
              />
            </section>
          </div>
        </div>
      </div>

      {sugestaoAberta && selecionado ? (
        <WarRoomAgendaSugestaoTdModal
          cidadePai={municipio}
          dataPaiKey={selecionado.dataKey}
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
