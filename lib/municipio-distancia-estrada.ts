import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeIptMunicipio } from '@/lib/ipt'
import municipiosPiaui from '@/lib/municipios-piaui.json'

export type MunicipioDistanciaFonte = 'cache' | 'ors' | 'misto' | 'indisponivel'

export type MunicipioDistanciaEnsureResult = {
  /** Chave: `${origemNorm}|${destinoNorm}` → km */
  distancias: Record<string, number>
  fonte: MunicipioDistanciaFonte
  doCache: number
  doOrs: number
  faltando: number
  erro?: string
}

type Coord = { lat: number; lng: number; nome: string }

const COORDS_BY_NORM = new Map(
  (municipiosPiaui as Array<{ nome: string; lat: number; lng: number }>).map((m) => [
    normalizeIptMunicipio(m.nome),
    { lat: m.lat, lng: m.lng, nome: m.nome } as Coord,
  ]),
)

const ORS_MATRIX_URL = 'https://api.openrouteservice.org/v2/matrix/driving-car'
/** Limite prático do free tier ORS Matrix (~50×50). */
const ORS_MAX_LOCATIONS = 50

export function municipioDistanciaPairKey(origem: string, destino: string): string {
  return `${normalizeIptMunicipio(origem)}|${normalizeIptMunicipio(destino)}`
}

export function resolveMunicipioCoord(nome: string): Coord | null {
  return COORDS_BY_NORM.get(normalizeIptMunicipio(nome)) ?? null
}

function uniqueNomes(nomes: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of nomes) {
    const nome = raw.trim()
    if (!nome) continue
    const norm = normalizeIptMunicipio(nome)
    if (seen.has(norm)) continue
    seen.add(norm)
    out.push(nome)
  }
  return out
}

async function loadCachedPairs(
  supabase: SupabaseClient,
  norms: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (norms.length === 0) return map

  const { data, error } = await supabase
    .from('municipio_distancia_estrada')
    .select('origem_norm, destino_norm, km')
    .in('origem_norm', norms)
    .in('destino_norm', norms)

  if (error) {
    throw new Error(error.message)
  }

  for (const row of data ?? []) {
    const km = Number(row.km)
    if (!Number.isFinite(km)) continue
    map.set(`${row.origem_norm}|${row.destino_norm}`, km)
  }
  return map
}

async function upsertPairs(
  supabase: SupabaseClient,
  rows: Array<{
    origem_norm: string
    destino_norm: string
    origem_nome: string
    destino_nome: string
    km: number
    segundos: number | null
  }>,
): Promise<void> {
  if (rows.length === 0) return
  const payload = rows.map((r) => ({
    ...r,
    provedor: 'openrouteservice',
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('municipio_distancia_estrada').upsert(payload, {
    onConflict: 'origem_norm,destino_norm',
  })
  if (error) throw new Error(error.message)
}

type OrsMatrixResponse = {
  distances?: Array<Array<number | null>>
  durations?: Array<Array<number | null>>
  error?: string | { message?: string }
}

async function fetchOrsMatrixKm(
  locs: Coord[],
  apiKey: string,
): Promise<{ km: Array<Array<number | null>>; segundos: Array<Array<number | null>> }> {
  const res = await fetch(ORS_MATRIX_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      locations: locs.map((c) => [c.lng, c.lat]),
      metrics: ['distance', 'duration'],
      units: 'km',
    }),
  })

  const json = (await res.json().catch(() => null)) as OrsMatrixResponse | null
  if (!res.ok) {
    const msg =
      typeof json?.error === 'string'
        ? json.error
        : json?.error?.message || `ORS Matrix HTTP ${res.status}`
    throw new Error(msg)
  }

  return {
    km: json?.distances ?? [],
    segundos: json?.durations ?? [],
  }
}

/**
 * Garante distâncias rodoviárias entre todos os pares dos municípios informados.
 * Lê o cache no banco; busca no OpenRouteService só o que faltar; persiste.
 */
