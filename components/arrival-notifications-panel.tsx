'use client'

import { useMemo } from 'react'
import { Calendar, UserCheck } from 'lucide-react'
import { ArrivalTimer } from './arrival-timer'

interface CalendarEvent {
  id: string
  summary: string
  start: {
    dateTime?: string
    date?: string
  }
}

interface AttendanceStatus {
  attended: boolean
  notes?: string
  arrival_time?: string
}

interface ArrivalNotificationsPanelProps {
  events: CalendarEvent[]
  attendanceStatuses: Record<string, AttendanceStatus>
  formatTime: (dateString?: string) => string
  zIndex?: number
}

export function ArrivalNotificationsPanel({
  events,
  attendanceStatuses,
  formatTime,
  zIndex = 40,
}: ArrivalNotificationsPanelProps) {
  // Filtrar eventos que têm arrival_time mas não têm attended definido
  const activeArrivals = useMemo(() => {
    return events
      .filter((event) => {
        const attendance = attendanceStatuses[event.id]
        // Deve ter arrival_time E não ter attended definido (ou seja, ainda não foi marcado como atendido/não atendido)
        // Verifica tanto undefined quanto null (que pode vir do banco)
        return attendance?.arrival_time && (attendance?.attended === undefined || attendance?.attended === null)
      })
      .map((event) => ({
        event,
        attendance: attendanceStatuses[event.id],
      }))
      .sort((a, b) => {
        // Ordenar por horário de chegada (mais recente primeiro)
        const timeA = a.attendance?.arrival_time ? new Date(a.attendance.arrival_time).getTime() : 0
        const timeB = b.attendance?.arrival_time ? new Date(b.attendance.arrival_time).getTime() : 0
        return timeB - timeA
      })
  }, [events, attendanceStatuses])

  const truncateText = (text: string, maxLength: number = 20): string => {
    if (!text) return ''
    
    // Remover prefixo do tipo "(THE-PI)" ou "(BSB)" do início do texto
    let textWithoutPrefix = text.replace(/^\([^)]+\)\s*/, '')
    
    // Remover "ATENDIMENTO:" ou "ATENDIMENTO" do início do texto
    textWithoutPrefix = textWithoutPrefix.replace(/^ATENDIMENTO:?\s*/i, '')
    
    if (textWithoutPrefix.length <= maxLength) return textWithoutPrefix
    return textWithoutPrefix.substring(0, maxLength) + '...'
  }

  if (activeArrivals.length === 0) {
    return null
  }

  return (
    <div className={`fixed top-0 right-0 h-screen w-80 bg-surface border-l border-card shadow-lg`} style={{ zIndex }}>
      <div className="h-full flex flex-col">
        {/* Header fixo */}
        <div className="flex-shrink-0 bg-surface border-b border-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="w-5 h-5 text-accent-gold" />
            <h3 className="text-lg font-semibold text-primary">Avisos de Chegada</h3>
          </div>
          <p className="text-xs text-secondary">
            {activeArrivals.length} {activeArrivals.length === 1 ? 'pessoa aguardando' : 'pessoas aguardando'}
          </p>
        </div>
        
        {/* Lista rolável */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeArrivals.map(({ event, attendance }) => {
          const eventTime = event.start.dateTime || event.start.date
          const arrivalTime = attendance?.arrival_time

          return (
            <div
              key={event.id}
              className="p-3 rounded-lg border border-card bg-background hover:border-accent-gold/30 transition-colors"
            >
              {/* Resumo do evento */}
              <div className="mb-2">
                <p className="text-sm font-semibold text-primary">
                  {truncateText(event.summary || 'Sem título', 20)}
                </p>
              </div>

              {/* Horário da agenda */}
              <div className="flex items-center gap-2 mb-1.5 text-xs text-secondary">
                <Calendar className="w-3.5 h-3.5" />
                <span>Agenda: <span className="font-medium text-primary">{formatTime(eventTime)}</span></span>
              </div>

              {/* Horário de chegada */}
              {arrivalTime && (
                <div className="flex items-center gap-2 mb-1.5 text-xs text-secondary">
                  <UserCheck className="w-3.5 h-3.5 text-accent-gold" />
                  <span>Chegou: <span className="font-medium text-primary">{formatTime(arrivalTime)}</span></span>
                </div>
              )}

              {/* Timer de espera */}
              {arrivalTime && (
                <div className="mt-2 pt-2 border-t border-card">
                  <ArrivalTimer arrivalTime={arrivalTime} />
                </div>
              )}
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
