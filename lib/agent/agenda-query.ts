import { isSameLocalDay, startOfLocalDay } from '@/lib/agenda/calendar-event-utils'
import {
  type AgendaDateFilter,
  parseAgendaDateFromQuery,
} from '@/lib/agent/parse-agenda-date'

export type AgendaTimePeriod = 'manha' | 'tarde' | 'noite'
export type AgendaDayScope = 'upcoming' | 'all'

export interface ParsedAgendaQuery {
  dateFilter: AgendaDateFilter
  timePeriod: AgendaTimePeriod | null
  dayScope: AgendaDayScope | null
}

export interface AgendaScopePending {
  cidade?: string
  dateIso: string
  dateLabel: string
  timePeriod?: AgendaTimePeriod | null
}

function normalize(query: string): string {
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function parseAgendaTimePeriod(query: string): AgendaTimePeriod | null {
  const q = normalize(query)
  if (
    /\b(manha|de manha|pela manha|agenda da manha|compromissos da manha|compromissos de manha)\b/.test(
      q
    )
  ) {
    return 'manha'
  }
  if (
    /\b(tarde|a tarde|de tarde|pela tarde|agenda da tarde|compromissos da tarde|compromissos de tarde)\b/.test(
      q
    )
  ) {
    return 'tarde'
  }
  if (
    /\b(noite|a noite|de noite|pela noite|agenda da noite|compromissos da noite|madrugada)\b/.test(
      q
    )
  ) {
    return 'noite'
  }
  return null
}

export function parseAgendaDayScope(query: string): AgendaDayScope | null {
  const q = normalize(query)
  if (
    /\b(todos|todo o dia|dia inteiro|completa|completo|inclusive|incluindo|ja passou|já passou|passados|que ja passaram)\b/.test(
      q
    ) &&
    !/\b(somente|so|só|apenas)\s+proxim/.test(q)
  ) {
    return 'all'
  }
  if (
    /\b(proxim[oa]s?|restantes|daqui pra frente|ainda hoje|so os proximos|só os próximos|somente proximos|faltam)\b/.test(
      q
    )
  ) {
    return 'upcoming'
  }
  return null
}

export function parseAgendaQuery(query: string, referenceDate = new Date()): ParsedAgendaQuery {
  return {
    dateFilter: parseAgendaDateFromQuery(query, referenceDate),
    timePeriod: parseAgendaTimePeriod(query),
    dayScope: parseAgendaDayScope(query),
  }
}

export function agendaNeedsScopeChoice(
  parsed: ParsedAgendaQuery,
  referenceDate = new Date()
): boolean {
  if (parsed.dayScope) return false
  if (parsed.timePeriod) return false
  if (parsed.dateFilter.kind !== 'day') return false
  return isSameLocalDay(parsed.dateFilter.date, startOfLocalDay(referenceDate))
}

export function buildAgendaScopeQuestion(referenceDate = new Date()): string {
  const hora = referenceDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return [
    `São **${hora}**.`,
    '',
    'Quer que eu fale só os **próximos** compromissos de hoje ou **todos** os do dia, inclusive os que já passaram?',
    '',
    'Responda **próximos** ou **todos**.',
  ].join('\n')
}

export function parseAgendaDayScopeFromAnswer(query: string): AgendaDayScope | null {
  const q = normalize(query)
  if (!q) return null

  if (
    /\b(todos|todo o dia|completa|completo|inclusive|passados|inteiro|dia todo)\b/.test(q) ||
    /^todos$/.test(q)
  ) {
    return 'all'
  }

  if (
    /^proxim/.test(q) ||
    /\bproxim[oa]s?\b/.test(q) ||
    /\b(restantes|daqui pra frente|falta|faltam|ainda hoje)\b/.test(q) ||
    /^so\s+proxim/.test(q) ||
    /^somente\s+proxim/.test(q)
  ) {
    return 'upcoming'
  }

  return null
}

export function isAgendaScopeAnswer(query: string): boolean {
  return parseAgendaDayScopeFromAnswer(query) !== null
}

export function timePeriodLabel(period: AgendaTimePeriod): string {
  if (period === 'manha') return 'da manhã'
  if (period === 'tarde') return 'da tarde'
  return 'da noite'
}

export function dateToIso(date: Date): string {
  const d = startOfLocalDay(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return startOfLocalDay(new Date(y, (m || 1) - 1, d || 1))
}

export function buildAgendaScopePending(
  parsed: ParsedAgendaQuery,
  cidade?: string
): AgendaScopePending | null {
  if (parsed.dateFilter.kind !== 'day') return null
  return {
    cidade,
    dateIso: dateToIso(parsed.dateFilter.date),
    dateLabel: parsed.dateFilter.label,
    timePeriod: parsed.timePeriod,
  }
}
