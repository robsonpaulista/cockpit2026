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
type LeaderJoin = {
  id: string
  nome: string | null
  coordinators: CoordRow | CoordRow[] | null
}
type LeadRow = {
  instagram: string | null
  leaders: LeaderJoin | LeaderJoin[] | null
}
type LeaderRow = {
  id: string
  nome: string | null
  coordinators: CoordRow | CoordRow[] | null
}

function regiaoTdDeCoord(C: CoordRow | CoordRow[] | null | undefined): TerritorioDesenvolvimentoPI | null {
  const coord = Array.isArray(C) ? C[0] : C
  const regiao = coord?.regiao?.trim() ?? ''
  if (!regiao || !TD_SET.has(regiao)) return null
  return regiao as TerritorioDesenvolvimentoPI
}

export type LiderDesempenhoIgLinha = {
  id: string
  nome: string
  lideradosComRede: number
  publicacoes: number
  comentarios: number
  lideradosQueComentaram: number
  /** Mídias distintas com comentário do grupo ÷ publicações processadas na conta × 100. */
  pctParticipacao: number
}

export type MobilizacaoLideresDesempenhoIgPorTdResponse = {
  td: TerritorioDesenvolvimentoPI
  /** Total de mídias distintas com comentários sincronizados na conta (mesmo critério do resumo por TD). */
  postagensProcessadas: number
  lideres: LiderDesempenhoIgLinha[]
  totais: {
    lideres: number
    lideradosComRede: number
    publicacoesDistintas: number
    comentarios: number
    lideradosQueComentaramDistintos: number
    /** Mídias distintas do TD com engajamento de liderados ÷ `postagensProcessadas` × 100. */
    pctGeral: number
  }
}

