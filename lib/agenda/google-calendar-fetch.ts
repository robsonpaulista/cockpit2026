import { google } from 'googleapis'
import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'

export interface GoogleCalendarConfigInput {
  calendarId: string
  serviceAccountEmail?: string | null
  /** Credenciais só no servidor (DB). Env tem prioridade. */
  credentials?: string | Record<string, unknown> | null
  subjectUser?: string | null
}

export type GoogleCalendarPublicConfig = {
  calendarId: string
  serviceAccountEmail: string | null
  subjectUser: string | null
  hasServerCredentials: boolean
}

function formatPrivateKey(key: string): string {
  let formattedKey = key.replace(/\\\\n/g, '\n')
  formattedKey = formattedKey.replace(/\\n/g, '\n')
  return formattedKey
}

function getCredentialsFromStored(bodyCredentials?: string | Record<string, unknown> | null) {
  if (!bodyCredentials) return null
  try {
    const parsed =
      typeof bodyCredentials === 'string' ? JSON.parse(bodyCredentials) : bodyCredentials
    const privateKey = formatPrivateKey(String(parsed.private_key || parsed.privateKey || ''))
    const clientEmail = String(parsed.client_email || parsed.clientEmail || parsed.email || '')
    if (!privateKey || !clientEmail) return null
    return {
      type: 'service_account' as const,
      private_key: privateKey,
      client_email: clientEmail,
      token_uri: String(parsed.token_uri || 'https://oauth2.googleapis.com/token'),
    }
  } catch {
    return null
  }
}

export function getGoogleCalendarCredentialsFromEnv() {
  let envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_CALENDAR_PRIVATE_KEY
  let envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CALENDAR_EMAIL

  if (!envPrivateKey || !envEmail) {
    envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  }

  if (!envPrivateKey || !envEmail) return null

  return {
    type: 'service_account' as const,
    private_key: formatPrivateKey(envPrivateKey),
    client_email: envEmail,
    token_uri: 'https://oauth2.googleapis.com/token',
  }
}

export function hasGoogleCalendarEnvCredentials(): boolean {
  return Boolean(getGoogleCalendarCredentialsFromEnv())
}

/** Env primeiro; fallback só para credenciais já persistidas no servidor (nunca do browser). */
export function resolveGoogleCalendarCredentials(
  storedCredentials?: string | Record<string, unknown> | null,
) {
  return getGoogleCalendarCredentialsFromEnv() ?? getCredentialsFromStored(storedCredentials)
}

export async function fetchGoogleCalendarEvents(
  config: GoogleCalendarConfigInput,
): Promise<CalendarEventRow[]> {
  const credentialsObj = resolveGoogleCalendarCredentials(config.credentials)

  if (!credentialsObj?.client_email || !credentialsObj.private_key) {
    throw new Error(
      'Credenciais do Google Calendar não configuradas. Defina GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY no ambiente.',
    )
  }

  const auth = new google.auth.GoogleAuth({
    credentials: credentialsObj,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })

  const client = await auth.getClient()
  if (config.subjectUser) {
    // @ts-expect-error Domain-Wide Delegation
    client.subject = config.subjectUser
  }

  const calendar = google.calendar({ version: 'v3', auth: client as never })

  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)
  startDate.setDate(startDate.getDate() - 7)

  // Cobre a janela da War Room (próx. visita ~15d) com folga; sem timeMax a
  // API podia truncar em maxResults e deixar compromissos próximos de fora.
  const endDate = new Date()
  endDate.setHours(23, 59, 59, 999)
  endDate.setDate(endDate.getDate() + 45)

  const response = await calendar.events.list({
    calendarId: config.calendarId,
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    maxResults: 2500,
    singleEvents: true,
    orderBy: 'startTime',
  })

  const events = response.data.items || []

  return events.map((event) => ({
    id: event.id || '',
    summary: event.summary || undefined,
    description: event.description || undefined,
    start: event.start
      ? {
          dateTime: event.start.dateTime || undefined,
          date: event.start.date || undefined,
        }
      : undefined,
    end: event.end
      ? {
          dateTime: event.end.dateTime || undefined,
          date: event.end.date || undefined,
        }
      : undefined,
    location: event.location || undefined,
    status: event.status || undefined,
  }))
}

export function toPublicGoogleCalendarConfig(row: {
  calendar_id: string
  service_account_email: string | null
  credentials: unknown
  subject_user: string | null
}): GoogleCalendarPublicConfig {
  const envCreds = getGoogleCalendarCredentialsFromEnv()
  const hasStored = Boolean(row.credentials)
  return {
    calendarId: row.calendar_id,
    serviceAccountEmail: envCreds?.client_email ?? row.service_account_email,
    subjectUser: row.subject_user,
    hasServerCredentials: Boolean(envCreds) || hasStored,
  }
}
