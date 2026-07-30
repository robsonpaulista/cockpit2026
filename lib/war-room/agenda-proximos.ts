import {
  formatAgendaTimePt,
  getCalendarEventDate,
  type CalendarEventRow,
} from '@/lib/agenda/calendar-event-utils'
import { parseEventOriginFromSummary } from '@/lib/agenda/event-present'
import { normalizeIptMunicipio } from '@/lib/ipt'

export type WarRoomAgendaProximoItem = {
  id: string
  titulo: string
  /** YYYY-MM-DD para ordenação */
  dataKey: string
  dataLabel: string
  horario: string
  local: string
}

/** Visita agendada com município (para fila de decisões / fluxo). */
export type WarRoomAgendaVisita = WarRoomAgendaProximoItem & {
  municipioKey: string
  municipioLabel: string
}

export const AGENDA_PROXIMOS_JANELA_DIAS = 7
export const WAR_ROOM_AGENDA_TZ = 'America/Sao_Paulo'

export function calendarDateInTz(
  iso: string | Date,
  timeZone: string = WAR_ROOM_AGENDA_TZ,
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function todayKeyInTz(timeZone: string = WAR_ROOM_AGENDA_TZ): string {
  return calendarDateInTz(new Date(), timeZone)
}

export function addDaysToKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  if (!y || !m || !d) return dayKey
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export function formatDataLabelBr(dayKey: string): string {
  const [y, m, d] = dayKey.split('-')
  if (!y || !m || !d) return dayKey
  return `${d}/${m}`
}

function normalizeAgendaHora(hora: string | null | undefined): string {
  if (!hora) return '—'
  const trimmed = String(hora).trim()
  if (/^\d{2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 5)
  return trimmed
}

function titleCaseMunicipio(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s'-])(\S)/g, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('pt-BR'))
}

/** Extrai município da location ou do badge de origem no título. */
export function municipioFromAgendaEvent(event: CalendarEventRow): {
  key: string
  label: string
} | null {
  const loc = event.location?.trim()
  if (loc) {
    const first = loc.split(',')[0]?.trim()
    if (first && first !== '—') {
      return { key: normalizeIptMunicipio(first), label: titleCaseMunicipio(first) }
    }
  }

  const { origin } = parseEventOriginFromSummary(event.summary || '')
  if (origin) {
    const beforeState = origin.split(/\s*-\s*/)[0]?.trim()
    if (beforeState) {
      return {
        key: normalizeIptMunicipio(beforeState),
        label: titleCaseMunicipio(beforeState),
      }
    }
  }

  return null
}

/**
 * Eventos só informativos (ex.: agenda do governador) — não entram
 * na fila de decisões / alertas da War Room.
 */
export function isAgendaParaConhecimento(summaryOrTitle: string): boolean {
  const text = summaryOrTitle
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLocaleUpperCase('pt-BR')
  return text.startsWith('PARA CONHECIMENTO')
}

export function buildAgendaProximosPorMunicipio(
  events: CalendarEventRow[],
  opts?: { janelaDias?: number; hojeKey?: string },
): Map<string, WarRoomAgendaProximoItem[]> {
  const visitas = listAgendaVisitasProximas(events, opts)
  const byCity = new Map<string, WarRoomAgendaProximoItem[]>()

  for (const visita of visitas) {
    const { municipioKey: _k, municipioLabel: _l, ...item } = visita
    const list = byCity.get(visita.municipioKey) ?? []
    list.push(item)
    byCity.set(visita.municipioKey, list)
  }

  return byCity
}

/** Lista plana de visitas na janela (hoje → +N dias), ordenada por data/hora. */
export function listAgendaVisitasProximas(
  events: CalendarEventRow[],
  opts?: { janelaDias?: number; hojeKey?: string },
): WarRoomAgendaVisita[] {
  const janela = opts?.janelaDias ?? AGENDA_PROXIMOS_JANELA_DIAS
  const today = opts?.hojeKey ?? todayKeyInTz()
  const endKey = addDaysToKey(today, janela - 1)
  const out: WarRoomAgendaVisita[] = []

  for (const event of events) {
    if (event.status === 'cancelled') continue
    const date = getCalendarEventDate(event)
    if (!date) continue
    const dayKey = calendarDateInTz(date)
    if (!dayKey || dayKey < today || dayKey > endKey) continue

    const mun = municipioFromAgendaEvent(event)
    if (!mun) continue

    const { origin, title } = parseEventOriginFromSummary(event.summary || '')
    out.push({
      id: event.id || `${mun.key}-${dayKey}-${title}`,
      titulo: title || 'Sem título',
      dataKey: dayKey,
      dataLabel: formatDataLabelBr(dayKey),
      horario: normalizeAgendaHora(formatAgendaTimePt(event)),
      local: event.location?.trim() || origin || '—',
      municipioKey: mun.key,
      municipioLabel: mun.label,
    })
  }

  out.sort((a, b) => {
    const byDate = a.dataKey.localeCompare(b.dataKey)
    if (byDate !== 0) return byDate
    return a.horario.localeCompare(b.horario, 'pt-BR')
  })

  return out
}

export function agendaFluxoKeyForVisita(visita: WarRoomAgendaProximoItem): string {
  return `${visita.dataKey}:${visita.id}`
}
