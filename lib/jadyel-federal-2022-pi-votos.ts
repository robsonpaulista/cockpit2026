import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  getMunicipiosPorTerritorioDesenvolvimentoPI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'

/** Mesmo identificador usado em `resumo-eleicoes` (nome de urna TSE 2022). */
export const JADYEL_URNA_DEP_FEDERAL_2022 = 'JADYEL DA JUPI'

export type JadyelFederal2022PorMunicipioResultado = {
  mapaNormalizado: Map<string, number>
  totalVotos: number
}

/**
 * Votos nominais de Jadyel (Dep. Federal 2022) por município do PI.
 * Chave do mapa: `normalizeMunicipioNome` do nome do município retornado pela API.
 */
export async function fetchJadyelFederal2022VotosPorMunicipioPI(): Promise<JadyelFederal2022PorMunicipioResultado | null> {
  const params = new URLSearchParams({
    totals: 'federal2022PorMunicipio',
    candidato: JADYEL_URNA_DEP_FEDERAL_2022,
  })
  const res = await fetch(`/api/resumo-eleicoes?${params}`)
  if (!res.ok) return null
  const data = (await res.json()) as {
    pontos?: { municipio: string; votos: number }[]
    totalVotos?: number
  }
  const mapa = new Map<string, number>()
  for (const p of data.pontos ?? []) {
    const k = normalizeMunicipioNome(String(p.municipio ?? ''))
    if (!k) continue
    mapa.set(k, p.votos)
  }
  return {
    mapaNormalizado: mapa,
    totalVotos: typeof data.totalVotos === 'number' ? data.totalVotos : 0,
  }
}

export function obterVotos2022JadyelMunicipio(
  mapa: ReadonlyMap<string, number>,
  nomeOficialMunicipio: string
): number {
  return mapa.get(normalizeMunicipioNome(nomeOficialMunicipio)) ?? 0
}

/**
 * Total de votos nominais (todos os candidatos) — Dep. Federal 2022 — por município do PI.
 * Mesma base do TOTAL da coluna "Deputado Federal 2022" em /dashboard/resumo-eleicoes.
 */
export async function fetchFederal2022VotosTotaisPorMunicipioPI(): Promise<Map<string, number> | null> {
  const params = new URLSearchParams({
    totals: 'federal2022VotosTotaisPorMunicipio',
  })
  const res = await fetch(`/api/resumo-eleicoes?${params}`)
  if (!res.ok) return null
  const data = (await res.json()) as {
    pontos?: { municipio: string; votos: number }[]
  }
  const mapa = new Map<string, number>()
  for (const p of data.pontos ?? []) {
    const k = normalizeMunicipioNome(String(p.municipio ?? ''))
    if (!k) continue
    const votos = Number(p.votos)
    if (!Number.isFinite(votos) || votos < 0) continue
    mapa.set(k, Math.round(votos))
  }
  return mapa
}

export function obterVotosFederal2022TotaisMunicipio(
  mapa: ReadonlyMap<string, number>,
  nomeOficialMunicipio: string,
): number | null {
  const v = mapa.get(normalizeMunicipioNome(nomeOficialMunicipio))
  if (v == null || !Number.isFinite(v) || v <= 0) return null
  return v
}

export function somarVotos2022JadyelNoTd(
  mapa: ReadonlyMap<string, number>,
  td: TerritorioDesenvolvimentoPI
): number {
  let s = 0
  for (const cidade of getMunicipiosPorTerritorioDesenvolvimentoPI(td)) {
    s += mapa.get(normalizeMunicipioNome(cidade)) ?? 0
  }
  return s
}

export function montarMapaVotos2022JadyelPorTd(
  mapa: ReadonlyMap<string, number>
): Map<TerritorioDesenvolvimentoPI, number> {
  const out = new Map<TerritorioDesenvolvimentoPI, number>()
  for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
    out.set(td, somarVotos2022JadyelNoTd(mapa, td))
  }
  return out
}
