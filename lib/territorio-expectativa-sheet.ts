/**
 * Leitura da planilha de expectativa / lideranças do Território (Google Sheets).
 * Usado pelo endpoint de expectativa por cidade e pela importação em Mobilização.
 */

export type ResumoCidade = {
  expectativaVotos: number
  promessaVotos: number
  expectativaLegadoVotos: number
  votacaoFinal2022: number
  liderancas: number
}

export type LiderancaResumo = {
  nome: string
  cargo: string
  projecaoVotos: number
  projecaoAferida: number
  projecaoPromessa: number
  projecaoLegado: number
}

type CitySummaryCache = {
  key: string
  expiresAt: number
  summaries: Map<string, ResumoCidade>
  leadersByCity: Map<string, LiderancaResumo[]>
}

const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_SCHEMA_VERSION = 'v4-expectativa-promessa-legado-2026'
let citySummaryCache: CitySummaryCache | null = null

function formatPrivateKey(key: string): string {
  let formattedKey = key.replace(/\\\\n/g, '\n')
  formattedKey = formattedKey.replace(/\\n/g, '\n')
  return formattedKey
}

export function getTerritorioExpectativaSheetCredentials(
  bodyCredentials?: string | Record<string, unknown>,
  context: 'territorio' | 'demandas' | 'default' = 'default'
): {
  type: string
  private_key: string
  client_email: string
  token_uri: string
} | null {
  if (bodyCredentials) {
    try {
      const parsed =
        typeof bodyCredentials === 'string' ? JSON.parse(bodyCredentials) : bodyCredentials
      const p = parsed as Record<string, unknown>
      return {
        type: 'service_account',
        private_key: formatPrivateKey(String(p.private_key || p.privateKey || '')),
        client_email: String(p.client_email || p.clientEmail || p.email || ''),
        token_uri: String(p.token_uri || 'https://oauth2.googleapis.com/token'),
      }
    } catch {
      // continuar para variáveis de ambiente
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

export function getTerritorioExpectativaSheetConfig(body: Record<string, unknown>) {
  return {
    spreadsheetId: (body.spreadsheetId as string | undefined) || process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    sheetName: (body.sheetName as string | undefined) || process.env.GOOGLE_SHEETS_NAME || 'Sheet1',
    range: (body.range as string | undefined) || process.env.GOOGLE_SHEETS_RANGE,
  }
}

function normalizeNumber(value: unknown): number {
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
  return Number.isNaN(numValue) ? 0 : numValue
}

/** Mesma chave usada em `leadersByCity` ao agregar por município na planilha. */
export function normalizeTerritorioExpectativaCityKey(city: string): string {
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
  promessaVotosCol: string | undefined,
  expectativaLegadoCol: string | undefined,
  rowData: Record<string, unknown>
): boolean {
  if (!liderancaAtualCol && !expectativaVotosCol && !promessaVotosCol && !expectativaLegadoCol) return true
  if (liderancaAtualCol && isLiderancaAtual(rowData[liderancaAtualCol])) return true
  if (expectativaVotosCol && normalizeNumber(rowData[expectativaVotosCol]) > 0) return true
  if (promessaVotosCol && normalizeNumber(rowData[promessaVotosCol]) > 0) return true
  if (expectativaLegadoCol && normalizeNumber(rowData[expectativaLegadoCol]) > 0) return true
  return false
}

export function resolveCitySummary(city: string, summaries: Map<string, ResumoCidade>): ResumoCidade {
  const normalizedCity = normalizeTerritorioExpectativaCityKey(city)
  const exactMatch = summaries.get(normalizedCity)
  if (exactMatch) {
    return {
      expectativaVotos: Number(exactMatch.expectativaVotos || 0),
      promessaVotos: Number(exactMatch.promessaVotos || 0),
      expectativaLegadoVotos: Number(exactMatch.expectativaLegadoVotos || 0),
      votacaoFinal2022: Number(exactMatch.votacaoFinal2022 || 0),
      liderancas: Number(exactMatch.liderancas || 0),
    }
  }

  let fallback: ResumoCidade = {
    expectativaVotos: 0,
    promessaVotos: 0,
    expectativaLegadoVotos: 0,
    votacaoFinal2022: 0,
    liderancas: 0,
  }
  for (const [cityKey, summary] of summaries.entries()) {
    if (cityKey.includes(normalizedCity) || normalizedCity.includes(cityKey)) {
      fallback = {
        expectativaVotos: fallback.expectativaVotos + Number(summary.expectativaVotos || 0),
        promessaVotos: fallback.promessaVotos + Number(summary.promessaVotos || 0),
        expectativaLegadoVotos: fallback.expectativaLegadoVotos + Number(summary.expectativaLegadoVotos || 0),
        votacaoFinal2022: fallback.votacaoFinal2022 + Number(summary.votacaoFinal2022 || 0),
        liderancas: fallback.liderancas + Number(summary.liderancas || 0),
      }
    }
  }
  return fallback
}

export async function buildCitySummaries(
  spreadsheetId: string,
  sheetName: string,
  range: string | undefined,
  credentialsObj: {
    type: string
    private_key: string
    client_email: string
    token_uri: string
  }
): Promise<{ summaries: Map<string, ResumoCidade>; leadersByCity: Map<string, LiderancaResumo[]> }> {
  const cacheKey = `${CACHE_SCHEMA_VERSION}:${spreadsheetId}:${sheetName}:${range || ''}`
  const now = Date.now()

  if (citySummaryCache && citySummaryCache.key === cacheKey && citySummaryCache.expiresAt > now) {
    return {
      summaries: citySummaryCache.summaries,
      leadersByCity: citySummaryCache.leadersByCity,
    }
  }

  const { google } = await import('googleapis')

  const auth = new google.auth.GoogleAuth({
    credentials: credentialsObj,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const rangeToRead = range
    ? sheetName.includes(' ')
      ? `'${sheetName}'!${range}`
      : `${sheetName}!${range}`
    : sheetName
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeToRead,
  })

  const rows = response.data.values || []
  if (rows.length === 0) {
    const empty = new Map<string, ResumoCidade>()
    const emptyLeaders = new Map<string, LiderancaResumo[]>()
    citySummaryCache = {
      key: cacheKey,
      expiresAt: now + CACHE_TTL_MS,
      summaries: empty,
      leadersByCity: emptyLeaders,
    }
    return { summaries: empty, leadersByCity: emptyLeaders }
  }

  const headers = rows[0].map((h: unknown) => String(h || '').trim())
  const cidadeCol = headers.find((h) => /cidade|city|município|municipio/i.test(h)) || headers[1] || 'Coluna 2'
  const expectativaVotosCol = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    return (
      /expectativa.*jadyel.*2026/i.test(normalized) ||
      /expectativa.*2026.*jadyel/i.test(normalized) ||
      /aferid[oa].*2026/i.test(normalized)
    )
  })
  const promessaVotosCol = headers.find((h) => /promessa.*lideran[cç]a.*2026/i.test(h))
  const expectativaLegadoCol = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    return (
      /^expectativa\s+de\s+votos\s+2026$/i.test(h) ||
      (/expectativa.*votos.*2026/i.test(h) &&
        !/jadyel/i.test(normalized) &&
        !/promessa/i.test(normalized) &&
        !/aferid[oa]/i.test(normalized))
    )
  })
  const votacaoFinal2022Col = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    return /votacao\s*final\s*2022|votação\s*final\s*2022|final\s*2022/i.test(normalized)
  })
  const liderancaAtualCol = headers.find((h) => /liderança atual|lideranca atual|atual\?/i.test(h))
  const nomeCol = headers.find((h) => /nome|name|lider|pessoa/i.test(h)) || headers[0] || 'Coluna 1'
  const cargoCol = (() => {
    const cargo2024 = headers.find((h) => /cargo.*2024/i.test(h))
    if (cargo2024) return cargo2024
    return headers.find((h) => {
      const normalized = h.toLowerCase().trim()
      return (
        /cargo.*atual|cargo/i.test(normalized) &&
        !/cargo.*2020/i.test(normalized) &&
        !/expectativa|votos|telefone|email|whatsapp|contato|endereco|endereço/i.test(normalized)
      )
    })
  })()

  const cidadeIndex = headers.indexOf(cidadeCol)
  const expectativaIndex = expectativaVotosCol ? headers.indexOf(expectativaVotosCol) : -1
  const promessaIndex = promessaVotosCol ? headers.indexOf(promessaVotosCol) : -1
  const expectativaLegadoIndex = expectativaLegadoCol ? headers.indexOf(expectativaLegadoCol) : -1
  const votacaoFinal2022Index = votacaoFinal2022Col ? headers.indexOf(votacaoFinal2022Col) : -1
  const nomeIndex = headers.indexOf(nomeCol)
  const cargoIndex = cargoCol ? headers.indexOf(cargoCol) : -1
  const summaries = new Map<string, ResumoCidade>()
  const leadersAccumulator = new Map<string, Map<string, LiderancaResumo>>()

  rows.slice(1).forEach((row: unknown[]) => {
    if (cidadeIndex < 0) return
    const cidadeValue = String(row[cidadeIndex] || '').trim()
    const cidadeValueNormalizada = normalizeTerritorioExpectativaCityKey(cidadeValue)
    if (!cidadeValueNormalizada) return

    const current = summaries.get(cidadeValueNormalizada) || {
      expectativaVotos: 0,
      promessaVotos: 0,
      expectativaLegadoVotos: 0,
      votacaoFinal2022: 0,
      liderancas: 0,
    }
    const votacaoFinal2022Valor = votacaoFinal2022Index >= 0 ? normalizeNumber(row[votacaoFinal2022Index]) : 0
    current.votacaoFinal2022 += votacaoFinal2022Valor

    const rowData: Record<string, unknown> = {}
    headers.forEach((header, index) => {
      rowData[header] = row[index] || null
    })
    if (!shouldIncludeRecord(liderancaAtualCol, expectativaVotosCol, promessaVotosCol, expectativaLegadoCol, rowData)) {
      summaries.set(cidadeValueNormalizada, current)
      return
    }

    const expectativaValor = expectativaIndex >= 0 ? normalizeNumber(row[expectativaIndex]) : 0
    const promessaValor = promessaIndex >= 0 ? normalizeNumber(row[promessaIndex]) : 0
    const expectativaLegadoValor = expectativaLegadoIndex >= 0 ? normalizeNumber(row[expectativaLegadoIndex]) : 0
    current.expectativaVotos += expectativaValor
    current.promessaVotos += promessaValor
    current.expectativaLegadoVotos += expectativaLegadoValor
    current.liderancas += 1
    summaries.set(cidadeValueNormalizada, current)

    const nome = nomeIndex >= 0 ? String(row[nomeIndex] || '').trim() : ''
    if (!nome) return
    const cargo = cargoIndex >= 0 ? String(row[cargoIndex] || '').trim() : '-'
    const key = `${nome.toUpperCase()}|${cargo.toUpperCase()}`
    const cityLeaders = leadersAccumulator.get(cidadeValueNormalizada) || new Map<string, LiderancaResumo>()
    const leaderCurrent = cityLeaders.get(key) || {
      nome,
      cargo,
      projecaoVotos: 0,
      projecaoAferida: 0,
      projecaoPromessa: 0,
      projecaoLegado: 0,
    }
    leaderCurrent.projecaoAferida += expectativaValor
    leaderCurrent.projecaoPromessa += promessaValor
    leaderCurrent.projecaoLegado += expectativaLegadoValor
    leaderCurrent.projecaoVotos = leaderCurrent.projecaoAferida
    cityLeaders.set(key, leaderCurrent)
    leadersAccumulator.set(cidadeValueNormalizada, cityLeaders)
  })

  const leadersByCity = new Map<string, LiderancaResumo[]>()
  leadersAccumulator.forEach((cityMap, cityKey) => {
    leadersByCity.set(
      cityKey,
      Array.from(cityMap.values()).sort(
        (a, b) => b.projecaoAferida - a.projecaoAferida || a.nome.localeCompare(b.nome, 'pt-BR')
      )
    )
  })

  citySummaryCache = {
    key: cacheKey,
    expiresAt: now + CACHE_TTL_MS,
    summaries,
    leadersByCity,
  }

  return { summaries, leadersByCity }
}

