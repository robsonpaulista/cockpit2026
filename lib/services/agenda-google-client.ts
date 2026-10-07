import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import type { CampoAgendaType, CampoCityOption } from '@/lib/agenda/calendar-to-campo'

export interface AgendaCalendarConfig {
  calendarId: string
  serviceAccountEmail: string
  subjectUser?: string
  hasServerCredentials?: boolean
}

export interface AgendaCalendarConfigInput {
  calendarId: string
  serviceAccountEmail: string
  credentials?: string
  subjectUser?: string
}

export interface AgendaEvento extends CalendarEventRow {
  attendees?: Array<{ email: string; displayName?: string }>
}

export interface CampoGoogleLink {
  id: string
  date: string
  status: string
  type: string
}

export interface CampoSyncResult {
  synced: boolean
  agendaId?: string
  reason?: string
}

type ConfigResponse = {
  config?: {
    calendarId?: string
    serviceAccountEmail?: string
    subjectUser?: string
    hasServerCredentials?: boolean
  } | null
  error?: string
}

function erroDe(data: { error?: string }, padrao: string): Error {
  return new Error(data.error || padrao)
}

function paraConfig(
  data: ConfigResponse['config'],
  fallback?: AgendaCalendarConfigInput,
): AgendaCalendarConfig | null {
  const calendarId = data?.calendarId || fallback?.calendarId
  if (!calendarId) return null
  return {
    calendarId,
    serviceAccountEmail: data?.serviceAccountEmail || fallback?.serviceAccountEmail || '',
    subjectUser: data?.subjectUser || fallback?.subjectUser || undefined,
    hasServerCredentials: Boolean(data?.hasServerCredentials),
  }
}

export async function fetchAgendaCalendarConfig(): Promise<AgendaCalendarConfig | null> {
  const res = await fetch('/api/agenda/google-calendar-config')
  if (!res.ok) return null
  const data = (await res.json()) as ConfigResponse
  return paraConfig(data.config)
}

/** Só admin salva; o servidor responde 403 para os demais. */
export async function saveAgendaCalendarConfig(input: AgendaCalendarConfigInput): Promise<AgendaCalendarConfig> {
  const res = await fetch('/api/agenda/google-calendar-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as ConfigResponse
  if (!res.ok) throw erroDe(data, 'Erro ao salvar configuração. Apenas admin pode alterar.')
  const config = paraConfig(data.config, input)
  if (!config) throw new Error('Resposta sem calendário configurado.')
  return config
}

export async function testAgendaCalendarConnection(calendarId: string, subjectUser: string): Promise<number> {
  const res = await fetch('/api/agenda/google-calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calendarId, subjectUser }),
  })
  const data = (await res.json()) as { events?: unknown[]; total?: number; error?: string }
  if (!res.ok) throw erroDe(data, 'Falha no teste')
  return data.events?.length ?? data.total ?? 0
}

export async function fetchAgendaEventos(): Promise<AgendaEvento[]> {
  const res = await fetch('/api/agenda/events', { cache: 'no-store' })
  const data = (await res.json()) as { events?: AgendaEvento[]; error?: string }
  if (!res.ok) throw erroDe(data, 'Erro ao buscar eventos')
  return data.events ?? []
}

export async function saveAgendaAtendimento(eventId: string, attended: boolean): Promise<void> {
  const res = await fetch('/api/agenda/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, attended }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw erroDe(data, 'Erro ao salvar atendimento')
  }
}

export async function confirmAgendaChegada(eventId: string): Promise<CampoSyncResult | undefined> {
  const res = await fetch('/api/agenda/attendance/confirm-arrival', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId }),
  })
  const data = (await res.json().catch(() => ({}))) as { campoSync?: CampoSyncResult; error?: string }
  if (!res.ok) throw erroDe(data, 'Erro ao confirmar chegada')
  return data.campoSync
}

/** Vazio quando a coluna google_event_id ainda não existe no banco. */
export async function fetchCampoGoogleLinks(): Promise<Record<string, CampoGoogleLink>> {
  try {
    const res = await fetch('/api/campo/agendas/google-links')
    if (!res.ok) return {}
    const data = (await res.json()) as { links?: Record<string, CampoGoogleLink> }
    return data.links ?? {}
  } catch {
    return {}
  }
}

export async function fetchCampoCidades(): Promise<CampoCityOption[]> {
  const res = await fetch('/api/campo/cities')
  if (!res.ok) return []
  return (await res.json()) as CampoCityOption[]
}

export interface NovaVisitaCampo {
  date: string
  type: CampoAgendaType
  description: string
  googleEventId: string
  cityId?: string
  horaEvento?: string
}

/** Devolve o id da visita criada, ou o da já existente para o mesmo compromisso. */
export async function createCampoVisitaFromEvento(visita: NovaVisitaCampo): Promise<string> {
  const payload: Record<string, string> = {
    date: visita.date,
    type: visita.type,
    description: visita.description,
    google_event_id: visita.googleEventId,
  }
  if (visita.cityId) payload.city_id = visita.cityId
  if (visita.horaEvento) payload.hora_evento = `${visita.horaEvento}:00`

  const res = await fetch('/api/campo/agendas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await res.json()) as { id?: string; error?: string; existingId?: string }
  if (res.status === 409 && data.existingId) return data.existingId
  if (!res.ok || !data.id) throw erroDe(data, 'Erro ao registrar visita')
  return data.id
}
