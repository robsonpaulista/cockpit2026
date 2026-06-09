export interface CalendarEventRow {
  id: string
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  location?: string
  status?: string
}

export function getCalendarEventDate(event: CalendarEventRow): Date | null {
  if (event.start?.dateTime) return new Date(event.start.dateTime)
  if (event.start?.date) return new Date(`${event.start.date}T12:00:00`)
  return null
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return startOfLocalDay(a).getTime() === startOfLocalDay(b).getTime()
}

export function formatAgendaDatePt(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatAgendaTimePt(event: CalendarEventRow): string {
  if (event.start?.date && !event.start?.dateTime) return 'dia inteiro'
  const date = getCalendarEventDate(event)
  if (!date) return '—'
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Horário legível para síntese de voz (evita "zero nove três zero"). */
export function formatAgendaTimeForSpeech(event: CalendarEventRow): string {
  if (event.start?.date && !event.start?.dateTime) return 'dia inteiro'
  const date = getCalendarEventDate(event)
  if (!date) return ''
  const h = date.getHours()
  const m = date.getMinutes()
  if (m === 0) return `${h} horas`
  return `${h} horas e ${m} minutos`
}

export function normalizeAgendaText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function eventMatchesCidade(event: CalendarEventRow, cidade: string): boolean {
  const cidadeNorm = normalizeAgendaText(cidade)
  if (!cidadeNorm) return true
  const haystack = normalizeAgendaText(
    [event.summary, event.description, event.location].filter(Boolean).join(' ')
  )
  return haystack.includes(cidadeNorm) || cidadeNorm.includes(haystack)
}
