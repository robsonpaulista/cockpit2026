import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

export type IgAgregadoMunicipioNoTd = {
  lideres: number
  liderados: number
  comentarios: number
  /** Mídias distintas com ≥1 comentário vinculado a liderados deste município. */
  midiasComComentario: number
  perfisUnicos: number
  tempoMedioPostComentarioMs: number | null
  tempoPostComentarioSomaMs: number
  tempoPostComentarioN: number
}

type ApiBody = {
  territorio?: string
  porMunicipio?: Record<string, Partial<IgAgregadoMunicipioNoTd>>
  midiasComComentarioNoTd?: number
}

function parseBody(body: ApiBody): Map<string, IgAgregadoMunicipioNoTd> {
  const m = new Map<string, IgAgregadoMunicipioNoTd>()
  const raw = body.porMunicipio ?? {}
  for (const [nomeOficial, v] of Object.entries(raw)) {
    const key = normalizeMunicipioNome(nomeOficial)
    const somaT = Math.max(0, Math.floor(Number(v?.tempoPostComentarioSomaMs ?? 0)))
    const nT = Math.max(0, Math.floor(Number(v?.tempoPostComentarioN ?? 0)))
    const tempoMedioRaw = v?.tempoMedioPostComentarioMs
    const tempoMedioPostComentarioMs =
      typeof tempoMedioRaw === 'number' && Number.isFinite(tempoMedioRaw)
        ? Math.round(tempoMedioRaw)
        : nT > 0
          ? Math.round(somaT / nT)
          : null
    m.set(key, {
      lideres: Math.max(0, Math.floor(Number(v?.lideres ?? 0))),
      liderados: Math.max(0, Math.floor(Number(v?.liderados ?? 0))),
      comentarios: Math.max(0, Math.floor(Number(v?.comentarios ?? 0))),
      midiasComComentario: Math.max(0, Math.floor(Number(v?.midiasComComentario ?? 0))),
      perfisUnicos: Math.max(0, Math.floor(Number(v?.perfisUnicos ?? 0))),
      tempoMedioPostComentarioMs,
      tempoPostComentarioSomaMs: somaT,
      tempoPostComentarioN: nT,
    })
  }
  return m
}

export type FetchInstagramIgPorMunicipioNoTdResult =
  | { ok: true; data: Map<string, IgAgregadoMunicipioNoTd>; midiasComComentarioNoTd: number }
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
    const midiasComComentarioNoTd = Math.max(0, Math.floor(Number(json.midiasComComentarioNoTd ?? 0)))
    return { ok: true, data: parseBody(json), midiasComComentarioNoTd }
  } catch {
    return { ok: false, status: 0 }
  }
}
