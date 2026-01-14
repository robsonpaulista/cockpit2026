import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Função auxiliar para formatar a chave privada
function formatPrivateKey(key: string): string {
  let formattedKey = key.replace(/\\\\n/g, '\n')
  formattedKey = formattedKey.replace(/\\n/g, '\n')
  return formattedKey
}

// Função auxiliar para obter credenciais (prioriza variáveis de ambiente)
function getCredentials(bodyCredentials?: string, context: 'territorio' | 'demandas' | 'default' = 'default') {
  if (bodyCredentials) {
    try {
      const parsed = typeof bodyCredentials === 'string' 
        ? JSON.parse(bodyCredentials) 
        : bodyCredentials
      return {
        type: 'service_account',
        private_key: formatPrivateKey(parsed.private_key || parsed.privateKey),
        client_email: parsed.client_email || parsed.clientEmail || parsed.email,
        token_uri: parsed.token_uri || 'https://oauth2.googleapis.com/token',
      }
    } catch (e) {
      // Se falhar, continuar para variáveis de ambiente
    }
  }

  let envPrivateKey: string | undefined
  let envEmail: string | undefined

  if (context === 'territorio') {
    envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_PRIVATE_KEY
    envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_EMAIL
  } else if (context === 'demandas') {
    envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_DEMANDAS_PRIVATE_KEY
    envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_DEMANDAS_EMAIL
  }

  if (!envPrivateKey || !envEmail) {
    envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  }

  if (envPrivateKey && envEmail) {
    return {
      type: 'service_account',
      private_key: formatPrivateKey(envPrivateKey),
      client_email: envEmail,
      token_uri: 'https://oauth2.googleapis.com/token',
    }
  }

  return null
}

// Função auxiliar para obter configuração da planilha
function getSheetConfig(body: any) {
  return {
    spreadsheetId: body.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    sheetName: body.sheetName || process.env.GOOGLE_SHEETS_NAME || 'Sheet1',
    range: body.range || process.env.GOOGLE_SHEETS_RANGE,
  }
}

// Função para normalizar números (mesma lógica da página território)
function normalizeNumber(value: any): number {
  if (typeof value === 'number') return value
  
  const str = String(value).trim()
  if (!str) return 0
  
  let cleaned = str.replace(/[^\d.,]/g, '')
  
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts.length === 2) {
      if (parts[1].length === 3) {
        cleaned = cleaned.replace(/,/g, '')
      } else if (parts[1].length <= 2) {
        cleaned = cleaned.replace(',', '.')
      } else {
        cleaned = cleaned.replace(/,/g, '')
      }
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  }
  
  const numValue = parseFloat(cleaned)
  return isNaN(numValue) ? 0 : numValue
}

// Normalizar nome da cidade para comparação
function normalizeCityName(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { spreadsheetId: bodySpreadsheetId, sheetName: bodySheetName, range, serviceAccountEmail, credentials, cidade } = body

    if (!cidade) {
      return NextResponse.json(
        { error: 'cidade é obrigatória' },
        { status: 400 }
      )
    }

    // Obter configuração (prioriza body, depois variáveis de ambiente)
    const { spreadsheetId, sheetName } = getSheetConfig(body)

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json(
        { error: 'spreadsheet_id e sheet_name são obrigatórios. Configure nas variáveis de ambiente ou envie no corpo da requisição.' },
        { status: 400 }
      )
    }

    // Obter credenciais (prioriza body, depois variáveis de ambiente)
    const credentialsObj = getCredentials(credentials, 'territorio')

    if (!credentialsObj) {
      return NextResponse.json(
        { error: 'Credenciais não encontradas. Configure GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY e GOOGLE_SERVICE_ACCOUNT_EMAIL nas variáveis de ambiente ou envie no corpo da requisição.' },
        { status: 400 }
      )
    }

    // Importar googleapis dinamicamente
    const { google } = await import('googleapis')

    // Autenticar usando Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: credentialsObj,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Construir range - aspas simples só são necessárias quando há range de células
    const rangeToRead = range 
      ? (sheetName.includes(' ') ? `'${sheetName}'!${range}` : `${sheetName}!${range}`)
      : sheetName

    // Buscar dados
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeToRead,
    })

    const rows = response.data.values || []

    if (rows.length === 0) {
      return NextResponse.json({
        expectativaVotos: 0,
        message: 'Planilha vazia',
      })
    }

    // Primeira linha são os cabeçalhos
    const headers = rows[0].map((h: any) => String(h || '').trim())

    // Encontrar colunas
    const cidadeCol = headers.find((h) =>
      /cidade|city|município|municipio/i.test(h)
    ) || headers[1] || 'Coluna 2'

    const expectativaVotosCol = headers.find((h) => {
      const normalized = h.toLowerCase().trim()
      if (/jadyel|nome|pessoa|candidato/i.test(normalized)) {
        return false
      }
      return /^expectativa\s+de\s+votos\s+2026$/i.test(h) || 
             /expectativa\s+de\s+votos\s+2026/i.test(h) ||
             (/expectativa.*votos.*2026/i.test(h) && !/jadyel|nome|pessoa|candidato/i.test(h))
    })

    if (!cidadeCol || !expectativaVotosCol) {
      return NextResponse.json({
        expectativaVotos: 0,
        message: 'Colunas necessárias não encontradas',
      })
    }

    // Normalizar nome da cidade buscada
    const cidadeNormalizada = normalizeCityName(cidade)

    // Buscar expectativa de votos para a cidade
    let expectativaVotos = 0
    const records = rows.slice(1)
    
    records.forEach((row: any[]) => {
      const cidadeIndex = headers.indexOf(cidadeCol)
      const expectativaIndex = headers.indexOf(expectativaVotosCol)
      
      if (cidadeIndex >= 0 && expectativaIndex >= 0) {
        const cidadeValue = String(row[cidadeIndex] || '').trim()
        const cidadeValueNormalizada = normalizeCityName(cidadeValue)
        
        // Comparar cidades normalizadas
        if (cidadeValueNormalizada === cidadeNormalizada || 
            cidadeValueNormalizada.includes(cidadeNormalizada) || 
            cidadeNormalizada.includes(cidadeValueNormalizada)) {
          const value = row[expectativaIndex]
          expectativaVotos += normalizeNumber(value)
        }
      }
    })

    return NextResponse.json({
      cidade,
      expectativaVotos: Math.round(expectativaVotos),
    })
  } catch (error: any) {
    console.error('Erro ao buscar expectativa de votos por cidade:', error)
    
    if (error.code === 403) {
      return NextResponse.json(
        { error: 'Acesso negado. Verifique se a planilha foi compartilhada com o email do Service Account.' },
        { status: 403 }
      )
    }
    
    if (error.code === 404) {
      return NextResponse.json(
        { error: 'Planilha não encontrada. Verifique o ID da planilha.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao processar dados da planilha' },
      { status: 500 }
    )
  }
}
