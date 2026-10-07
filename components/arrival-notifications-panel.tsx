'use client'

import { useMemo } from 'react'
import { Calendar, UserCheck } from 'lucide-react'
import { ArrivalTimer } from './arrival-timer'
import { formatAgendaTimePt, type CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import { origemETitulo } from '@/lib/agenda/agenda-filtros'

interface Presenca {
  attended: boolean | null
  arrival_time?: string
}

interface ArrivalNotificationsPanelProps {
  events: readonly CalendarEventRow[]
  attendanceStatuses: Record<string, Presenca>
  zIndex?: number
}

const horaCurta = (iso: string): string =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Quem chegou e ainda não foi marcado como atendido/não atendido. Usado dentro de `TsePage`. */
export function ArrivalNotificationsPanel({ events, attendanceStatuses, zIndex = 40 }: ArrivalNotificationsPanelProps) {
  const aguardando = useMemo(
    () =>
      events
        .flatMap((event) => {
          const presenca = attendanceStatuses[event.id]
          return presenca?.arrival_time && presenca.attended == null
            ? [{ event, chegada: presenca.arrival_time }]
            : []
        })
        .sort((a, b) => new Date(b.chegada).getTime() - new Date(a.chegada).getTime()),
    [events, attendanceStatuses],
  )

  if (aguardando.length === 0) return null

  return (
    <aside
      className="fixed right-0 top-0 flex h-screen w-80 flex-col border-l border-[var(--tse-border)] bg-white text-[var(--tse-text)] shadow-lg"
      style={{ zIndex }}
      aria-label="Avisos de chegada"
    >
      <div className="shrink-0 border-b border-[#EEEEEE] bg-[var(--tse-yellow-soft)] px-4 py-3">
        <h3 className="flex items-center gap-2 text-[15px] font-bold">
          <UserCheck className="h-5 w-5 text-[var(--tse-gold-text)]" aria-hidden />
          Avisos de chegada
        </h3>
        <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">
          {aguardando.length} {aguardando.length === 1 ? 'pessoa aguardando' : 'pessoas aguardando'}
        </p>
      </div>

      <ul className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {aguardando.map(({ event, chegada }) => (
          <li key={event.id} className="rounded-xl bg-[var(--tse-bar)] p-3 shadow-[inset_3px_0_0_var(--tse-yellow)]">
            <p className="line-clamp-2 text-[13px] font-bold leading-snug">
              {origemETitulo(event).titulo.replace(/^ATENDIMENTO:?\s*/i, '')}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--tse-muted)]">
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              Agenda: <strong className="text-[var(--tse-text)]">{formatAgendaTimePt(event)}</strong>
              <span aria-hidden>·</span>
              Chegou: <strong className="text-[var(--tse-text)]">{horaCurta(chegada)}</strong>
            </p>
            <ArrivalTimer arrivalTime={chegada} className="mt-2 border-t border-[#EEEEEE] pt-2" />
          </li>
        ))}
      </ul>
    </aside>
  )
}
