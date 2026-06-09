import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import { isSameLocalDay, startOfLocalDay } from '@/lib/agenda/calendar-event-utils'
import {
  type AgendaDayScope,
  type AgendaScopePending,
  agendaNeedsScopeChoice,
  buildAgendaScopePending,
  buildAgendaScopeQuestion,
  isoToDate,
  parseAgendaDayScopeFromAnswer,
  parseAgendaQuery,
} from '@/lib/agent/agenda-query'
import { buildAgendaSpeechSegments, formatAgendaReply } from '@/lib/agent/format-agenda'
import type { AgendaDateFilter } from '@/lib/agent/parse-agenda-date'

export type AgendaReplyResult =
  | { kind: 'data'; content: string; speechSegments?: string[] }
  | { kind: 'ask_scope'; content: string; pending: AgendaScopePending }
  | { kind: 'error'; content: string }

export interface ResolveAgendaOptions {
  cidade?: string
  dayScope?: AgendaDayScope
  /** Quando o usuário já respondeu próximos/todos após a pergunta de escopo. */
  scopePending?: AgendaScopePending
  referenceDate?: Date
  maxItems?: number
}

function dateFilterFromPending(pending: AgendaScopePending): AgendaDateFilter {
  return {
    kind: 'day',
    date: isoToDate(pending.dateIso),
    label: pending.dateLabel,
  }
}

function buildAgendaScopeReminder(): string {
  return 'Responda **próximos** (só o que falta hoje) ou **todos** (dia inteiro, inclusive o que já passou).'
}

export function resolveAgendaReply(
  events: CalendarEventRow[],
  query: string,
  options: ResolveAgendaOptions = {}
): AgendaReplyResult {
  const referenceDate = options.referenceDate ?? new Date()

  // Fluxo de follow-up: usuário respondeu próximos/todos
  if (options.scopePending) {
    const dayScope = options.dayScope ?? parseAgendaDayScopeFromAnswer(query)
    if (!dayScope) {
      return {
        kind: 'ask_scope',
        content: buildAgendaScopeReminder(),
        pending: options.scopePending,
      }
    }

    const formatOpts = {
      dateFilter: dateFilterFromPending(options.scopePending),
      cidade: options.scopePending.cidade,
      timePeriod: options.scopePending.timePeriod ?? undefined,
      dayScope,
      maxItems: options.maxItems ?? 8,
    }
    return {
      kind: 'data',
      content: formatAgendaReply(events, formatOpts),
      speechSegments: buildAgendaSpeechSegments(events, formatOpts),
    }
  }

  const answerScope = parseAgendaDayScopeFromAnswer(query)
  if (answerScope) {
    const formatOpts = {
      dateFilter: {
        kind: 'day' as const,
        date: startOfLocalDay(referenceDate),
        label: 'hoje',
      },
      cidade: options.cidade,
      dayScope: answerScope,
      maxItems: options.maxItems ?? 8,
    }
    return {
      kind: 'data',
      content: formatAgendaReply(events, formatOpts),
      speechSegments: buildAgendaSpeechSegments(events, formatOpts),
    }
  }

  const parsed = parseAgendaQuery(query, referenceDate)
  const dayScope = options.dayScope ?? parsed.dayScope

  if (!dayScope && agendaNeedsScopeChoice(parsed, referenceDate)) {
    const pending = buildAgendaScopePending(parsed, options.cidade)
    if (pending) {
      return {
        kind: 'ask_scope',
        content: buildAgendaScopeQuestion(referenceDate),
        pending,
      }
    }
  }

  const effectiveDayScope: AgendaDayScope | undefined =
    dayScope ??
    (parsed.dateFilter.kind === 'day' &&
    !isSameLocalDay(parsed.dateFilter.date, startOfLocalDay(referenceDate))
      ? 'all'
      : undefined)

  const formatOpts = {
    dateFilter: parsed.dateFilter,
    cidade: options.cidade,
    timePeriod: parsed.timePeriod ?? undefined,
    dayScope: effectiveDayScope,
    maxItems: options.maxItems ?? 8,
  }

  return {
    kind: 'data',
    content: formatAgendaReply(events, formatOpts),
    speechSegments: buildAgendaSpeechSegments(events, formatOpts),
  }
}
