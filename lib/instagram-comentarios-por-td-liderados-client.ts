import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import type { InstagramPorTdAgg } from '@/lib/mapa-digital-ig-por-td'

export type InstagramComentariosAgregadoPorTdLideradosPayload = {
  porTd: Map<TerritorioDesenvolvimentoPI, InstagramPorTdAgg>
  semVinculo: { comentarios: number; perfisUnicos: number }
  /** Contagem de `instagram_media_id` distintos nas linhas de comentários do usuário. */
  postagensProcessadas: number
  /** Mídias com ≥1 comentário vinculado a algum liderado (união entre TDs). */
  midiasComComentarioVinculadas: number
}

type ApiBody = {
  porTd?: Record<
    string,
    {
      comentarios?: number
      midiasComComentario?: number
      perfisUnicos?: number
      tempoPostComentarioSomaMs?: number
      tempoPostComentarioN?: number
    }
  >
  semVinculo?: { comentarios?: number; perfisUnicos?: number }
  postagensProcessadas?: number
  midiasComComentarioVinculadas?: number
}

export function mapaInstagramComentariosPorTdVazio(): Map<TerritorioDesenvolvimentoPI, InstagramPorTdAgg> {
  const m = new Map<TerritorioDesenvolvimentoPI, InstagramPorTdAgg>()
  for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
    m.set(td, {
      comentarios: 0,
      midiasComComentario: 0,
      perfisUnicos: 0,
      tempoPostComentarioSomaMs: 0,
      tempoPostComentarioN: 0,
    })
  }
  return m
}

export function emptyInstagramComentariosPorTdPayload(): InstagramComentariosAgregadoPorTdLideradosPayload {
  return {
    porTd: mapaInstagramComentariosPorTdVazio(),
    semVinculo: { comentarios: 0, perfisUnicos: 0 },
    postagensProcessadas: 0,
    midiasComComentarioVinculadas: 0,
  }
}

function parsePayload(json: ApiBody): InstagramComentariosAgregadoPorTdLideradosPayload {
  const porTd = mapaInstagramComentariosPorTdVazio()
  const raw = json.porTd ?? {}
  for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
    const v = raw[td]
    if (v) {
      porTd.set(td, {
        comentarios: Number(v.comentarios ?? 0),
        midiasComComentario: Math.max(0, Math.floor(Number(v.midiasComComentario ?? 0))),
        perfisUnicos: Number(v.perfisUnicos ?? 0),
        tempoPostComentarioSomaMs: Math.max(0, Math.floor(Number(v.tempoPostComentarioSomaMs ?? 0))),
        tempoPostComentarioN: Math.max(0, Math.floor(Number(v.tempoPostComentarioN ?? 0))),
      })
    }
  }
  const s = json.semVinculo
  const postagensProcessadas = Math.max(0, Math.floor(Number(json.postagensProcessadas ?? 0)))
  const midiasComComentarioVinculadas = Math.max(0, Math.floor(Number(json.midiasComComentarioVinculadas ?? 0)))
  return {
    porTd,
    semVinculo: {
      comentarios: Number(s?.comentarios ?? 0),
      perfisUnicos: Number(s?.perfisUnicos ?? 0),
    },
    postagensProcessadas,
    midiasComComentarioVinculadas,
  }
}

export type FetchInstagramComentariosPorTdLideradosResult =
  | { ok: true; data: InstagramComentariosAgregadoPorTdLideradosPayload }
  | { ok: false; status: number; message?: string }

export async function fetchInstagramComentariosAgregadoPorTdLiderados(): Promise<FetchInstagramComentariosPorTdLideradosResult> {
  try {
    const res = await fetch('/api/instagram/comments/agregado-por-td-liderados', { cache: 'no-store' })
    if (res.status === 401) {
      return { ok: false, status: 401, message: 'Não autenticado' }
    }
    if (res.status === 403) {
      return { ok: false, status: 403, message: 'Sem permissão para Mobilização' }
    }
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      return { ok: false, status: res.status, message: j.error ?? res.statusText }
    }
    const json = (await res.json()) as ApiBody
    return { ok: true, data: parsePayload(json) }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Falha na rede'
    return { ok: false, status: 0, message }
  }
}