export async function GET(request: Request) {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response
  const { userId } = ctx

  const { searchParams } = new URL(request.url)
  const tdRaw = (searchParams.get('td') ?? '').trim()
  if (!tdRaw || !TD_SET.has(tdRaw)) {
    return NextResponse.json({ error: 'Parâmetro td inválido' }, { status: 400 })
  }
  const td = tdRaw as TerritorioDesenvolvimentoPI

  const admin = createAdminClient()
  const pageSize = 1000

  const mediaIdsGlobal = new Set<string>()
  let fromMedia = 0
  for (;;) {
    const { data, error } = await admin
      .from('instagram_comments')
      .select('instagram_media_id')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(fromMedia, fromMedia + pageSize - 1)

    if (error) {
      console.error('[mobilizacao/lideres-desempenho-ig-por-td] media ids', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = data ?? []
    if (rows.length === 0) break
    for (const row of rows) {
      const mid = String((row as { instagram_media_id?: string }).instagram_media_id ?? '').trim()
      if (mid) mediaIdsGlobal.add(mid)
    }
    if (rows.length < pageSize) break
    fromMedia += pageSize
  }
  const postagensProcessadas = mediaIdsGlobal.size

  const lideresNoTd = new Map<string, string>()
  let fromLeaders = 0
  for (;;) {
    const { data, error } = await admin
      .from('leaders')
      .select(
        `
        id,
        nome,
        coordinators!inner ( regiao )
      `
      )
      .order('id', { ascending: true })
      .range(fromLeaders, fromLeaders + pageSize - 1)

    if (error) {
      console.error('[mobilizacao/lideres-desempenho-ig-por-td] leaders', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = (data ?? []) as LeaderRow[]
    if (rows.length === 0) break
    for (const row of rows) {
      const reg = regiaoTdDeCoord(row.coordinators)
      if (reg !== td) continue
      const id = String(row.id ?? '').trim()
      if (!id) continue
      const nome = String(row.nome ?? '').trim() || '—'
      lideresNoTd.set(id, nome)
    }
    if (rows.length < pageSize) break
    fromLeaders += pageSize
  }

  type AccLider = {
    nome: string
    handles: Set<string>
    medias: Set<string>
    comentarios: number
    commenters: Set<string>
  }

  const porLider = new Map<string, AccLider>()
  for (const [id, nome] of lideresNoTd) {
    porLider.set(id, {
      nome,
      handles: new Set(),
      medias: new Set(),
      comentarios: 0,
      commenters: new Set(),
    })
  }

  const handleParaLider = new Map<string, string>()
  let fromLeads = 0
  for (;;) {
    const { data, error } = await admin
      .from('leads_militancia')
      .select(
        `
        instagram,
        status,
        leaders!inner (
          id,
          nome,
          coordinators!inner ( regiao )
        )
      `
      )
      .eq('status', 'ativo')
      .not('instagram', 'is', null)
      .order('id', { ascending: true })
      .range(fromLeads, fromLeads + pageSize - 1)

    if (error) {
      console.error('[mobilizacao/lideres-desempenho-ig-por-td] leads', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = (data ?? []) as LeadRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const L = row.leaders
      const leader = Array.isArray(L) ? L[0] : L
      if (!leader?.id) continue
      const reg = regiaoTdDeCoord(leader.coordinators)
      if (reg !== td) continue
      const leaderId = String(leader.id).trim()
      if (!lideresNoTd.has(leaderId)) continue

      const h = normalizeInstagramHandle(row.instagram)
      if (!h) continue

      let acc = porLider.get(leaderId)
      if (!acc) {
        acc = {
          nome: String(leader.nome ?? '').trim() || '—',
          handles: new Set(),
          medias: new Set(),
          comentarios: 0,
          commenters: new Set(),
        }
        porLider.set(leaderId, acc)
      }
      acc.handles.add(h)
      if (!handleParaLider.has(h)) {
        handleParaLider.set(h, leaderId)
      }
    }

    if (rows.length < pageSize) break
    fromLeads += pageSize
  }

  const comentariosContados = new Set<string>()
  let fromComments = 0
  for (;;) {
    const { data, error } = await admin
      .from('instagram_comments')
      .select('instagram_comment_id, commenter_username, instagram_media_id')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(fromComments, fromComments + pageSize - 1)

    if (error) {
      console.error('[mobilizacao/lideres-desempenho-ig-por-td] comments', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const cid = String((row as { instagram_comment_id?: string }).instagram_comment_id ?? '').trim()
      if (!cid || comentariosContados.has(cid)) continue
      comentariosContados.add(cid)

      const u = normalizeInstagramHandle((row as { commenter_username: string | null }).commenter_username)
      if (!u) continue
      const leaderId = handleParaLider.get(u)
      if (!leaderId) continue
      const acc = porLider.get(leaderId)
      if (!acc) continue

      acc.comentarios += 1
      acc.commenters.add(u)
      const mid = String((row as { instagram_media_id?: string }).instagram_media_id ?? '').trim()
      if (mid) acc.medias.add(mid)
    }

    if (rows.length < pageSize) break
    fromComments += pageSize
  }

  const lideres: LiderDesempenhoIgLinha[] = [...porLider.entries()].map(([id, acc]) => {
    const nLid = acc.handles.size
    const nCom = acc.commenters.size
    const nPub = acc.medias.size
    const pct =
      postagensProcessadas > 0 ? Math.min(100, (nPub / postagensProcessadas) * 100) : 0
    return {
      id,
      nome: acc.nome,
      lideradosComRede: nLid,
      publicacoes: nPub,
      comentarios: acc.comentarios,
      lideradosQueComentaram: nCom,
      pctParticipacao: Math.round(pct * 10) / 10,
    }
  })

  lideres.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  const unionMedia = new Set<string>()
  const unionCommenters = new Set<string>()
  let sumComentarios = 0
  let sumLiderados = 0
  for (const acc of porLider.values()) {
    sumComentarios += acc.comentarios
    sumLiderados += acc.handles.size
    for (const m of acc.medias) unionMedia.add(m)
    for (const c of acc.commenters) unionCommenters.add(c)
  }

  const pubTd = unionMedia.size
  const pctGeral =
    postagensProcessadas > 0 ? Math.min(100, Math.round((pubTd / postagensProcessadas) * 1000) / 10) : 0

  const body: MobilizacaoLideresDesempenhoIgPorTdResponse = {
    td,
    postagensProcessadas,
    lideres,
    totais: {
      lideres: lideresNoTd.size,
      lideradosComRede: sumLiderados,
      publicacoesDistintas: pubTd,
      comentarios: sumComentarios,
      lideradosQueComentaramDistintos: unionCommenters.size,
      pctGeral,
    },
  }

  return NextResponse.json(body)
}
