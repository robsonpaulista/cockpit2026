import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import {
  getMunicipiosPorTerritorioDesenvolvimentoPI,
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'

export const dynamic = 'force-dynamic'

const TD_SET = new Set<string>(TERRITORIOS_DESENVOLVIMENTO_PI)

type CoordRow = { regiao: string | null }
type LeaderRow = {
  id: string
  nome: string
  telefone: string | null
  cidade: string | null
  municipio: string | null
  coordinators: CoordRow | CoordRow[] | null
}

function regiaoTdDeCoordJoin(C: CoordRow | CoordRow[] | null | undefined): TerritorioDesenvolvimentoPI | null {
  const coord = Array.isArray(C) ? C[0] : C
  const regiao = coord?.regiao?.trim() ?? ''
  if (!regiao || !TD_SET.has(regiao)) return null
  return regiao as TerritorioDesenvolvimentoPI
}

function extrairRegiaoTdLeader(row: LeaderRow): TerritorioDesenvolvimentoPI | null {
  return regiaoTdDeCoordJoin(row.coordinators)
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

export type LideradoNoMunicipioDto = {
  id: string
  nome: string
  whatsapp: string
  instagram: string | null
  cidade: string | null
  status: string
}

export type LiderNoMunicipioDto = {
  id: string
  nome: string
  telefone: string | null
  liderados: LideradoNoMunicipioDto[]
}

export type MobilizacaoLideresLideradosNoMunicipioResponse = {
  territorio: TerritorioDesenvolvimentoPI
  municipioOficial: string
  lideres: LiderNoMunicipioDto[]
}

export async function GET(request: Request) {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

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
        municipio,
        coordinators!inner ( regiao )
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
      const tdRow = extrairRegiaoTdLeader(row)
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
          })
        }
      }
    }
  }

  for (const arr of lidByLeader.values()) {
    arr.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  }

  const lideres: LiderNoMunicipioDto[] = lideresNoMun.map((L) => ({
    id: L.id,
    nome: L.nome,
    telefone: L.telefone,
    liderados: lidByLeader.get(L.id) ?? [],
  }))

  const body: MobilizacaoLideresLideradosNoMunicipioResponse = {
    territorio: td,
    municipioOficial: munOficial,
    lideres,
  }

  return NextResponse.json(body)
}
