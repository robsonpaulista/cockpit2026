import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

interface ResultadoEleicao {
  uf: string
  municipio: string
  codigoCargo: string
  cargo: string
  numeroUrna: string
  nomeCandidato: string
  nomeUrnaCandidato: string
  partido: string
  coligacao: string
  turno: string
  situacao: string
  dataUltimaTotalizacao: string
  ue: string
  sequencialCandidato: string
  tipoDestinacaoVotos: string
  sequencialEleicao: string
  anoEleicao: string
  regiao: string
  percentualVotosValidos: string
  quantidadeVotosNominais: string
  quantidadeVotosConcorrentes: string
}

const CACHE_TTL_MS = 10 * 60 * 1000

// Credenciais copiadas da origem, com prioridade para variáveis de ambiente.
const FALLBACK_SHEET_ID = '1BNy6milP3bS_C2rOULMLHwLez9imCy_WUFkOhKvKW34'
const FALLBACK_SHEET_NAME = 'votacao_candidato-municipio_202'
const FALLBACK_CLIENT_EMAIL = 'eleicoes20222024@eleicoes20222024.iam.gserviceaccount.com'
const FALLBACK_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCNdLKXRSs+6CvZ
VghNKg5KGg2n68KBZiVtCW548Oh57QO/WN0d/UA49LNiAuEzvE2OQC+EfusVlYfV
YB/wK103RVUwheml5X8nmjyKv4ktr3+atcAGITpB11owjIUSstwggfyg0T7zX07D
YHnfebN2xgvRHqahwR3J2uq6C4ml0vyhTXU0rHwYRXYEPtj9d9H9To4YhNdIh8hN
PAFLqCFS/id31D816brZ5D2SaGLWbQ2X4lWlXGGW28SJggZx9+4J/mvbHEcGVoqF
USyRWPhJGPG60RJm2omfxm6sWXVvH0opGE/CnRqbRbn1ELyMwAcSX36/8r7EIDeY
PEG3Br7JAgMBAAECggEACDxEj4ED6QgsUV1sY02xAkhtBhs4Oj9fq27yoxDnf/24
C6JZUT8mx4objXe8c74hR8hd29llx15qx5XulhV4OlkLgiUxuqpXUk9s+ej3zBSd
Gb0+Hj09/opSomPz9Wg7X5shwZ0dDJ8+XyqVPdkAhUg3dOfTbLRpDxDzPHyieWhu
iRQlnOwWT6tWfXLJpUA7Af6FfvQe/G181g0SlcxQ2jFBVDnuYsWR3TK5+mOVGaHo
ssELTlMqCPL06sROmPW8BWl9yaobW6GECDVZZJRinYjvHU5j94p2iIgcF80wIR1o
6ukxQ6FCKZ3FroufUWOPH78Nq2cwea/HfxMfnHNX+QKBgQDDyhvHDTmSwH7s5ESu
wrciozCws+bPgkP5r8yVysw1Pd8NSbMeO9IpqBbPbNl0EztjoXGQzbas0HAtOXmF
S81gUgpgpUlEM0EPNBuveDLes2TamkEg6D6fhADFRgBMOKiCNiWYCLlZp6xndHkn
3F6Qfdp9PaK5NawzrQ+J8IUb3QKBgQC49RKRqvDu7ZaNXcC5vhlVVE+dwV4xmtKi
VHE47C8K4OGKmUMjaYoWuokVGq9XFJRN9v6aaep0QYGS1fkMWk9jzt2FJP2UxfEa
/NhjThn56+IkD3Ppt1ej/q1MRzskBrCdUoRm9Lrww9TzEoC17wWcEMz4fNqUnFu2
+IS71GXl3QKBgGCR3pOWlVAp/DDSAoKEbhn6jfiKM40kfmy4Zlt31LNqGguOz3dZ
IDcFvoJ++N7E4aUpqz82CCVDBiF4WNUDZ4Bb1tyGihXGhg9+ry0kR0sLBvK/5OHb
S5AYZtzmwxzVUWAwXuiXXPy4tFOu4ldj3Yy9VrgxX4Kk05QFh0WNScpNAoGBAJr0
Z1w29KeX0XwaQa7bvumoOxOVv06bwUBSspDX/wmEIjE1+fOfJhuop9RQiPnRufYf
qmq/tbc0clQMhBx/ROf/lcNInFKaC0dq8fcwpb6mis1fTONPwVMZuSKgwsGKAUms
qlR/UGcKCkyjAcZqvC5mPPMp1w6OeKAwUTPz3HLZAoGAGn1+kBwPrDOKQ9aCB3gw
/VSHntkoJTUXFOG2ZjzbSQQ8qwzXXiuN3MlPhEeHku6SRh3Kkgqlh4awE6huNuGR
IjgHAL9s5EAHh+KRc+fk9tnM8SStHUqWe4DrEsOtCGoPf2mE7/DXfqHWdFFlPmMQ
z5Zub5I9f2f2pFtVx+FZ+6c=
-----END PRIVATE KEY-----`

let cacheUpdatedAt = 0
let cachedCityIndex: Map<string, ResultadoEleicao[]> | null = null
let cachedCityNames: string[] = []
let cachedCityDisplayByKey: Map<string, string> = new Map()

function normalizeCity(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

function sanitizeEnvValue(value: string): string {
  let sanitized = value.trim()
  if (
    (sanitized.startsWith('"') && sanitized.endsWith('"')) ||
    (sanitized.startsWith("'") && sanitized.endsWith("'"))
  ) {
    sanitized = sanitized.slice(1, -1).trim()
  }
  sanitized = sanitized.replace(/,\s*$/, '')
  return sanitized
}

function formatPrivateKey(key: string): string {
  let formatted = sanitizeEnvValue(key)
  // Suporta "\\n" e "\n" vindos do .env
  formatted = formatted.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
  // Garante cabeçalho/rodapé em linhas próprias
  formatted = formatted
    .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
    .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return formatted
}

function toResultado(row: string[]): ResultadoEleicao {
  return {
    uf: row[0] || '',
    municipio: row[1] || '',
    codigoCargo: row[2] || '',
    cargo: row[3] || '',
    numeroUrna: row[4] || '',
    nomeCandidato: row[5] || '',
    nomeUrnaCandidato: row[6] || '',
    partido: row[7] || '',
    coligacao: row[8] || '',
    turno: row[9] || '',
    situacao: row[10] || '',
    dataUltimaTotalizacao: row[11] || '',
    ue: row[12] || '',
    sequencialCandidato: row[13] || '',
    tipoDestinacaoVotos: row[14] || '',
    sequencialEleicao: row[15] || '',
    anoEleicao: row[16] || '',
    regiao: row[17] || '',
    percentualVotosValidos: row[18] || '',
    quantidadeVotosNominais: row[19] || '',
    quantidadeVotosConcorrentes: row[20] || '',
  }
}

async function buildCityIndex(forceRefresh = false): Promise<void> {
  const cacheValid = cachedCityIndex && Date.now() - cacheUpdatedAt < CACHE_TTL_MS
  if (cacheValid && !forceRefresh) {
    return
  }

  const credentialCandidates: Array<{ email?: string; privateKey?: string; isFallback?: boolean }> = [
    {
      email: process.env.GOOGLE_SERVICE_ACCOUNT_ELEICOES_EMAIL,
      privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_ELEICOES_PRIVATE_KEY,
    },
    {
      email: process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_EMAIL,
      privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_PRIVATE_KEY,
    },
    {
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    },
    {
      email: FALLBACK_CLIENT_EMAIL,
      privateKey: FALLBACK_PRIVATE_KEY,
      isFallback: true,
    },
  ]

  const spreadsheetId = sanitizeEnvValue(
    process.env.GOOGLE_SHEETS_ELEICOES_SPREADSHEET_ID || FALLBACK_SHEET_ID
  )
  const sheetName = sanitizeEnvValue(process.env.GOOGLE_SHEETS_ELEICOES_NAME || FALLBACK_SHEET_NAME)

  const readSheet = async (clientEmail: string, keyToUse: string) => {
    const auth = new google.auth.JWT(
      clientEmail,
      undefined,
      keyToUse,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
    const sheets = google.sheets({ version: 'v4', auth })
    return sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:U`,
    })
  }

  let response: Awaited<ReturnType<typeof readSheet>> | null = null
  let lastError: unknown = null

  for (const candidate of credentialCandidates) {
    if (!candidate.email || !candidate.privateKey) continue
    const email = sanitizeEnvValue(candidate.email)
    const privateKey = candidate.isFallback ? candidate.privateKey.trim() : formatPrivateKey(candidate.privateKey)

    try {
      response = await readSheet(email, privateKey)
      break
    } catch (error) {
      lastError = error
    }
  }

  if (!response) {
    throw lastError || new Error('Nenhuma credencial válida conseguiu autenticar no Google Sheets')
  }

  const values = response.data.values || []
  const dataRows = values.slice(1)

  const cityIndex = new Map<string, ResultadoEleicao[]>()
  const cityDisplayByKey = new Map<string, string>()

  for (const row of dataRows) {
    const resultado = toResultado(row)
    const key = normalizeCity(resultado.municipio)
    if (!key) continue

    if (!cityIndex.has(key)) {
      cityIndex.set(key, [])
      cityDisplayByKey.set(key, resultado.municipio)
    }

    cityIndex.get(key)?.push(resultado)
  }

  cachedCityIndex = cityIndex
  cachedCityDisplayByKey = cityDisplayByKey
  cachedCityNames = Array.from(cityDisplayByKey.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  cacheUpdatedAt = Date.now()
}

