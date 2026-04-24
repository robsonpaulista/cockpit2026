import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import type {
  LideradoNoMunicipioDto,
  LiderNoMunicipioDto,
  MobilizacaoLideresLideradosNoMunicipioPayload,
} from '@/lib/mobilizacao-lideres-liderados-municipio-client'
import {
  getMunicipiosPorTerritorioDesenvolvimentoPI,
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import { tdTerritorialPorLeaderRowLike } from '@/lib/mobilizacao-td-por-municipio-leader'

export const dynamic = 'force-dynamic'

const TD_SET = new Set<string>(TERRITORIOS_DESENVOLVIMENTO_PI)

type LeaderRow = {
  id: string
  nome: string
  telefone: string | null
  cidade: string | null
  municipio: string | null
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

  if (!TD_SET.has(tdRaw)) {
    return NextResponse.json({ error: 'Território inválido' }, { status: 400 })
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
  const lideresNoMun: LeaderRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leaders')
      .select(
        `
        id,
        nome,
        telefone,
        cidade,
        municipio
      `
      )
      .order('nome', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[lideres-liderados-no-municipio] leaders', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = (data ?? []) as LeaderRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const tdRow = tdTerritorialPorLeaderRowLike(row)
      if (tdRow !== td) continue
      const official = resolveOfficialMunicipio(cidadeLeaderPreferida(row), oficialMunicipios)
      if (official !== munOficial) continue
      lideresNoMun.push(row)
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  lideresNoMun.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  const leaderIds = lideresNoMun.map((l) => l.id)
  const lidByLeader = new Map<string, LideradoNoMunicipioDto[]>()
  for (const id of leaderIds) {
    lidByLeader.set(id, [])
  }

  if (leaderIds.length > 0) {
    const chunk = 80
    for (let i = 0; i < leaderIds.length; i += chunk) {
      const slice = leaderIds.slice(i, i + chunk)
      const { data, error } = await admin
        .from('leads_militancia')
        .select('id, nome, whatsapp, instagram, cidade, status, leader_id')
        .eq('status', 'ativo')
        .in('leader_id', slice)

      if (error) {
        console.error('[lideres-liderados-no-municipio] leads', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      for (const r of data ?? []) {
        const lid = r as {
          id: string
          nome: string
          whatsapp: string
          instagram: string | null
          cidade: string | null
          status: string
          leader_id: string
        }
        const arr = lidByLeader.get(lid.leader_id)
        if (arr) {
          arr.push({
            id: lid.id,
            nome: lid.nome,
            whatsapp: lid.whatsapp,
            instagram: lid.instagram,
            cidade: lid.cidade,
            status: lid.status,
            comentarios: 0,
            perfisUnicos: 0,
            tempoMedioPostComentarioMs: null,
          })
        }
      }
    }
  }

  for (const arr of lidByLeader.values()) {
    arr.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  }

  const handleNormSet = new Set<string>()
  for (const arr of lidByLeader.values()) {
    for (const row of arr) {
      const h = normalizeInstagramHandle(row.instagram)
      if (h) handleNormSet.add(h)
    }
  }

  if (handleNormSet.size > 0) {
    const comentariosPorHandle = new Map<string, number>()
    const delayAccPorHandle = new Map<string, { sumMs: number; n: number }>()
    for (const h of handleNormSet) {
      comentariosPorHandle.set(h, 0)
      delayAccPorHandle.set(h, { sumMs: 0, n: 0 })
    }
    const comentariosContados = new Set<string>()
    const pageSizeComments = 1000
    let fromComments = 0
    for (;;) {
      const { data, error } = await admin
        .from('instagram_comments')
        .select('instagram_comment_id, commenter_username, media_posted_at, commented_at')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .range(fromComments, fromComments + pageSizeComments - 1)

      if (error) {
        console.error('[lideres-liderados-no-municipio] comments', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      const rows = data ?? []
      if (rows.length === 0) break

      for (const row of rows) {
        const cid = String((row as { instagram_comment_id?: string }).instagram_comment_id ?? '').trim()
        if (!cid || comentariosContados.has(cid)) continue
        comentariosContados.add(cid)

        const u = normalizeInstagramHandle((row as { commenter_username: string | null }).commenter_username)
        if (!u || !handleNormSet.has(u)) continue
        comentariosPorHandle.set(u, (comentariosPorHandle.get(u) ?? 0) + 1)

        const mediaPosted = (row as { media_posted_at?: string | null }).media_posted_at
        const commentedAt = (row as { commented_at?: string | null }).commented_at
        if (mediaPosted && commentedAt) {
          const t0 = new Date(mediaPosted).getTime()
          const t1 = new Date(commentedAt).getTime()
          if (Number.isFinite(t0) && Number.isFinite(t1)) {
            const delta = t1 - t0
            if (delta >= 0) {
              const acc = delayAccPorHandle.get(u)
              if (acc) {
                acc.sumMs += delta
                acc.n += 1
              }
            }
          }
        }
      }

      if (rows.length < pageSizeComments) break
      fromComments += pageSizeComments
    }

    for (const arr of lidByLeader.values()) {
      for (const row of arr) {
        const h = normalizeInstagramHandle(row.instagram)
        const c = h ? (comentariosPorHandle.get(h) ?? 0) : 0
        row.comentarios = c
        row.perfisUnicos = h && c > 0 ? 1 : 0
        const acc = h ? delayAccPorHandle.get(h) : undefined
        row.tempoMedioPostComentarioMs =
          acc && acc.n > 0 ? Math.round(acc.sumMs / acc.n) : null
      }
    }
  }

  const lideres: LiderNoMunicipioDto[] = lideresNoMun.map((L) => ({
    id: L.id,
    nome: L.nome,
    telefone: L.telefone,
    liderados: lidByLeader.get(L.id) ?? [],
  }))

  const body: MobilizacaoLideresLideradosNoMunicipioPayload = {
    territorio: td,
    municipioOficial: munOficial,
    lideres,
  }

  return NextResponse.json(body)
}
