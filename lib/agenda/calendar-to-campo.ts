import {
  getCalendarEventDate,
  normalizeAgendaText,
  type CalendarEventRow,
} from '@/lib/agenda/calendar-event-utils'
import { parseEventOriginFromSummary, stripEmojisForAgenda } from '@/lib/agenda/event-present'
import {
  getTodosMunicipiosPIOficiaisOrdenados,
  resolverNomeMunicipioPIOficial,
} from '@/lib/piaui-territorio-desenvolvimento'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'

export type CampoAgendaType = 'visita' | 'evento' | 'reuniao' | 'outro'

export interface CampoCityOption {
  id: string
  name: string
  state: string
}

export interface CalendarToCampoPrefill {
  google_event_id: string
  date: string
  city_id: string
  type: CampoAgendaType
  description: string
  hora_evento?: string
  cidadeSugerida?: string
}

/** Infere o tipo de agenda de campo a partir do título do compromisso Google. */
export function inferCampoTypeFromSummary(summary: string): CampoAgendaType {
  const s = summary.toUpperCase()
  if (/\bVIAGEM\b/.test(s)) return 'visita'
  if (/\bOBRAS?\b/.test(s)) return 'visita'
  if (/\bEVENTO\b/.test(s)) return 'evento'
  if (/\bREUNI[AÃ]O\b/.test(s)) return 'reuniao'
  return 'outro'
}

function eventDateIso(event: CalendarEventRow): string {
  const d = getCalendarEventDate(event)
  if (!d) return new Date().toISOString().slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function extractHoraEvento(event: CalendarEventRow): string | undefined {
  if (!event.start?.dateTime) return undefined
  const d = getCalendarEventDate(event)
  if (!d) return undefined
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${min}:00`
}

function municipioFromOriginTag(origin?: string): string | null {
  if (!origin) return null
  const beforeState = origin.split(/\s*-\s*/)[0]?.trim()
  if (!beforeState) return null
  return resolverNomeMunicipioPIOficial(beforeState)
}

function municipioFromLocation(location?: string): string | null {
  if (!location?.trim()) return null
  const first = location.split(',')[0]?.trim()
  if (!first) return null
  return resolverNomeMunicipioPIOficial(first)
}

function municipioFromTexto(haystack: string): string | null {
  const normHay = normalizeAgendaText(haystack)
  if (!normHay) return null

  for (const canon of getTodosMunicipiosPIOficiaisOrdenados()) {
    const normCanon = normalizeMunicipioNome(canon)
    if (normCanon.length < 4) continue
    if (normHay.includes(normCanon)) return canon
  }
  return null
}

export function resolveCampoCityId(
  event: CalendarEventRow,
  cities: CampoCityOption[]
): { city_id: string; cidadeSugerida?: string } {
  const rawSummary = stripEmojisForAgenda(event.summary?.trim() || '')
  const { origin, title } = parseEventOriginFromSummary(rawSummary)
  const haystack = [title, event.description, event.location].filter(Boolean).join(' ')

  const candidatos = [
    municipioFromOriginTag(origin),
    municipioFromLocation(event.location),
    municipioFromTexto(haystack),
  ].filter((c): c is string => Boolean(c))

  const cityByNorm = new Map(
    cities.map((c) => [normalizeMunicipioNome(c.name), c] as const)
  )

  for (const nome of candidatos) {
    const city = cityByNorm.get(normalizeMunicipioNome(nome))
    if (city) return { city_id: city.id, cidadeSugerida: city.name }
  }

  return { city_id: '', cidadeSugerida: candidatos[0] }
}

function buildDescription(event: CalendarEventRow): string {
  const rawSummary = stripEmojisForAgenda(event.summary?.trim() || 'Compromisso')
  const { title } = parseEventOriginFromSummary(rawSummary)
  const parts = [title]
  if (event.location?.trim()) parts.push(`Local: ${event.location.trim()}`)
  const desc = event.description?.trim()
  if (desc) parts.push(desc)
  parts.push(`[Google Calendar: ${event.id}]`)
  return parts.join('\n')
}

export function buildCampoPrefillFromCalendarEvent(
  event: CalendarEventRow,
  cities: CampoCityOption[]
): CalendarToCampoPrefill {
  const rawSummary = stripEmojisForAgenda(event.summary?.trim() || '')
  const { title } = parseEventOriginFromSummary(rawSummary)
  const { city_id, cidadeSugerida } = resolveCampoCityId(event, cities)

  return {
    google_event_id: event.id,
    date: eventDateIso(event),
    city_id,
    type: inferCampoTypeFromSummary(title || rawSummary),
    description: buildDescription(event),
    hora_evento: extractHoraEvento(event),
    cidadeSugerida,
  }
}

export const CAMPO_TYPE_LABELS: Record<CampoAgendaType, string> = {
  visita: 'Visita',
  evento: 'Evento',
  reuniao: 'Reunião',
  outro: 'Outro',
}
