import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import {
  formatAgendaTimeForSpeech,
  formatAgendaTimePt,
} from '@/lib/agenda/calendar-event-utils'

/** Mesma regra da página /dashboard/agenda — origem no início: (THE - PI), (BSB), (PIAUÍ)… */
export function parseEventOriginFromSummary(summary: string): {
  origin?: string
  title: string
} {
  const text = summary?.trim() || ''
  if (!text) return { title: 'Sem título' }

  const match = text.match(/^(\([^)]+\))\s*(.*)$/s)
  if (!match) return { title: text }

  const origin = match[1].replace(/[()]/g, '').trim()
  const title = match[2].trim() || text
  return { origin, title }
}

export function stripHtmlForAgenda(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripEmojisForAgenda(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\uFE0F\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Descrição — mesmo tratamento da página Agenda (canto inferior direito). */
export function formatEventDescriptionForDisplay(description?: string): string | undefined {
  if (!description?.trim()) return undefined
  let cleaned = stripHtmlForAgenda(description)
  cleaned = cleaned.replace(/^\([^)]+\)\s*/, '').trim()
  return cleaned || undefined
}

export interface AgendaEventPresentation {
  time: string
  timeSpeech: string
  origin?: string
  /** Título = campo summary (sem badge de origem), igual ao h4 da página. */
  title: string
  location?: string
  /** Campo description — só exibição, nunca voz. */
  description?: string
  speechLine: string
}

/**
 * Espelha a estrutura da página de compromissos:
 * - summary → título (header)
 * - start → horário
 * - location → endereço (visual)
 * - description → descrição (visual)
 */
export function presentCalendarEvent(event: CalendarEventRow): AgendaEventPresentation {
  const rawSummary = stripEmojisForAgenda(
    stripHtmlForAgenda(event.summary?.trim() || 'Sem título')
  )
  const { origin, title } = parseEventOriginFromSummary(rawSummary)
  const time = formatAgendaTimePt(event)
  const timeSpeech = formatAgendaTimeForSpeech(event)
  const location = event.location?.trim() || undefined
  const description = formatEventDescriptionForDisplay(event.description)

  const speechTitle = title || 'compromisso sem título'
  const speechLine =
    timeSpeech === 'dia inteiro'
      ? speechTitle
      : `às ${timeSpeech}, ${speechTitle}`

  return {
    time,
    timeSpeech,
    origin,
    title: title || rawSummary,
    location,
    description,
    speechLine,
  }
}
