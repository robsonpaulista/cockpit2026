import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import {
  formatarNomeMunicipioLista,
  mapearNomeMunicipio,
  normalizeMunicipioNome,
} from '@/lib/fns-municipio-normalize'
import { fetchPropostasFnsFromApi } from '@/lib/fns-fetch'
import type { PropostaFnsCompleta } from '@/lib/fns-proposta-normalize'
import { getExercicioAtivo, getMunicipiosLista } from '@/lib/limites-tetos-db'
import { getPropostasFnsArquivo } from '@/lib/propostas-fns-db'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 25

interface MunicipioFns {
  coMunicipioIbge: string
  noMunicipio: string
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

/** Exercício corrente: FNS ao vivo (não persiste). Anos anteriores: arquivo no banco. */
async function getPropostasByMunicipio(
  codigoIbge: string,
  nomeMunicipio: string,
  ano: number,
  exercicioAtivo: number,
  maxPages = 5,
): Promise<{ propostas: PropostaFnsCompleta[]; fonte: 'fns' | 'db' }> {
  if (ano < exercicioAtivo) {
    const supabase = createClient()
    const propostas = await getPropostasFnsArquivo(supabase, ano, nomeMunicipio)
    return { propostas, fonte: 'db' }
  }

  const cacheKey = `propostas-${ano}-${codigoIbge}`
  const cached = getFromCache<PropostaFnsCompleta[]>(cacheKey)
  if (cached) return { propostas: cached, fonte: 'fns' }

  const propostas = await fetchPropostasFnsFromApi(
    codigoIbge,
    nomeMunicipio,
    ano,
    maxPages,
  )
  setCache(cacheKey, propostas)
  return { propostas, fonte: 'fns' }
}

export async function GET(req: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(req.url)
    const municipioParam = searchParams.get('municipio')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const onlyMunicipios = searchParams.get('only_municipios') === 'true'
    const anoParam = searchParams.get('ano')

    const supabase = createClient()
    const exercicioAtivo = await getExercicioAtivo(supabase)
    const anoConsulta = anoParam ? parseInt(anoParam, 10) : exercicioAtivo
    const ano = Number.isFinite(anoConsulta) ? anoConsulta : exercicioAtivo

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
    let fonte: 'fns' | 'db' = ano >= exercicioAtivo ? 'fns' : 'db'

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
        const result = await getPropostasByMunicipio(
          municipioTarget.coMunicipioIbge,
          municipioTarget.noMunicipio,
          ano,
          exercicioAtivo,
        )
        allPropostas = result.propostas
        fonte = result.fonte
      }
    } else {
      const cacheKey = `all-propostas-${ano}`
      const cached = getFromCache<PropostaFnsCompleta[]>(cacheKey)

      if (cached) {
        allPropostas = cached
      } else if (ano < exercicioAtivo) {
        return NextResponse.json(
          {
            error:
              'Consulta em lote disponível apenas para o exercício corrente. Informe ?municipio= para anos anteriores.',
          },
          { status: 400 },
        )
      } else {
        const municipiosLimitados = municipios.slice(0, limit)
        const batchSize = 3

        for (let i = 0; i < municipiosLimitados.length; i += batchSize) {
          if (Date.now() - startTime > 20_000) break

          const batch = municipiosLimitados.slice(i, i + batchSize)
          const propostasBatch = await Promise.allSettled(
            batch.map((m) =>
              getPropostasByMunicipio(
                m.coMunicipioIbge,
                m.noMunicipio,
                ano,
                exercicioAtivo,
                3,
              ),
            ),
          )

          propostasBatch.forEach((result) => {
            if (result.status === 'fulfilled') {
              allPropostas.push(...result.value.propostas)
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
      const dateA = a.dtCadastramento ? new Date(a.dtCadastramento).getTime() : 0
      const dateB = b.dtCadastramento ? new Date(b.dtCadastramento).getTime() : 0
      return dateB - dateA
    })

    return NextResponse.json({
      propostas: allPropostas,
      ano,
      exercicio_ativo: exercicioAtivo,
      fonte,
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
