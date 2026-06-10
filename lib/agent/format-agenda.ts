import {
  type CalendarEventRow,
  eventMatchesCidade,
  formatAgendaDatePt,
  getCalendarEventDate,
  isSameLocalDay,
} from '@/lib/agenda/calendar-event-utils'
import { presentCalendarEvent } from '@/lib/agenda/event-present'
import {
  type AgendaDayScope,
  type AgendaTimePeriod,
  timePeriodLabel,
} from '@/lib/agent/agenda-query'
import type { AgendaDateFilter } from '@/lib/agent/parse-agenda-date'

export interface FormatAgendaOptions {
  dateFilter: AgendaDateFilter
  cidade?: string
  timePeriod?: AgendaTimePeriod
  dayScope?: AgendaDayScope
  maxItems?: number
}

function sortByStart(events: CalendarEventRow[]): CalendarEventRow[] {
  return [...events].sort((a, b) => {
    const da = getCalendarEventDate(a)?.getTime() ?? 0
    const db = getCalendarEventDate(b)?.getTime() ?? 0
    return da - db
  })
}

function isAllDayEvent(event: CalendarEventRow): boolean {
  return Boolean(event.start?.date && !event.start?.dateTime)
}

function eventInTimePeriod(event: CalendarEventRow, period: AgendaTimePeriod): boolean {
  if (isAllDayEvent(event)) return true
  const eventDate = getCalendarEventDate(event)
  if (!eventDate) return false
  const hour = eventDate.getHours()
  if (period === 'manha') return hour >= 5 && hour < 12
  if (period === 'tarde') return hour >= 12 && hour < 18
  return hour >= 18 || hour < 5
}

export function filterAgendaEvents(
  events: CalendarEventRow[],
  options: FormatAgendaOptions
): CalendarEventRow[] {
  const now = new Date()
  let filtered = events

  if (options.cidade?.trim()) {
    filtered = filtered.filter((event) => eventMatchesCidade(event, options.cidade!.trim()))
  }

  if (options.dateFilter.kind === 'day') {
    const targetDate = options.dateFilter.date
    filtered = filtered.filter((event) => {
      const eventDate = getCalendarEventDate(event)
      return eventDate ? isSameLocalDay(eventDate, targetDate) : false
    })
  } else {
    filtered = filtered.filter((event) => {
      const eventDate = getCalendarEventDate(event)
      return eventDate ? eventDate >= now : false
    })
  }

  if (options.timePeriod) {
    filtered = filtered.filter((event) => eventInTimePeriod(event, options.timePeriod!))
  }

  if (options.dayScope === 'upcoming') {
    filtered = filtered.filter((event) => {
      if (isAllDayEvent(event)) return true
      const eventDate = getCalendarEventDate(event)
      return eventDate ? eventDate >= now : false
    })
  }

  return sortByStart(filtered)
}

export function formatAgendaReply(
  events: CalendarEventRow[],
  options: FormatAgendaOptions
): string {
  const maxItems = options.maxItems ?? 8
  const filtered = filterAgendaEvents(events, options)
  const dayFilter = options.dateFilter.kind === 'day' ? options.dateFilter : null
  const tituloData = dayFilter ? formatAgendaDatePt(dayFilter.date) : options.dateFilter.label
  const periodoLabel = options.timePeriod ? ` ${timePeriodLabel(options.timePeriod)}` : ''
  const escopoLabel =
    options.dayScope === 'upcoming' ? ' · próximos' : options.dayScope === 'all' ? ' · todos' : ''

  const tituloCidade = options.cidade?.trim() ? ` · ${options.cidade.trim()}` : ''

  if (filtered.length === 0) {
    if (dayFilter) {
      return `Não há compromissos na agenda de **${dayFilter.label}**${periodoLabel} (${tituloData})${tituloCidade}${escopoLabel}.`
    }
    return `Não há **${options.dateFilter.label}**${tituloCidade} na agenda.`
  }

  const cabecalho = dayFilter
    ? `**Agenda de ${dayFilter.label}**${periodoLabel} (${tituloData})${tituloCidade}${escopoLabel}`
    : `**${options.dateFilter.label}**${tituloCidade}`

  let out = `${cabecalho}\n\n`
  const slice = filtered.slice(0, maxItems)

  slice.forEach((event, index) => {
    const item = presentCalendarEvent(event)
    out += `${index + 1}. **${item.time}** — **${item.title}**\n`

    const metaParts = [item.origin, item.location].filter(Boolean)
    if (metaParts.length > 0) {
      out += `   _${metaParts.join(' · ')}_\n`
    }

    if (item.description) {
      const preview =
        item.description.length > 160
          ? `${item.description.slice(0, 160)}…`
          : item.description
      out += `   > ${preview}\n`
    }
  })

  if (filtered.length > maxItems) {
    out += `\n+ ${filtered.length - maxItems} outro(s) evento(s)`
  }

  return out.trim()
}

/** TTS: só header (summary) + horário — nunca description nem location. */
export function buildAgendaSpeechSegments(
  events: CalendarEventRow[],
  options: FormatAgendaOptions
): string[] {
  const filtered = filterAgendaEvents(events, options)
  const dayFilter = options.dateFilter.kind === 'day' ? options.dateFilter : null
  const periodoLabel = options.timePeriod ? ` ${timePeriodLabel(options.timePeriod)}` : ''
  const segments: string[] = []

  if (dayFilter) {
    const tituloData = formatAgendaDatePt(dayFilter.date)
    segments.push(`Agenda de ${dayFilter.label}${periodoLabel}, ${tituloData}.`)
  } else {
    segments.push(`${options.dateFilter.label}.`)
  }

  if (filtered.length === 0) {
    segments.push('Não há compromissos neste período.')
    return segments
  }

  const slice = filtered.slice(0, options.maxItems ?? 8)
  slice.forEach((event, index) => {
    const item = presentCalendarEvent(event)
    segments.push(`Compromisso ${index + 1}: ${item.speechLine}.`)
  })

  if (filtered.length > slice.length) {
    segments.push(`E mais ${filtered.length - slice.length} compromissos.`)
  }

  return segments
}
