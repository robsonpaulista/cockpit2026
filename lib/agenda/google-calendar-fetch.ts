import { google } from 'googleapis'
import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'

export interface GoogleCalendarConfigInput {
  calendarId: string
  serviceAccountEmail?: string
  credentials: string | Record<string, unknown>
  subjectUser?: string | null
}

function formatPrivateKey(key: string): string {
  let formattedKey = key.replace(/\\\\n/g, '\n')
  formattedKey = formattedKey.replace(/\\n/g, '\n')
  return formattedKey
}

function getCredentialsFromBody(bodyCredentials?: string | Record<string, unknown>) {
  if (!bodyCredentials) return null
  try {
    const parsed =
      typeof bodyCredentials === 'string' ? JSON.parse(bodyCredentials) : bodyCredentials
    return {
      type: 'service_account' as const,
      private_key: formatPrivateKey(String(parsed.private_key || parsed.privateKey || '')),
      client_email: String(parsed.client_email || parsed.clientEmail || parsed.email || ''),
      token_uri: String(parsed.token_uri || 'https://oauth2.googleapis.com/token'),
    }
  } catch {
    return null
  }
}

function getCredentialsFromEnv() {
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

export async function fetchGoogleCalendarEvents(
  config: GoogleCalendarConfigInput
): Promise<CalendarEventRow[]> {
  const credentialsObj =
    getCredentialsFromBody(config.credentials) ?? getCredentialsFromEnv()

  if (!credentialsObj?.client_email || !credentialsObj.private_key) {
    throw new Error('Credenciais do Google Calendar não configuradas.')
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

  const response = await calendar.events.list({
    calendarId: config.calendarId,
    timeMin: startDate.toISOString(),
    maxResults: 500,
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