export async function ensureMunicipioDistanciasEstrada(
  supabase: SupabaseClient,
  nomesInput: string[],
): Promise<MunicipioDistanciaEnsureResult> {
  const nomes = uniqueNomes(nomesInput)
  const coords: Coord[] = []
  for (const nome of nomes) {
    const c = resolveMunicipioCoord(nome)
    if (c) coords.push(c)
  }

  if (coords.length < 2) {
    return {
      distancias: {},
      fonte: 'indisponivel',
      doCache: 0,
      doOrs: 0,
      faltando: 0,
      erro: 'Menos de 2 municípios com coordenada.',
    }
  }

  if (coords.length > ORS_MAX_LOCATIONS) {
    return {
      distancias: {},
      fonte: 'indisponivel',
      doCache: 0,
      doOrs: 0,
      faltando: 0,
      erro: `Máximo de ${ORS_MAX_LOCATIONS} municípios por matriz ORS.`,
    }
  }

  const norms = coords.map((c) => normalizeIptMunicipio(c.nome))
  let cached: Map<string, number>
  try {
    cached = await loadCachedPairs(supabase, norms)
  } catch (e) {
    return {
      distancias: {},
      fonte: 'indisponivel',
      doCache: 0,
      doOrs: 0,
      faltando: 0,
      erro:
        e instanceof Error
          ? e.message
          : 'Falha ao ler cache de distâncias (rode o SQL create-municipio-distancia-estrada.sql).',
    }
  }

  const needed: Array<{ i: number; j: number }> = []
  for (let i = 0; i < coords.length; i += 1) {
    for (let j = 0; j < coords.length; j += 1) {
      if (i === j) continue
      const key = `${norms[i]}|${norms[j]}`
      if (!cached.has(key)) needed.push({ i, j })
    }
  }

  let doOrs = 0
  let erro: string | undefined

  if (needed.length > 0) {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY?.trim()
    if (!apiKey) {
      erro =
        'OPENROUTESERVICE_API_KEY ausente. Usando apenas pares já cacheados (fallback linha reta no cliente).'
    } else {
      try {
        const matrix = await fetchOrsMatrixKm(coords, apiKey)
        const toSave: Array<{
          origem_norm: string
          destino_norm: string
          origem_nome: string
          destino_nome: string
          km: number
          segundos: number | null
        }> = []

        for (const { i, j } of needed) {
          const rawKm = matrix.km[i]?.[j]
          if (rawKm == null || !Number.isFinite(rawKm)) continue
          const km = Math.round(rawKm * 100) / 100
          const rawSec = matrix.segundos[i]?.[j]
          const segundos =
            rawSec != null && Number.isFinite(rawSec) ? Math.round(rawSec) : null
          const key = `${norms[i]}|${norms[j]}`
          cached.set(key, km)
          toSave.push({
            origem_norm: norms[i],
            destino_norm: norms[j],
            origem_nome: coords[i].nome,
            destino_nome: coords[j].nome,
            km,
            segundos,
          })
          doOrs += 1
        }

        await upsertPairs(supabase, toSave)
      } catch (e) {
        erro = e instanceof Error ? e.message : 'Falha ao consultar OpenRouteService'
      }
    }
  }

  const distancias: Record<string, number> = {}
  for (const [key, km] of cached) {
    distancias[key] = km
  }

  const totalPairs = coords.length * (coords.length - 1)
  const doCache = totalPairs - needed.length
  const faltando = needed.length - doOrs
  const fonte: MunicipioDistanciaFonte =
    doOrs > 0 && doCache > 0
      ? 'misto'
      : doOrs > 0
        ? 'ors'
        : Object.keys(distancias).length > 0
          ? 'cache'
          : 'indisponivel'

  return {
    distancias,
    fonte,
    doCache: Math.max(0, doCache),
    doOrs,
    faltando: Math.max(0, faltando),
    erro,
  }
}
