import { NextResponse } from 'next/server'
import { google } from 'googleapis'

// Função auxiliar para formatar a chave privada
function formatPrivateKey(key: string): string {
  let formattedKey = key.replace(/\\\\n/g, '\n')
  formattedKey = formattedKey.replace(/\\n/g, '\n')
  return formattedKey
}

// Função auxiliar para obter credenciais
function getCredentials(bodyCredentials?: string) {
  // Prioridade 1: Credenciais do body
  if (bodyCredentials) {
    try {
      const parsed = typeof bodyCredentials === 'string' 
        ? JSON.parse(bodyCredentials) 
        : bodyCredentials
      return {
        type: 'service_account' as const,
        private_key: formatPrivateKey(parsed.private_key || parsed.privateKey),
        client_email: parsed.client_email || parsed.clientEmail || parsed.email,
        token_uri: parsed.token_uri || 'https://oauth2.googleapis.com/token',
      }
    } catch (e) {
      console.error('Erro ao parsear credenciais do body:', e)
    }
  }

  // Prioridade 2: Variáveis de ambiente específicas para Calendar
  let envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_CALENDAR_PRIVATE_KEY
  let envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CALENDAR_EMAIL

  // Prioridade 3: Variáveis genéricas (fallback)
  if (!envPrivateKey || !envEmail) {
    envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  }

  if (envPrivateKey && envEmail) {
    return {
      type: 'service_account' as const,
      private_key: formatPrivateKey(envPrivateKey),
      client_email: envEmail,
      token_uri: 'https://oauth2.googleapis.com/token',
    }
  }

  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { calendarId, serviceAccountEmail, credentials, subjectUser } = body

    if (!calendarId) {
      return NextResponse.json(
        { error: 'calendarId é obrigatório' },
        { status: 400 }
      )
    }

    const credentialsObj = credentials 
      ? (typeof credentials === 'string' ? JSON.parse(credentials) : credentials)
      : getCredentials()

    if (!credentialsObj) {
      return NextResponse.json(
        { error: 'Credenciais não encontradas. Configure as credenciais ou envie no corpo da requisição.' },
        { status: 400 }
      )
    }

    // Autenticar usando Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: credentialsObj,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    })

    // Obter cliente e configurar Domain-Wide Delegation se subjectUser for fornecido
    const client = await auth.getClient()
    
    // ✅ ESSENCIAL: impersonar o usuário (Domain-Wide Delegation)
    // Se subjectUser for fornecido, usar Domain-Wide Delegation
    if (subjectUser) {
      // @ts-ignore - subject é uma propriedade válida para Domain-Wide Delegation
      client.subject = subjectUser
    }

    const calendar = google.calendar({ version: 'v3', auth: client as any })

    // Buscar eventos (próximos 50 eventos)
    const now = new Date()
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: now.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = response.data.items || []

    return NextResponse.json({
      events: events.map((event: any) => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        location: event.location,
        attendees: event.attendees,
        status: event.status,
      })),
      total: events.length,
    })
  } catch (error: any) {
    console.error('Erro ao buscar eventos do Google Calendar:', error)
    
    if (error.code === 403) {
      return NextResponse.json(
        { error: 'Acesso negado. Verifique se o Domain-Wide Delegation foi configurado corretamente no Admin Console do Workspace e se o email do usuário real está correto.' },
        { status: 403 }
      )
    }
    
    if (error.code === 404) {
      return NextResponse.json(
        { error: 'Calendário não encontrado. Verifique o ID do calendário.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao conectar com Google Calendar' },
      { status: 500 }
    )
  }
}
