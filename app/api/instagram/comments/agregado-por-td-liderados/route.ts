import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'

export const dynamic = 'force-dynamic'

const TD_SET = new Set<string>(TERRITORIOS_DESENVOLVIMENTO_PI)

type CoordRow = { regiao: string | null }
type LeaderJoin = { coordinators: CoordRow | CoordRow[] | null }
type LeadRow = { instagram: string | null; leaders: LeaderJoin | LeaderJoin[] | null }

function regiaoTdDeCoordJoin(C: CoordRow | CoordRow[] | null | undefined): TerritorioDesenvolvimentoPI | null {
  const coord = Array.isArray(C) ? C[0] : C
  const regiao = coord?.regiao?.trim() ?? ''
  if (!regiao || !TD_SET.has(regiao)) return null
  return regiao as TerritorioDesenvolvimentoPI
}

function extrairRegiaoTdLead(row: LeadRow): TerritorioDesenvolvimentoPI | null {
  const L = row.leaders
  const leader = Array.isArray(L) ? L[0] : L
  if (!leader) return null
  return regiaoTdDeCoordJoin(leader.coordinators)
}

export type InstagramComentariosPorTdAgg = {
  comentarios: number
  perfisUnicos: number
}

export type InstagramComentariosAgregadoPorTdLideradosResponse = {
  porTd: Record<string, InstagramComentariosPorTdAgg>
  semVinculo: InstagramComentariosPorTdAgg
  /** Mídias distintas com comentários sincronizados (postagens processadas na base). */
  postagensProcessadas: number
}

function mapaTdZero(): Record<string, InstagramComentariosPorTdAgg> {
  const porTd: Record<string, InstagramComentariosPorTdAgg> = {}
  for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
    porTd[td] = { comentarios: 0, perfisUnicos: 0 }
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
        leaders!inner (
          coordinators!inner ( regiao )
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
      const td = extrairRegiaoTdLead(row)
      if (!td) continue
      if (!handleToTd.has(igNorm)) {
        handleToTd.set(igNorm, td)
      }
    }

    if (rows.length < pageSizeLeads) break
    fromLeads += pageSizeLeads
  }

  const porTdAcc = new Map<TerritorioDesenvolvimentoPI, { comentarios: number; perfis: Set<string> }>()
  for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
    porTdAcc.set(td, { comentarios: 0, perfis: new Set() })
  }

  let semComentarios = 0
  const semPerfis = new Set<string>()
  const comentariosContados = new Set<string>()

  const pageSizeComments = 1000
  let fromComments = 0
  for (;;) {
    const { data, error } = await admin
      .from('instagram_comments')
      .select('instagram_comment_id, commenter_username')
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
      }
    }

    if (rows.length < pageSizeComments) break
    fromComments += pageSizeComments
  }

  const porTd = mapaTdZero()
  for (const [td, acc] of porTdAcc) {
    porTd[td] = { comentarios: acc.comentarios, perfisUnicos: acc.perfis.size }
  }

  const body: InstagramComentariosAgregadoPorTdLideradosResponse = {
    porTd,
    semVinculo: { comentarios: semComentarios, perfisUnicos: semPerfis.size },
    postagensProcessadas,
  }

  return NextResponse.json(body)
}
