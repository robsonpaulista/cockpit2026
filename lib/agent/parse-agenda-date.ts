import { startOfLocalDay } from '@/lib/agenda/calendar-event-utils'

export type AgendaDateFilter =
  | { kind: 'day'; date: Date; label: string }
  | { kind: 'upcoming'; label: string }

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
}

function normalize(query: string): string {
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return startOfLocalDay(d)
}

function resolveWeekday(targetDay: number, reference: Date): Date {
  const ref = startOfLocalDay(reference)
  const current = ref.getDay()
  let delta = targetDay - current
  if (delta < 0) delta += 7
  if (delta === 0) return ref
  return addDays(ref, delta)
}

function parseExplicitDate(match: RegExpMatchArray, reference: Date): Date | null {
  const day = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  if (!day || !month || day > 31 || month > 12) return null

  let year = match[3] ? Number.parseInt(match[3], 10) : reference.getFullYear()
  if (year < 100) year += 2000

  const parsed = startOfLocalDay(new Date(year, month - 1, day))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

/**
 * Extrai a data citada pelo usuário em consultas de agenda.
 * Padrão: hoje, quando menciona agenda sem data explícita.
 */
export function parseAgendaDateFromQuery(
  query: string,
  referenceDate = new Date()
): AgendaDateFilter {
  const q = normalize(query)
  const ref = startOfLocalDay(referenceDate)

  if (/\bhoje\b/.test(q) || /\bde hoje\b/.test(q) || /\bagenda do dia\b/.test(q)) {
    return { kind: 'day', date: ref, label: 'hoje' }
  }

  if (/\bamanha\b/.test(q)) {
    return { kind: 'day', date: addDays(ref, 1), label: 'amanhã' }
  }

  if (/\bontem\b/.test(q)) {
    return { kind: 'day', date: addDays(ref, -1), label: 'ontem' }
  }

  if (
    /\bproxim[oa]s?\s+(compromissos|eventos|agenda)\b/.test(q) ||
    /\bagenda\s+proxim/.test(q) ||
    (/\bsemana\b/.test(q) && !/\b(hoje|amanha|ontem)\b/.test(q))
  ) {
    return { kind: 'upcoming', label: 'próximos eventos' }
  }

  const isoMatch = q.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (isoMatch) {
    const date = startOfLocalDay(
      new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    )
    if (!Number.isNaN(date.getTime())) {
      return { kind: 'day', date, label: date.toLocaleDateString('pt-BR') }
    }
  }

  const brMatch = q.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (brMatch) {
    const date = parseExplicitDate(brMatch, referenceDate)
    if (date) {
      return { kind: 'day', date, label: date.toLocaleDateString('pt-BR') }
    }
  }

  for (const [name, dayIndex] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(q)) {
      const date = resolveWeekday(dayIndex, referenceDate)
      return { kind: 'day', date, label: name }
    }
  }

  if (/\bagenda\b/.test(q) || /\bcompromissos?\b/.test(q) || /\beventos?\b/.test(q)) {
    return { kind: 'day', date: ref, label: 'hoje' }
  }

  return { kind: 'upcoming', label: 'próximos eventos' }
}
