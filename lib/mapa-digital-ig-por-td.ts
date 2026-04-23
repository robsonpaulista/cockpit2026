import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import {
  getTerritorioDesenvolvimentoPI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import type { LiderancaPlanilha } from '@/lib/territorio-planilha-agregado-td'

export type InstagramPorTdAgg = {
  comentarios: number
  perfisUnicos: number
  tempoPostComentarioSomaMs: number
  tempoPostComentarioN: number
}

/** Mapeia handle normalizado → TD a partir da cidade/município da planilha. */
export function buildInstagramHandleToTdFromPlanilha(
  records: LiderancaPlanilha[],
  cidadeCol: string,
  instagramCol: string | undefined
): Map<string, TerritorioDesenvolvimentoPI> {
  const m = new Map<string, TerritorioDesenvolvimentoPI>()
  if (!instagramCol || !cidadeCol) return m
  for (const row of records) {
    const cityRaw = row[cidadeCol]
    const igRaw = row[instagramCol]
    const city = typeof cityRaw === 'string' ? cityRaw.trim() : String(cityRaw ?? '').trim()
    const igNorm = normalizeInstagramHandle(typeof igRaw === 'string' ? igRaw : String(igRaw ?? ''))
    if (!city || !igNorm) continue
    const td = getTerritorioDesenvolvimentoPI(city)
    if (!td) continue
    m.set(igNorm, td)
  }
  return m
}

export function aggregateCommentLeadersPorTd(
  leaders: ReadonlyArray<{
    commenter_username: string | null
    commenter_ig_id: string | null
    comment_count: number
  }>,
  handleToTd: Map<string, TerritorioDesenvolvimentoPI>
): {
  porTd: Map<TerritorioDesenvolvimentoPI, InstagramPorTdAgg>
  comentariosSemVinculo: number
  perfisSemVinculo: number
} {
  const porTd = new Map<TerritorioDesenvolvimentoPI, InstagramPorTdAgg>()
  let comentariosSemVinculo = 0
  let perfisSemVinculo = 0

  for (const L of leaders) {
    const u = normalizeInstagramHandle(L.commenter_username)
    const td = u ? handleToTd.get(u) : undefined
    if (!td) {
      comentariosSemVinculo += L.comment_count
      if (L.comment_count > 0) perfisSemVinculo += 1
      continue
    }
    const cur = porTd.get(td) ?? {
      comentarios: 0,
      perfisUnicos: 0,
      tempoPostComentarioSomaMs: 0,
      tempoPostComentarioN: 0,
    }
    cur.comentarios += L.comment_count
    cur.perfisUnicos += 1
    porTd.set(td, cur)
  }
  return { porTd, comentariosSemVinculo, perfisSemVinculo }
}
