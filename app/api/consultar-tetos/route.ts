import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import {
  formatarNomeMunicipioLista,
  mapearNomeMunicipio,
  normalizeMunicipioNome,
} from '@/lib/fns-municipio-normalize'
import { getMunicipiosLista } from '@/lib/limites-tetos-db'
import { createClient } from '@/lib/supabase/server'
import { normalizePropostaFns, type PropostaFnsCompleta } from '@/lib/fns-proposta-normalize'

export const dynamic = 'force-dynamic'
export const maxDuration = 25

interface MunicipioFns {
  coMunicipioIbge: string
  noMunicipio: string
}

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N)',
  Referer: 'https://consultafns.saude.gov.br/',
}

const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_DURATION = 30 * 60 * 1000

function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T
  }
  return null
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() })
}

function getMunicipiosFromLocal(): MunicipioFns[] {
  const filePath = path.join(process.cwd(), 'data', 'limites-pap-2025.json')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const limitesData = JSON.parse(fileContent) as { municipio: string; ibge: string | number }[]
  const municipiosMap = new Map<string, MunicipioFns>()

  limitesData.forEach((item) => {
    if (!municipiosMap.has(item.municipio)) {
      municipiosMap.set(item.municipio, {
        coMunicipioIbge: String(item.ibge),
        noMunicipio: formatarNomeMunicipioLista(item.municipio),
      })
    }
  })

  return Array.from(municipiosMap.values()).sort((a, b) =>
    a.noMunicipio.localeCompare(b.noMunicipio, 'pt-BR'),
  )
}

async function getMunicipios(): Promise<MunicipioFns[]> {
  try {
    const supabase = createClient()
    const lista = await getMunicipiosLista(supabase)
    if (lista.length > 0) {
      return lista.map((m) => ({
        coMunicipioIbge: m.coMunicipioIbge,
        noMunicipio: m.noMunicipio,
      }))
    }
  } catch (e) {
    console.warn('consultar-tetos: fallback municípios local', e)
  }
  return getMunicipiosFromLocal()
}

async function getPropostasByMunicipio(
  codigoIbge: string,
  nomeMunicipio: string,
  maxPages = 5,
): Promise<PropostaFnsCompleta[]> {
  const cacheKey = `propostas-${codigoIbge}`
  const cached = getFromCache<PropostaFnsCompleta[]>(cacheKey)
  if (cached) return cached

  const propostas: PropostaFnsCompleta[] = []
  let page = 1

  try {
    while (page <= maxPages) {
      const url = 'https://consultafns.saude.gov.br/recursos/proposta/consultar'
      const params = new URLSearchParams({
        ano: '2025',
        sgUf: 'PI',
        coMunicipioIbge: codigoIbge,
        count: '100',
        page: page.toString(),
        coEsfera: '',
      })

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${url}?${params.toString()}`, {
        headers: HEADERS,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) break

      const data = await response.json()
      const propostasPage = data.resultado?.itensPagina || []

      if (propostasPage.length === 0) break

      propostas.push(
        ...propostasPage.map((p: Record<string, unknown>) =>
          normalizePropostaFns(p, nomeMunicipio),
        ),
      )

      page++
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    setCache(cacheKey, propostas)
  } catch (error: unknown) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'AbortError') {
      console.error(`Timeout na consulta FNS: ${nomeMunicipio}`)
    } else {
      console.error(`Erro FNS ${nomeMunicipio}:`, error)
    }
  }

  return propostas
}

export async function GET(req: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(req.url)
    const municipioParam = searchParams.get('municipio')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const onlyMunicipios = searchParams.get('only_municipios') === 'true'

    const municipios = await getMunicipios()

    if (municipios.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível carregar a lista de municípios' },
        { status: 500 },
      )
    }

    if (onlyMunicipios) {
      return NextResponse.json({
        municipios: municipios.map((m) => m.noMunicipio).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      })
    }

    let allPropostas: PropostaFnsCompleta[] = []

    if (municipioParam) {
      const nomeNormalizado = normalizeMunicipioNome(municipioParam)
      const nomeMapeado = mapearNomeMunicipio(municipioParam)

      const municipioTarget = municipios.find(
        (m) =>
          normalizeMunicipioNome(m.noMunicipio) === nomeNormalizado ||
          m.noMunicipio.toUpperCase() === municipioParam.toUpperCase() ||
          mapearNomeMunicipio(m.noMunicipio) === nomeMapeado,
      )

      if (municipioTarget) {
        allPropostas = await getPropostasByMunicipio(
          municipioTarget.coMunicipioIbge,
          municipioTarget.noMunicipio,
        )
      }
    } else {
      const cacheKey = 'all-propostas'
      const cached = getFromCache<PropostaFnsCompleta[]>(cacheKey)

      if (cached) {
        allPropostas = cached
      } else {
        const municipiosLimitados = municipios.slice(0, limit)
        const batchSize = 3

        for (let i = 0; i < municipiosLimitados.length; i += batchSize) {
          if (Date.now() - startTime > 20_000) break

          const batch = municipiosLimitados.slice(i, i + batchSize)
          const propostasBatch = await Promise.allSettled(
            batch.map((m) =>
              getPropostasByMunicipio(m.coMunicipioIbge, m.noMunicipio, 3),
            ),
          )

          propostasBatch.forEach((result) => {
            if (result.status === 'fulfilled') {
              allPropostas.push(...result.value)
            }
          })

          if (i + batchSize < municipiosLimitados.length) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }
        }

        setCache(cacheKey, allPropostas)
      }
    }

    allPropostas.sort((a, b) => {
      const dateA = new Date(a.dtCadastramento).getTime()
      const dateB = new Date(b.dtCadastramento).getTime()
      return dateB - dateA
    })

    return NextResponse.json({
      propostas: allPropostas,
      municipios: municipios.map((m) => m.noMunicipio).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      total_municipios: municipios.length,
      municipios_consultados: municipioParam ? 1 : limit,
    })
  } catch (error: unknown) {
    console.error('consultar-tetos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao buscar dados do FNS' },
      { status: 500 },
    )
  }
}
