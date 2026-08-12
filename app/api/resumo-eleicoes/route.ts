import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { candidatoEleicaoIndicaPerfilMilitar } from '@/lib/perfil-militar-nome'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  getTerritorioDesenvolvimentoPI,
  getMunicipiosPorTerritorioDesenvolvimentoPI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import { agregarResultadosEleicao } from '@/lib/resumo-eleicoes-aggregate'

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

/** IDs públicos da planilha no domínio da equipe (não são a chave de autenticação). */
const FALLBACK_SHEET_ID = '1BNy6milP3bS_C2rOULMLHwLez9imCy_WUFkOhKvKW34'
const FALLBACK_SHEET_NAME = 'votacao_candidato-municipio_202'

let cacheUpdatedAt = 0
let cachedCityIndex: Map<string, ResultadoEleicao[]> | null = null
let cachedCityNames: string[] = []
let cachedCityDisplayByKey: Map<string, string> = new Map()
let cachedAllResultados: ResultadoEleicao[] = []

function normalizeCity(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

/** Alinhado ao histórico federal: comparar nome de urna / civil na planilha. */
function normalizeCandidatoMatch(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
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
  // Só injeta newline se o PEM ainda estiver em linha única — linha em branco
  // antes do END quebra OpenSSL (DECODER routines::unsupported).
  if (!formatted.includes('-----BEGIN PRIVATE KEY-----\n')) {
    formatted = formatted.replace(
      '-----BEGIN PRIVATE KEY-----',
      '-----BEGIN PRIVATE KEY-----\n'
    )
  }
  if (!formatted.includes('\n-----END PRIVATE KEY-----')) {
    formatted = formatted.replace(
      '-----END PRIVATE KEY-----',
      '\n-----END PRIVATE KEY-----'
    )
  }
  return formatted.trim()
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

  const credentialCandidates: Array<{ email?: string; privateKey?: string }> = [
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
  let triedAny = false

  for (const candidate of credentialCandidates) {
    if (!candidate.email || !candidate.privateKey) continue
    triedAny = true
    const email = sanitizeEnvValue(candidate.email)
    const privateKey = formatPrivateKey(candidate.privateKey)

    try {
      response = await readSheet(email, privateKey)
      break
    } catch (error) {
      lastError = error
    }
  }

  if (!triedAny) {
    throw new Error(
      'Credenciais Google ausentes. Defina GOOGLE_SERVICE_ACCOUNT_ELEICOES_EMAIL e GOOGLE_SERVICE_ACCOUNT_ELEICOES_PRIVATE_KEY (ou GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) no ambiente.',
    )
  }

  if (!response) {
    throw lastError || new Error('Nenhuma credencial válida conseguiu autenticar no Google Sheets')
  }

  const values = response.data.values || []
  const dataRows = values.slice(1)

  const cityIndex = new Map<string, ResultadoEleicao[]>()
  const cityDisplayByKey = new Map<string, string>()
  const allResultados: ResultadoEleicao[] = []

  for (const row of dataRows) {
    const resultado = toResultado(row)
    allResultados.push(resultado)
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
  cachedAllResultados = allResultados
  cacheUpdatedAt = Date.now()
}

export async function GET(request: NextRequest) {
  try {
    const cidade = request.nextUrl.searchParams.get('cidade')
    const totals = request.nextUrl.searchParams.get('totals')
    const aggregado = request.nextUrl.searchParams.get('aggregado') === 'true'
    const refresh = request.nextUrl.searchParams.get('refresh') === 'true'

    await buildCityIndex(refresh)

    if (!cachedCityIndex) {
      return NextResponse.json({ error: 'Falha ao carregar dados da planilha.' }, { status: 500 })
    }

    if (aggregado) {
      const resultados = agregarResultadosEleicao(cachedAllResultados)
      return NextResponse.json({
        agregado: true,
        total: resultados.length,
        resultados,
        cache: {
          updatedAt: cacheUpdatedAt,
          ttlMs: CACHE_TTL_MS,
        },
      })
    }

    if (totals === 'federal2022') {
      const grouped = new Map<string, { nome: string; votos: number; partido: string | null }>()
      for (const item of cachedAllResultados) {
        if (item.anoEleicao !== '2022') continue
        if (!/federal/i.test(item.cargo || '')) continue
        const nome = String(item.nomeUrnaCandidato || '').trim()
        if (!nome) continue
        const atual = grouped.get(nome) || { nome, votos: 0, partido: item.partido || null }
        const votos = Number.parseInt(item.quantidadeVotosNominais || '0', 10)
        atual.votos += Number.isNaN(votos) ? 0 : votos
        grouped.set(nome, atual)
      }

      const rows = Array.from(grouped.values()).sort(
        (a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, 'pt-BR')
      )
      return NextResponse.json({
        ano: 2022,
        cargo: 'deputado_federal',
        totalCandidatos: rows.length,
        rows,
      })
    }

    /**
     * Média por TD: top N deputados federais 2022 com mais votos **dentro do território** (soma nos municípios do TD),
     * independente do ranking estadual no PI. `top`: padrão 5; min 1; max 20.
     */
    if (totals === 'federal2022TopMediaPorTd') {
      const topParam = Number.parseInt(request.nextUrl.searchParams.get('top') || '5', 10)
      const top = Number.isFinite(topParam) ? Math.max(1, Math.min(20, topParam)) : 5

      const votosPiPorCandidato = new Map<string, number>()
      const porTdPorCandidato = new Map<TerritorioDesenvolvimentoPI, Map<string, number>>()
      for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
        porTdPorCandidato.set(td, new Map())
      }

      for (const item of cachedAllResultados) {
        if (item.anoEleicao !== '2022') continue
        if (String(item.uf || '').toUpperCase() !== 'PI') continue
        if (!/federal/i.test(item.cargo || '')) continue
        const nome = String(item.nomeUrnaCandidato || '').trim()
        if (!nome) continue
        const votos = Number.parseInt(item.quantidadeVotosNominais || '0', 10)
        const v = Number.isNaN(votos) ? 0 : votos
        votosPiPorCandidato.set(nome, (votosPiPorCandidato.get(nome) || 0) + v)
        const td = getTerritorioDesenvolvimentoPI(String(item.municipio || ''))
        if (!td) continue
        const porCandidato = porTdPorCandidato.get(td)
        if (!porCandidato) continue
        porCandidato.set(nome, (porCandidato.get(nome) || 0) + v)
      }

      type TopCandTd = { nome: string; votosNoTd: number; votosPi: number }
      const topCandidatosPorTd = new Map<TerritorioDesenvolvimentoPI, TopCandTd[]>()
      for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
        const porCandidato = porTdPorCandidato.get(td) ?? new Map<string, number>()
        const ranked = Array.from(porCandidato.entries())
          .map(([nome, votosNoTd]) => ({
            nome,
            votosNoTd,
            votosPi: votosPiPorCandidato.get(nome) || 0,
          }))
          .sort((a, b) => b.votosNoTd - a.votosNoTd || a.nome.localeCompare(b.nome, 'pt-BR'))
          .slice(0, top)
        topCandidatosPorTd.set(td, ranked)
      }

      const linhas = TERRITORIOS_DESENVOLVIMENTO_PI.map((territorio) => {
        const topList = topCandidatosPorTd.get(territorio) ?? []
        const porCandidato = porTdPorCandidato.get(territorio) ?? new Map<string, number>()
        let somaTop = 0
        let candidatosComVotos = 0
        const detalheCandidatos = topList.map((c) => {
          const votosNoTd = porCandidato.get(c.nome) || 0
          somaTop += votosNoTd
          if (votosNoTd > 0) candidatosComVotos += 1
          return { nome: c.nome, votosPi: c.votosPi, votosNoTd }
        })
        return {
          territorio,
          mediaVotos: topList.length > 0 ? somaTop / topList.length : 0,
          somaTop,
          candidatosConsiderados: topList.length,
          candidatosComVotos,
          detalheCandidatos,
        }
      })

      return NextResponse.json({
        ano: 2022,
        escopo: 'PI_top_federal_por_td_ranking_no_td',
        top,
        candidatos: [] as { nome: string; votos: number }[],
        linhas,
      })
    }

    /**
     * Top N partidos (soma de votos nominais de todos os federais da legenda) por TD — Deputado Federal 2022, PI.
     */
    if (totals === 'federal2022TopPartidoPorTd') {
      const topParam = Number.parseInt(request.nextUrl.searchParams.get('top') || '5', 10)
      const top = Number.isFinite(topParam) ? Math.max(1, Math.min(20, topParam)) : 5

      const votosPiPorPartido = new Map<string, number>()
      const porTdPorPartido = new Map<TerritorioDesenvolvimentoPI, Map<string, number>>()
      for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
        porTdPorPartido.set(td, new Map())
      }

      for (const item of cachedAllResultados) {
        if (item.anoEleicao !== '2022') continue
        if (String(item.uf || '').toUpperCase() !== 'PI') continue
        if (!/federal/i.test(item.cargo || '')) continue
        const partidoRaw = String(item.partido || '').trim()
        const partido = partidoRaw.length > 0 ? partidoRaw : '—'
        const votos = Number.parseInt(item.quantidadeVotosNominais || '0', 10)
        const v = Number.isNaN(votos) ? 0 : votos
        votosPiPorPartido.set(partido, (votosPiPorPartido.get(partido) || 0) + v)
        const td = getTerritorioDesenvolvimentoPI(String(item.municipio || ''))
        if (!td) continue
        const porPartido = porTdPorPartido.get(td)
        if (!porPartido) continue
        porPartido.set(partido, (porPartido.get(partido) || 0) + v)
      }

      type TopPartTd = { partido: string; votosNoTd: number; votosPi: number }
      const topPartidosPorTd = new Map<TerritorioDesenvolvimentoPI, TopPartTd[]>()
      for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
        const porPartido = porTdPorPartido.get(td) ?? new Map<string, number>()
        const ranked = Array.from(porPartido.entries())
          .map(([partido, votosNoTd]) => ({
            partido,
            votosNoTd,
            votosPi: votosPiPorPartido.get(partido) || 0,
          }))
          .sort((a, b) => b.votosNoTd - a.votosNoTd || a.partido.localeCompare(b.partido, 'pt-BR'))
          .slice(0, top)
        topPartidosPorTd.set(td, ranked)
      }

      const linhas = TERRITORIOS_DESENVOLVIMENTO_PI.map((territorio) => ({
        territorio,
        detalhePartidos: topPartidosPorTd.get(territorio) ?? [],
      }))

      return NextResponse.json({
        ano: 2022,
        escopo: 'PI_top_partido_federal_por_td',
        top,
        linhas,
      })
    }

    /**
     * Média por município: mesmos top N **por TD** que em `federal2022TopMediaPorTd` (votos no município desses candidatos).
     */
    if (totals === 'federal2022TopMediaPorMunicipio') {
      const topParam = Number.parseInt(request.nextUrl.searchParams.get('top') || '5', 10)
      const top = Number.isFinite(topParam) ? Math.max(1, Math.min(20, topParam)) : 5

      const votosPiPorCandidato = new Map<string, number>()
      const porTdPorCandidato = new Map<TerritorioDesenvolvimentoPI, Map<string, number>>()
      for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
        porTdPorCandidato.set(td, new Map())
      }

      for (const item of cachedAllResultados) {
        if (item.anoEleicao !== '2022') continue
        if (String(item.uf || '').toUpperCase() !== 'PI') continue
        if (!/federal/i.test(item.cargo || '')) continue
        const nome = String(item.nomeUrnaCandidato || '').trim()
        if (!nome) continue
        const votos = Number.parseInt(item.quantidadeVotosNominais || '0', 10)
        const v = Number.isNaN(votos) ? 0 : votos
        votosPiPorCandidato.set(nome, (votosPiPorCandidato.get(nome) || 0) + v)
        const td = getTerritorioDesenvolvimentoPI(String(item.municipio || ''))
        if (!td) continue
        const porCandidato = porTdPorCandidato.get(td)
        if (!porCandidato) continue
        porCandidato.set(nome, (porCandidato.get(nome) || 0) + v)
      }

      type TopCandTd = { nome: string; votosNoTd: number; votosPi: number }
      const topCandidatosPorTd = new Map<TerritorioDesenvolvimentoPI, TopCandTd[]>()
      for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
        const porCandidato = porTdPorCandidato.get(td) ?? new Map<string, number>()
        const ranked = Array.from(porCandidato.entries())
          .map(([nome, votosNoTd]) => ({
            nome,
            votosNoTd,
            votosPi: votosPiPorCandidato.get(nome) || 0,
          }))
          .sort((a, b) => b.votosNoTd - a.votosNoTd || a.nome.localeCompare(b.nome, 'pt-BR'))
          .slice(0, top)
        topCandidatosPorTd.set(td, ranked)
      }

      const porMunNormPorCandidato = new Map<string, Map<string, number>>()
      for (const item of cachedAllResultados) {
        if (item.anoEleicao !== '2022') continue
        if (String(item.uf || '').toUpperCase() !== 'PI') continue
        if (!/federal/i.test(item.cargo || '')) continue
        const nome = String(item.nomeUrnaCandidato || '').trim()
        if (!nome) continue
        const munRaw = String(item.municipio || '').trim()
        if (!munRaw) continue
        const munNorm = normalizeMunicipioNome(munRaw)
        let porCandidato = porMunNormPorCandidato.get(munNorm)
        if (!porCandidato) {
          porCandidato = new Map()
          porMunNormPorCandidato.set(munNorm, porCandidato)
        }
        const votos = Number.parseInt(item.quantidadeVotosNominais || '0', 10)
        porCandidato.set(nome, (porCandidato.get(nome) || 0) + (Number.isNaN(votos) ? 0 : votos))
      }

      const linhasMunicipio: { municipio: string; mediaVotos: number }[] = []
      for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
        const topList = topCandidatosPorTd.get(td) ?? []
        for (const mun of getMunicipiosPorTerritorioDesenvolvimentoPI(td)) {
          const inner = porMunNormPorCandidato.get(normalizeMunicipioNome(mun)) ?? new Map<string, number>()
          let somaTop = 0
          for (const c of topList) {
            somaTop += inner.get(c.nome) || 0
          }
          const mediaVotos = topList.length > 0 ? somaTop / topList.length : 0
          linhasMunicipio.push({ municipio: mun, mediaVotos })
        }
      }

      return NextResponse.json({
        ano: 2022,
        escopo: 'PI_top_federal_por_municipio_top_do_td',
        top,
        candidatos: [] as { nome: string; votos: number }[],
        linhas: linhasMunicipio,
      })
    }

    if (totals === 'federal2022PorMunicipio') {
      const candidato = (request.nextUrl.searchParams.get('candidato') || '').trim()
      const nomeCivil = (request.nextUrl.searchParams.get('nomeCivil') || '').trim()
      if (!candidato && !nomeCivil) {
        return NextResponse.json(
          { error: 'Informe candidato (nome de urna) ou nomeCivil.' },
          { status: 400 }
        )
      }
      const keys = new Set<string>()
      if (candidato) keys.add(normalizeCandidatoMatch(candidato))
      if (nomeCivil) keys.add(normalizeCandidatoMatch(nomeCivil))
      const byMun = new Map<string, number>()
      for (const item of cachedAllResultados) {
        if (item.anoEleicao !== '2022') continue
        if (String(item.uf || '').toUpperCase() !== 'PI') continue
        if (!/federal/i.test(item.cargo || '')) continue
        const urn = normalizeCandidatoMatch(item.nomeUrnaCandidato || '')
        const civ = normalizeCandidatoMatch(item.nomeCandidato || '')
        let match = false
        for (const k of keys) {
          if (!k) continue
          if (urn === k || civ === k) {
            match = true
            break
          }
        }
        if (!match) continue
        const mun = String(item.municipio || '').trim()
        if (!mun) continue
        const v = Number.parseInt(item.quantidadeVotosNominais || '0', 10)
        byMun.set(mun, (byMun.get(mun) || 0) + (Number.isNaN(v) ? 0 : v))
      }
      const pontos = Array.from(byMun.entries())
        .map(([municipio, votos]) => ({ municipio, votos }))
        .sort((a, b) => b.votos - a.votos || a.municipio.localeCompare(b.municipio, 'pt-BR'))
      const totalVotos = pontos.reduce((s, p) => s + p.votos, 0)
      return NextResponse.json({
        ano: 2022,
        escopo: 'PI',
        pontos,
        totalVotos,
        municipiosComVotos: pontos.filter((p) => p.votos > 0).length,
      })
    }

    /** Soma de votos nominais (todos os candidatos) por município — Deputado Federal 2022, PI. */
    if (totals === 'federal2022VotosTotaisPorMunicipio') {
      const apenasPerfilMilitar = request.nextUrl.searchParams.get('perfilMilitar') === 'true'
      const byMun = new Map<string, number>()
      for (const item of cachedAllResultados) {
        if (item.anoEleicao !== '2022') continue
        if (String(item.uf || '').toUpperCase() !== 'PI') continue
        if (!/federal/i.test(item.cargo || '')) continue
        if (
          apenasPerfilMilitar &&
          !candidatoEleicaoIndicaPerfilMilitar(
            String(item.nomeUrnaCandidato || ''),
            String(item.nomeCandidato || '')
          )
        ) {
          continue
        }
        const mun = String(item.municipio || '').trim()
        if (!mun) continue
        const v = Number.parseInt(item.quantidadeVotosNominais || '0', 10)
        byMun.set(mun, (byMun.get(mun) || 0) + (Number.isNaN(v) ? 0 : v))
      }
      const pontos = Array.from(byMun.entries())
        .map(([municipio, votos]) => ({ municipio, votos }))
        .sort((a, b) => b.votos - a.votos || a.municipio.localeCompare(b.municipio, 'pt-BR'))
      const totalVotos = pontos.reduce((s, p) => s + p.votos, 0)
      return NextResponse.json({
        ano: 2022,
        escopo: apenasPerfilMilitar
          ? 'PI_todos_candidatos_federal_perfil_militar'
          : 'PI_todos_candidatos_federal',
        pontos,
        totalVotos,
        municipiosComVotos: pontos.filter((p) => p.votos > 0).length,
      })
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