export async function GET(request: NextRequest) {
  try {
    const cidade = request.nextUrl.searchParams.get('cidade')
    const refresh = request.nextUrl.searchParams.get('refresh') === 'true'

    await buildCityIndex(refresh)

    if (!cachedCityIndex) {
      return NextResponse.json({ error: 'Falha ao carregar dados da planilha.' }, { status: 500 })
    }

    if (!cidade) {
      return NextResponse.json({
        cidades: cachedCityNames,
        totalCidades: cachedCityNames.length,
        cache: {
          updatedAt: cacheUpdatedAt,
          ttlMs: CACHE_TTL_MS,
        },
      })
    }

    const cityKey = normalizeCity(cidade)
    const resultados = cachedCityIndex.get(cityKey) || []
    const cityName = cachedCityDisplayByKey.get(cityKey) || cidade

    return NextResponse.json({
      cidade: cityName,
      total: resultados.length,
      resultados,
      cache: {
        updatedAt: cacheUpdatedAt,
        ttlMs: CACHE_TTL_MS,
      },
    })
  } catch (error) {
    console.error('Erro ao buscar resumo de eleições:', error)
    return NextResponse.json(
      { error: 'Erro ao consultar dados de eleições. Verifique credenciais e planilha.' },
      { status: 500 }
    )
  }
}