export function resolveCityLeaders(city: string, leadersByCity: Map<string, LiderancaResumo[]>): LiderancaResumo[] {
  const normalizedCity = normalizeTerritorioExpectativaCityKey(city)
  const exact = leadersByCity.get(normalizedCity)
  if (exact) return exact

  const merged = new Map<string, LiderancaResumo>()
  for (const [cityKey, leaders] of leadersByCity.entries()) {
    if (!(cityKey.includes(normalizedCity) || normalizedCity.includes(cityKey))) continue
    for (const leader of leaders) {
      const key = `${leader.nome.toUpperCase()}|${leader.cargo.toUpperCase()}`
      const current = merged.get(key) || {
        nome: leader.nome,
        cargo: leader.cargo,
        projecaoVotos: 0,
        projecaoAferida: 0,
        projecaoPromessa: 0,
        projecaoLegado: 0,
      }
      current.projecaoAferida += Number(leader.projecaoAferida || 0)
      current.projecaoPromessa += Number(leader.projecaoPromessa || 0)
      current.projecaoLegado += Number(leader.projecaoLegado || 0)
      current.projecaoVotos = current.projecaoAferida
      merged.set(key, current)
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => b.projecaoAferida - a.projecaoAferida || a.nome.localeCompare(b.nome, 'pt-BR')
  )
}
