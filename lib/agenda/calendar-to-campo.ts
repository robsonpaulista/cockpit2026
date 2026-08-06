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

function municipiosPIPorTamanhoDesc(): string[] {
  return [...getTodosMunicipiosPIOficiaisOrdenados()].sort(
    (a, b) =>
      normalizeMunicipioNome(b).length - normalizeMunicipioNome(a).length ||
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  )
}

/**
 * Nomes que colidem com palavras comuns do português (ex.: “Brasileira” em
 * “Associação Brasileira…”). No texto livre só batem com badge/local claros.
 */
const MUNICIPIOS_AMBIGUOS_TEXTO_LIVRE = new Set(
  ['Brasileira', 'União', 'Pau D\'Arco do Piauí'].map((n) =>
    normalizeMunicipioNome(n),
  ),
)

function isMunicipioAmbiguoTextoLivre(canon: string): boolean {
  return MUNICIPIOS_AMBIGUOS_TEXTO_LIVRE.has(normalizeMunicipioNome(canon))
}

/** Prefixos de logradouro — nome de município após isso costuma ser rua, não a cidade. */
const LOGRADOURO_PREFIX =
  String.raw`(?:av\.?|avenida|rua|r\.|travessa|trav\.?|alameda|al\.?|rodovia|rod\.?|estrada|est\.?|pra[cç]a|p[cç]\.?|largo|beco|viela|via|boulevard|blvd\.?)`

/**
 * Extrai município de padrões típicos de endereço BR: `Teresina - PI`, `Teresina/PI`.
 * Ignora ocorrências que são só o logradouro (ex.: Av. Prefeito Wall Ferraz).
 */
function municipioFromCidadeUfPattern(haystack: string): string | null {
  if (!haystack.trim()) return null
  const norm = normalizeAgendaText(haystack)
  // Captura trechos `nome - pi` / `nome / pi` (e demais UFs, se vierem).
  const re = /([a-z0-9' ]{3,60}?)\s*[-/]\s*pi\b/g
  let best: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(norm)) !== null) {
    const rawName = (m[1] || '').trim()
    // Descarta se o "nome" for só continuação de logradouro / número.
    const before = norm.slice(Math.max(0, m.index - 24), m.index)
    if (new RegExp(`${LOGRADOURO_PREFIX}\\s+$`).test(before)) continue
    if (/^\d+/.test(rawName)) continue
    const resolved = resolverNomeMunicipioPIOficial(rawName)
    if (resolved) best = resolved
  }
  return best
}

/** Remove trechos de logradouro do texto para não matchar rua com nome de cidade. */
function stripLogradourosFromHaystack(haystack: string): string {
  const norm = normalizeAgendaText(haystack)
  const re = new RegExp(
    `${LOGRADOURO_PREFIX}\\s+[a-z0-9'ºª. ]{2,80?}(?=,|$|\\d{4,}|-)`,
    'g',
  )
  return norm.replace(re, ' ')
}

/**
 * Badge `(Cidade - PI)` / `Cidade - PI` — exige sinal de UF ou nome não ambíguo.
 * Origens tipo `PARA CONHECIMENTO` / `ATENDIMENTO` nunca resolvem município.
 */
function municipioFromOriginTag(origin?: string): string | null {
  if (!origin) return null
  const cleaned = origin.trim()
  if (!cleaned) return null
  const upper = cleaned
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleUpperCase('pt-BR')
  if (
    upper.startsWith('PARA CONHECIMENTO') ||
    upper.startsWith('ATENDIMENTO') ||
    upper === 'BSB' ||
    upper === 'PIAUI' ||
    upper === 'PI'
  ) {
    return null
  }

  const fromPattern = municipioFromCidadeUfPattern(cleaned)
  if (fromPattern) return fromPattern

  const beforeState = cleaned.split(/\s*-\s*/)[0]?.trim()
  if (!beforeState) return null
  const resolved = resolverNomeMunicipioPIOficial(beforeState)
  if (!resolved) return null

  // Ambíguos: só aceitam badge com marcador de estado (Cidade - PI).
  if (isMunicipioAmbiguoTextoLivre(resolved) && !/\s-\s*/.test(cleaned)) {
    return null
  }
  return resolved
}

function municipioFromLocation(location?: string): string | null {
  if (!location?.trim()) return null

  // 1) Padrão canônico de endereço: `…, Teresina - PI, 64035-180`
  const fromUf = municipioFromCidadeUfPattern(location)
  if (fromUf) return fromUf

  // 2) Segmentos do endereço (do fim para o início: cidade costuma vir depois do bairro)
  const parts = location
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i]!
    if (/^\d{5}-?\d{3}$/.test(part)) continue
    if (/^brasil$/i.test(part)) continue
    const fromPartUf = municipioFromCidadeUfPattern(part)
    if (fromPartUf) return fromPartUf
    const resolved = resolverNomeMunicipioPIOficial(part)
    if (!resolved) continue
    if (isMunicipioAmbiguoTextoLivre(resolved)) {
      if (normalizeMunicipioNome(part) !== normalizeMunicipioNome(resolved)) continue
    }
    // Evita “Av. Prefeito Wall Ferraz” como município.
    if (new RegExp(`^${LOGRADOURO_PREFIX}\\b`, 'i').test(part)) continue
    return resolved
  }

  return null
}

function municipioFromTexto(
  haystack: string,
  opts?: { allowAmbiguous?: boolean },
): string | null {
  const fromUf = municipioFromCidadeUfPattern(haystack)
  if (fromUf) return fromUf

  const normHay = stripLogradourosFromHaystack(haystack)
  if (!normHay) return null
  const allowAmbiguous = opts?.allowAmbiguous === true

  for (const canon of municipiosPIPorTamanhoDesc()) {
    const normCanon = normalizeMunicipioNome(canon)
    if (normCanon.length < 4) continue
    if (!allowAmbiguous && isMunicipioAmbiguoTextoLivre(canon)) continue
    const escaped = normCanon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`)
    if (re.test(normHay)) return canon
  }
  return null
}

/**
 * Resolve o nome canônico do município PI a partir do evento do Google Calendar.
 * Ordem: badge `(Cidade - PI)` → location (prioriza `Cidade - PI`) → título/descrição.
 * Cidades ambíguas (ex.: Brasileira) não batem por texto livre; logradouros
 * (ex.: Av. Prefeito Wall Ferraz em Teresina) não viram a cidade Wall Ferraz.
 */
export function resolveMunicipioNomeFromAgendaEvent(
  event: CalendarEventRow,
): string | null {
  const rawSummary = stripEmojisForAgenda(event.summary?.trim() || '')
  const { origin, title } = parseEventOriginFromSummary(rawSummary)
  const haystack = [title, event.description].filter(Boolean).join(' ')

  return (
    municipioFromOriginTag(origin) ||
    municipioFromLocation(event.location) ||
    municipioFromTexto(haystack, { allowAmbiguous: false })
  )
}

export function resolveCampoCityId(
  event: CalendarEventRow,
  cities: CampoCityOption[]
): { city_id: string; cidadeSugerida?: string } {
  const cidadeSugerida = resolveMunicipioNomeFromAgendaEvent(event) ?? undefined

  const cityByNorm = new Map(
    cities.map((c) => [normalizeMunicipioNome(c.name), c] as const)
  )

  if (cidadeSugerida) {
    const city = cityByNorm.get(normalizeMunicipioNome(cidadeSugerida))
    if (city) return { city_id: city.id, cidadeSugerida: city.name }
  }

  return { city_id: '', cidadeSugerida }
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
