import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

export type IgAgregadoMunicipioNoTd = {
  lideres: number
  liderados: number
  comentarios: number
  perfisUnicos: number
}

type ApiBody = {
  territorio?: string
  porMunicipio?: Record<string, Partial<IgAgregadoMunicipioNoTd>>
}

function parseBody(body: ApiBody): Map<string, IgAgregadoMunicipioNoTd> {
  const m = new Map<string, IgAgregadoMunicipioNoTd>()
  const raw = body.porMunicipio ?? {}
  for (const [nomeOficial, v] of Object.entries(raw)) {
    const key = normalizeMunicipioNome(nomeOficial)
    m.set(key, {
      lideres: Math.max(0, Math.floor(Number(v?.lideres ?? 0))),
      liderados: Math.max(0, Math.floor(Number(v?.liderados ?? 0))),
      comentarios: Math.max(0, Math.floor(Number(v?.comentarios ?? 0))),
      perfisUnicos: Math.max(0, Math.floor(Number(v?.perfisUnicos ?? 0))),
    })
  }
  return m
}

export type FetchInstagramIgPorMunicipioNoTdResult =
  | { ok: true; data: Map<string, IgAgregadoMunicipioNoTd> }
  | { ok: false; status: number }

export async function fetchInstagramIgPorMunicipioNoTd(
  td: TerritorioDesenvolvimentoPI
): Promise<FetchInstagramIgPorMunicipioNoTdResult> {
  try {
    const res = await fetch(
      `/api/instagram/comments/agregado-ig-por-municipio-no-td?td=${encodeURIComponent(td)}`,
      { cache: 'no-store' }
    )
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status }
    }
    if (!res.ok) {
      return { ok: false, status: res.status }
    }
    const json = (await res.json()) as ApiBody
    return { ok: true, data: parseBody(json) }
  } catch {
    return { ok: false, status: 0 }
  }
}
