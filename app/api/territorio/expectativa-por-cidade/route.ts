import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type ResumoCidade = {
  expectativaVotos: number
  votacaoFinal2022: number
  liderancas: number
}

type CitySummaryCache = {
  key: string
  expiresAt: number
  summaries: Map<string, ResumoCidade>
}

const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_SCHEMA_VERSION = 'v2-votacao2022-all-rows'
let citySummaryCache: CitySummaryCache | null = null

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

function isLiderancaAtual(value: unknown): boolean {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized === 'SIM' || normalized === 'YES' || normalized === 'TRUE' || normalized === '1'
}

function shouldIncludeRecord(
  liderancaAtualCol: string | undefined,
  expectativaVotosCol: string | undefined,
  rowData: Record<string, unknown>
): boolean {
  if (!liderancaAtualCol && !expectativaVotosCol) return true
  if (liderancaAtualCol && isLiderancaAtual(rowData[liderancaAtualCol])) return true
  if (expectativaVotosCol && normalizeNumber(rowData[expectativaVotosCol]) > 0) return true
  return false
}

function resolveCitySummary(city: string, summaries: Map<string, ResumoCidade>): ResumoCidade {
  const normalizedCity = normalizeCityName(city)
  const exactMatch = summaries.get(normalizedCity)
  if (exactMatch) {
    return {
      expectativaVotos: Number(exactMatch.expectativaVotos || 0),
      votacaoFinal2022: Number(exactMatch.votacaoFinal2022 || 0),
      liderancas: Number(exactMatch.liderancas || 0),
    }
  }

  let fallback: ResumoCidade = { expectativaVotos: 0, votacaoFinal2022: 0, liderancas: 0 }
  for (const [cityKey, summary] of summaries.entries()) {
    if (cityKey.includes(normalizedCity) || normalizedCity.includes(cityKey)) {
      fallback = {
        expectativaVotos: fallback.expectativaVotos + Number(summary.expectativaVotos || 0),
        votacaoFinal2022: fallback.votacaoFinal2022 + Number(summary.votacaoFinal2022 || 0),
        liderancas: fallback.liderancas + Number(summary.liderancas || 0),
      }
    }
  }
  return fallback
}

async function buildCitySummaries(
  spreadsheetId: string,
  sheetName: string,
  range: string | undefined,
  credentialsObj: {
    type: string
    private_key: string
    client_email: string
    token_uri: string
  }
): Promise<Map<string, ResumoCidade>> {
  const cacheKey = `${CACHE_SCHEMA_VERSION}:${spreadsheetId}:${sheetName}:${range || ''}`
  const now = Date.now()

  if (citySummaryCache && citySummaryCache.key === cacheKey && citySummaryCache.expiresAt > now) {
    return citySummaryCache.summaries
  }

  const { google } = await import('googleapis')

  const auth = new google.auth.GoogleAuth({
    credentials: credentialsObj,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const rangeToRead = range ? (sheetName.includes(' ') ? `'${sheetName}'!${range}` : `${sheetName}!${range}`) : sheetName
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeToRead,
  })

  const rows = response.data.values || []
  if (rows.length === 0) {
    const empty = new Map<string, ResumoCidade>()
    citySummaryCache = {
      key: cacheKey,
      expiresAt: now + CACHE_TTL_MS,
      summaries: empty,
    }
    return empty
  }

  const headers = rows[0].map((h: unknown) => String(h || '').trim())
  const cidadeCol = headers.find((h) => /cidade|city|município|municipio/i.test(h)) || headers[1] || 'Coluna 2'
  const expectativaVotosCol = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    if (/jadyel|nome|pessoa|candidato/i.test(normalized)) {
      return false
    }
    return /^expectativa\s+de\s+votos\s+2026$/i.test(h) ||
      /expectativa\s+de\s+votos\s+2026/i.test(h) ||
      (/expectativa.*votos.*2026/i.test(h) && !/jadyel|nome|pessoa|candidato/i.test(h))
  })
  const votacaoFinal2022Col = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    return /votacao\s*final\s*2022|votação\s*final\s*2022|final\s*2022/i.test(normalized)
  })
  const liderancaAtualCol = headers.find((h) => /liderança atual|lideranca atual|atual\?/i.test(h))

  const cidadeIndex = headers.indexOf(cidadeCol)
  const expectativaIndex = expectativaVotosCol ? headers.indexOf(expectativaVotosCol) : -1
  const votacaoFinal2022Index = votacaoFinal2022Col ? headers.indexOf(votacaoFinal2022Col) : -1
  const summaries = new Map<string, ResumoCidade>()

  rows.slice(1).forEach((row: unknown[]) => {
    if (cidadeIndex < 0) return
    const cidadeValue = String(row[cidadeIndex] || '').trim()
    const cidadeValueNormalizada = normalizeCityName(cidadeValue)
    if (!cidadeValueNormalizada) return

    // Votação Final 2022 precisa refletir o histórico completo da cidade,
    // sem depender do filtro de liderança/expectativa.
    const current = summaries.get(cidadeValueNormalizada) || { expectativaVotos: 0, votacaoFinal2022: 0, liderancas: 0 }
    const votacaoFinal2022Valor = votacaoFinal2022Index >= 0 ? normalizeNumber(row[votacaoFinal2022Index]) : 0
    current.votacaoFinal2022 += votacaoFinal2022Valor

    const rowData: Record<string, unknown> = {}
    headers.forEach((header, index) => {
      rowData[header] = row[index] || null
    })
    if (!shouldIncludeRecord(liderancaAtualCol, expectativaVotosCol, rowData)) {
      summaries.set(cidadeValueNormalizada, current)
      return
    }

    const expectativaValor = expectativaIndex >= 0 ? normalizeNumber(row[expectativaIndex]) : 0
    current.expectativaVotos += expectativaValor
    current.liderancas += 1
    summaries.set(cidadeValueNormalizada, current)
  })

  citySummaryCache = {
    key: cacheKey,
    expiresAt: now + CACHE_TTL_MS,
    summaries,
  }

  return summaries
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

    const summariesByCity = await buildCitySummaries(spreadsheetId, sheetName, range, credentialsObj)

    if (summariesByCity.size === 0) {
      return NextResponse.json({
        expectativaVotos: 0,
        votacaoFinal2022: 0,
        liderancas: 0,
        message: 'Planilha vazia',
      })
    }

    const citySummary = resolveCitySummary(cidade, summariesByCity)

    return NextResponse.json({
      cidade,
      expectativaVotos: Math.round(citySummary.expectativaVotos),
      votacaoFinal2022: Math.round(citySummary.votacaoFinal2022),
      liderancas: citySummary.liderancas,
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

export async function GET() {
  try {
    const body: Record<string, unknown> = {}
    const { spreadsheetId, sheetName, range } = getSheetConfig(body)
    const credentialsObj = getCredentials(undefined, 'territorio')

    if (!spreadsheetId || !sheetName || !credentialsObj) {
      return NextResponse.json(
        { error: 'Configuração de planilha/credenciais não disponível para gerar resumo por cidade.' },
        { status: 400 }
      )
    }

    const summariesByCity = await buildCitySummaries(spreadsheetId, sheetName, range, credentialsObj)
    const summariesObject = Object.fromEntries(summariesByCity.entries())

    return NextResponse.json({
      totalCidades: summariesByCity.size,
      summaries: summariesObject,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao processar resumo por cidade'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
