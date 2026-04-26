import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import { tdTerritorialPorLeadRowLike } from '@/lib/mobilizacao-td-por-municipio-leader'

export const dynamic = 'force-dynamic'

type LeaderJoin = { cidade: string | null; municipio: string | null }
type LeadRow = {
  cidade: string | null
  instagram: string | null
  leaders: LeaderJoin | LeaderJoin[] | null
}

export type InstagramComentariosPorTdAgg = {
  comentarios: number
  /** Mídias distintas com ≥1 comentário de liderado vinculado a este TD. */
  midiasComComentario: number
  perfisUnicos: number
  tempoPostComentarioSomaMs: number
  tempoPostComentarioN: number
}

export type InstagramComentariosAgregadoPorTdLideradosResponse = {
  porTd: Record<string, InstagramComentariosPorTdAgg>
  /** Comentários / perfis sem vínculo com liderado (sem métrica de tempo por TD). */
  semVinculo: { comentarios: number; perfisUnicos: number }
  /** Mídias distintas com comentários sincronizados (postagens processadas na base). */
  postagensProcessadas: number
  /** Mídias distintas com ≥1 comentário vinculado a algum liderado (qualquer TD). */
  midiasComComentarioVinculadas: number
}

function mapaTdZero(): Record<string, InstagramComentariosPorTdAgg> {
  const porTd: Record<string, InstagramComentariosPorTdAgg> = {}
  for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
    porTd[td] = {
      comentarios: 0,
      midiasComComentario: 0,
      perfisUnicos: 0,
      tempoPostComentarioSomaMs: 0,
      tempoPostComentarioN: 0,
    }
  }
  return porTd
}

export async function GET() {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response
  const { userId } = ctx

  const admin = createAdminClient()

  const mediaIds = new Set<string>()
  const pageSizeMedia = 1000
  let fromMedia = 0
  for (;;) {
    const { data, error } = await admin
      .from('instagram_comments')
      .select('instagram_media_id')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(fromMedia, fromMedia + pageSizeMedia - 1)

    if (error) {
      console.error('[instagram/comments/agregado-por-td-liderados] media ids', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = data ?? []
    if (rows.length === 0) break
    for (const row of rows) {
      const mid = String((row as { instagram_media_id?: string }).instagram_media_id ?? '').trim()
      if (mid) mediaIds.add(mid)
    }
    if (rows.length < pageSizeMedia) break
    fromMedia += pageSizeMedia
  }
  const postagensProcessadas = mediaIds.size

  const handleToTd = new Map<string, TerritorioDesenvolvimentoPI>()
  const pageSizeLeads = 1000
  let fromLeads = 0
  for (;;) {
    const { data, error } = await admin
      .from('leads_militancia')
      .select(
        `
        instagram,
        cidade,
        leaders!inner (
          cidade,
          municipio
        )
      `
      )
      .eq('status', 'ativo')
      .not('instagram', 'is', null)
      .order('id', { ascending: true })
      .range(fromLeads, fromLeads + pageSizeLeads - 1)

    if (error) {
      console.error('[instagram/comments/agregado-por-td-liderados] leads', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = (data ?? []) as LeadRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const igNorm = normalizeInstagramHandle(row.instagram)
      if (!igNorm) continue
      const td = tdTerritorialPorLeadRowLike(row)
      if (!td) continue
      if (!handleToTd.has(igNorm)) {
        handleToTd.set(igNorm, td)
      }
    }

    if (rows.length < pageSizeLeads) break
    fromLeads += pageSizeLeads
  }

  const porTdAcc = new Map<
    TerritorioDesenvolvimentoPI,
    {
      comentarios: number
      medias: Set<string>
      perfis: Set<string>
      tempoPostComentarioSomaMs: number
      tempoPostComentarioN: number
    }
  >()
  for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
    porTdAcc.set(td, {
      comentarios: 0,
      medias: new Set(),
      perfis: new Set(),
      tempoPostComentarioSomaMs: 0,
      tempoPostComentarioN: 0,
    })
  }
  const mediasGlobaisComVinculo = new Set<string>()

  let semComentarios = 0
  const semPerfis = new Set<string>()
  const comentariosContados = new Set<string>()

  const pageSizeComments = 1000
  let fromComments = 0
  for (;;) {
      const { data, error } = await admin
      .from('instagram_comments')
      .select('instagram_comment_id, commenter_username, instagram_media_id, media_posted_at, commented_at')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(fromComments, fromComments + pageSizeComments - 1)

    if (error) {
      console.error('[instagram/comments/agregado-por-td-liderados] comments', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const cid = (row as { instagram_comment_id: string }).instagram_comment_id
      if (!cid || comentariosContados.has(cid)) continue
      comentariosContados.add(cid)

      const u = normalizeInstagramHandle((row as { commenter_username: string | null }).commenter_username)
      if (!u) {
        semComentarios += 1
        continue
      }
      const td = handleToTd.get(u)
      if (!td) {
        semComentarios += 1
        semPerfis.add(u)
        continue
      }
      const acc = porTdAcc.get(td)
      if (acc) {
        acc.comentarios += 1
        acc.perfis.add(u)
        const mid = String((row as { instagram_media_id?: string | null }).instagram_media_id ?? '').trim()
        if (mid) {
          acc.medias.add(mid)
          mediasGlobaisComVinculo.add(mid)
        }
        const mediaPosted = (row as { media_posted_at?: string | null }).media_posted_at
        const commentedAt = (row as { commented_at?: string | null }).commented_at
        if (mediaPosted && commentedAt) {
          const t0 = new Date(mediaPosted).getTime()
          const t1 = new Date(commentedAt).getTime()
          if (Number.isFinite(t0) && Number.isFinite(t1)) {
            const delta = t1 - t0
            if (delta >= 0) {
              acc.tempoPostComentarioSomaMs += delta
              acc.tempoPostComentarioN += 1
            }
          }
        }
      }
    }

    if (rows.length < pageSizeComments) break
    fromComments += pageSizeComments
  }

  const porTd = mapaTdZero()
  for (const [td, acc] of porTdAcc) {
    porTd[td] = {
      comentarios: acc.comentarios,
      midiasComComentario: acc.medias.size,
      perfisUnicos: acc.perfis.size,
      tempoPostComentarioSomaMs: acc.tempoPostComentarioSomaMs,
      tempoPostComentarioN: acc.tempoPostComentarioN,
    }
  }

  const body: InstagramComentariosAgregadoPorTdLideradosResponse = {
    porTd,
    semVinculo: { comentarios: semComentarios, perfisUnicos: semPerfis.size },
    postagensProcessadas,
    midiasComComentarioVinculadas: mediasGlobaisComVinculo.size,
  }

  return NextResponse.json(body)
}
