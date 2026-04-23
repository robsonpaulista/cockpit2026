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

export const dynamic = 'force-dynamic'

const TD_SET = new Set<string>(TERRITORIOS_DESENVOLVIMENTO_PI)

type CoordRow = { regiao: string | null }
type LeaderJoin = { cidade: string | null; municipio: string | null; coordinators: CoordRow | CoordRow[] | null }
type LeadRow = {
  cidade: string | null
  instagram: string | null
  status: string
  leaders: LeaderJoin | LeaderJoin[] | null
}
type LeaderRow = { cidade: string | null; municipio: string | null; coordinators: CoordRow | CoordRow[] | null }

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

function extrairRegiaoTdLeader(row: LeaderRow): TerritorioDesenvolvimentoPI | null {
  return regiaoTdDeCoordJoin(row.coordinators)
}

function cidadeLeadPreferida(row: LeadRow): string {
  const L = row.leaders
  const leader = Array.isArray(L) ? L[0] : L
  const raw =
    (typeof row.cidade === 'string' ? row.cidade.trim() : '') ||
    (leader?.municipio && String(leader.municipio).trim()) ||
    (leader?.cidade && String(leader.cidade).trim()) ||
    ''
  return raw
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

export type IgAgregadoMunicipioNoTd = {
  lideres: number
  liderados: number
  comentarios: number
  perfisUnicos: number
  /** Média aritmética (ms) dos intervalos publicação → comentário, quando ambas as datas existem. */
  tempoMedioPostComentarioMs: number | null
  /** Soma dos intervalos (ms) — para média global no rodapé. */
  tempoPostComentarioSomaMs: number
  /** Quantidade de comentários com `media_posted_at` e `commented_at` válidos na média deste município. */
  tempoPostComentarioN: number
}

export type InstagramIgPorMunicipioNoTdResponse = {
  territorio: TerritorioDesenvolvimentoPI
  porMunicipio: Record<string, IgAgregadoMunicipioNoTd>
}

export async function GET(request: Request) {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response
  const { userId } = ctx

  const { searchParams } = new URL(request.url)
  const tdRaw = (searchParams.get('td') ?? '').trim()
  if (!TD_SET.has(tdRaw)) {
    return NextResponse.json({ error: 'Território inválido' }, { status: 400 })
  }
  const td = tdRaw as TerritorioDesenvolvimentoPI

  const oficialMunicipios = [...getMunicipiosPorTerritorioDesenvolvimentoPI(td)]

  type Acc = {
    lideres: number
    liderados: number
    comentarios: number
    perfis: Set<string>
    tempoPostComentarioSomaMs: number
    tempoPostComentarioN: number
  }
  const porMun = new Map<string, Acc>()
  for (const nome of oficialMunicipios) {
    porMun.set(nome, {
      lideres: 0,
      liderados: 0,
      comentarios: 0,
      perfis: new Set(),
      tempoPostComentarioSomaMs: 0,
      tempoPostComentarioN: 0,
    })
  }

  const admin = createAdminClient()
  const pageSize = 1000

  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leads_militancia')
      .select(
        `
        cidade,
        status,
        leaders!inner (
          cidade,
          municipio,
          coordinators!inner ( regiao )
        )
      `
      )
      .eq('status', 'ativo')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[agregado-ig-por-municipio-no-td] leads contagem', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = (data ?? []) as LeadRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const tdRow = extrairRegiaoTdLead(row)
      if (tdRow !== td) continue
      const official = resolveOfficialMunicipio(cidadeLeadPreferida(row), oficialMunicipios)
      if (!official) continue
      const acc = porMun.get(official)
      if (acc) acc.liderados += 1
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leaders')
      .select(
        `
        cidade,
        municipio,
        coordinators!inner ( regiao )
      `
      )
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[agregado-ig-por-municipio-no-td] leaders contagem', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = (data ?? []) as LeaderRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const tdRow = extrairRegiaoTdLeader(row)
      if (tdRow !== td) continue
      const official = resolveOfficialMunicipio(cidadeLeaderPreferida(row), oficialMunicipios)
      if (!official) continue
      const acc = porMun.get(official)
      if (acc) acc.lideres += 1
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  const handleTo = new Map<string, { td: TerritorioDesenvolvimentoPI; municipioOficial: string }>()
  from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leads_militancia')
      .select(
        `
        instagram,
        cidade,
        status,
        leaders!inner (
          cidade,
          municipio,
          coordinators!inner ( regiao )
        )
      `
      )
      .eq('status', 'ativo')
      .not('instagram', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[agregado-ig-por-municipio-no-td] leads instagram', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = (data ?? []) as LeadRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const igNorm = normalizeInstagramHandle(row.instagram)
      if (!igNorm) continue
      const tdRow = extrairRegiaoTdLead(row)
      if (!tdRow) continue
      const official = resolveOfficialMunicipio(cidadeLeadPreferida(row), oficialMunicipios)
      if (!official) continue
      if (!handleTo.has(igNorm)) {
        handleTo.set(igNorm, { td: tdRow, municipioOficial: official })
      }
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  const comentariosContados = new Set<string>()
  from = 0
  for (;;) {
    const { data, error } = await admin
      .from('instagram_comments')
      .select('instagram_comment_id, commenter_username, media_posted_at, commented_at')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[agregado-ig-por-municipio-no-td] comments', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const cid = (row as { instagram_comment_id: string }).instagram_comment_id
      if (!cid || comentariosContados.has(cid)) continue
      comentariosContados.add(cid)

      const u = normalizeInstagramHandle((row as { commenter_username: string | null }).commenter_username)
      if (!u) continue
      const loc = handleTo.get(u)
      if (!loc || loc.td !== td) continue
      const acc = porMun.get(loc.municipioOficial)
      if (!acc) continue
      acc.comentarios += 1
      acc.perfis.add(u)

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

    if (rows.length < pageSize) break
    from += pageSize
  }

  const porMunicipio: Record<string, IgAgregadoMunicipioNoTd> = {}
  for (const nome of oficialMunicipios) {
    const a = porMun.get(nome)!
    const nT = a.tempoPostComentarioN
    porMunicipio[nome] = {
      lideres: a.lideres,
      liderados: a.liderados,
      comentarios: a.comentarios,
      perfisUnicos: a.perfis.size,
      tempoMedioPostComentarioMs: nT > 0 ? Math.round(a.tempoPostComentarioSomaMs / nT) : null,
      tempoPostComentarioSomaMs: a.tempoPostComentarioSomaMs,
      tempoPostComentarioN: nT,
    }
  }

  const body: InstagramIgPorMunicipioNoTdResponse = { territorio: td, porMunicipio }
  return NextResponse.json(body)
}
