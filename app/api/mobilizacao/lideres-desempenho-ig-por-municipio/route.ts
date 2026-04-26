import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import {
  getMunicipiosPorTerritorioDesenvolvimentoPI,
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import { tdTerritorialPorLeaderRowLike } from '@/lib/mobilizacao-td-por-municipio-leader'

export const dynamic = 'force-dynamic'

type LiderDesempenhoIgLinha = {
  id: string
  nome: string
  lideradosComRede: number
  publicacoes: number
  comentarios: number
  lideradosQueComentaram: number
  pctParticipacao: number
}

export type MobilizacaoLideresDesempenhoIgPorMunicipioResponse = {
  td: TerritorioDesenvolvimentoPI
  municipio: string
  postagensProcessadas: number
  lideres: LiderDesempenhoIgLinha[]
  totais: {
    lideres: number
    lideradosComRede: number
    publicacoesDistintas: number
    comentarios: number
    lideradosQueComentaramDistintos: number
    pctGeral: number
  }
}

const TD_SET = new Set<string>(TERRITORIOS_DESENVOLVIMENTO_PI)

type LeaderRow = {
  id: string
  nome: string | null
  cidade: string | null
  municipio: string | null
}

type LeaderJoin = {
  id: string
  nome: string | null
  cidade: string | null
  municipio: string | null
}
type LeadRow = {
  cidade: string | null
  instagram: string | null
  leaders: LeaderJoin | LeaderJoin[] | null
}

function cidadeLeaderPreferida(row: LeaderRow): string {
  const raw =
    (typeof row.municipio === 'string' ? row.municipio.trim() : '') ||
    (typeof row.cidade === 'string' ? row.cidade.trim() : '') ||
    ''
  return raw
}

function resolveOfficialMunicipio(raw: string, oficialList: readonly string[]): string | null {
  const n = normalizeMunicipioNome(raw)
  if (!n) return null
  for (const o of oficialList) {
    if (normalizeMunicipioNome(o) === n) return o
  }
  return null
}

export async function GET(request: Request) {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response
  const { userId } = ctx

  const { searchParams } = new URL(request.url)
  const tdRaw = (searchParams.get('td') ?? '').trim()
  const munParam = (searchParams.get('municipio') ?? '').trim()

  if (!tdRaw || !TD_SET.has(tdRaw)) {
    return NextResponse.json({ error: 'Parâmetro td inválido' }, { status: 400 })
  }
  if (!munParam) {
    return NextResponse.json({ error: 'Município obrigatório' }, { status: 400 })
  }

  const td = tdRaw as TerritorioDesenvolvimentoPI
  const oficialMunicipios = [...getMunicipiosPorTerritorioDesenvolvimentoPI(td)]
  const munOficial = resolveOfficialMunicipio(munParam, oficialMunicipios)
  if (!munOficial) {
    return NextResponse.json({ error: 'Município não encontrado neste TD' }, { status: 400 })
  }

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
      console.error('[mobilizacao/lideres-desempenho-ig-por-municipio] media ids', error)
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

  const lideresNoMun = new Map<string, string>()
  let fromLeaders = 0
  for (;;) {
    const { data, error } = await admin
      .from('leaders')
      .select(`id, nome, cidade, municipio`)
      .order('id', { ascending: true })
      .range(fromLeaders, fromLeaders + pageSize - 1)

    if (error) {
      console.error('[mobilizacao/lideres-desempenho-ig-por-municipio] leaders', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = (data ?? []) as LeaderRow[]
    if (rows.length === 0) break
    for (const row of rows) {
      const reg = tdTerritorialPorLeaderRowLike(row)
      if (reg !== td) continue
      const official = resolveOfficialMunicipio(cidadeLeaderPreferida(row), oficialMunicipios)
      if (official !== munOficial) continue
      const id = String(row.id ?? '').trim()
      if (!id) continue
      const nome = String(row.nome ?? '').trim() || '—'
      lideresNoMun.set(id, nome)
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
  for (const [id, nome] of lideresNoMun) {
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
        cidade,
        status,
        leaders!inner (
          id,
          nome,
          cidade,
          municipio
        )
      `
      )
      .eq('status', 'ativo')
      .not('instagram', 'is', null)
      .order('id', { ascending: true })
      .range(fromLeads, fromLeads + pageSize - 1)

    if (error) {
      console.error('[mobilizacao/lideres-desempenho-ig-por-municipio] leads', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = (data ?? []) as LeadRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const L = row.leaders
      const leader = Array.isArray(L) ? L[0] : L
      if (!leader?.id) continue
      const leaderId = String(leader.id).trim()
      if (!lideresNoMun.has(leaderId)) continue

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
      console.error('[mobilizacao/lideres-desempenho-ig-por-municipio] comments', error)
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

  const pubMun = unionMedia.size
  const pctGeral =
    postagensProcessadas > 0 ? Math.min(100, Math.round((pubMun / postagensProcessadas) * 1000) / 10) : 0

  const body: MobilizacaoLideresDesempenhoIgPorMunicipioResponse = {
    td,
    municipio: munOficial,
    postagensProcessadas,
    lideres,
    totais: {
      lideres: lideresNoMun.size,
      lideradosComRede: sumLiderados,
      publicacoesDistintas: pubMun,
      comentarios: sumComentarios,
      lideradosQueComentaramDistintos: unionCommenters.size,
      pctGeral,
    },
  }

  return NextResponse.json(body)
}
