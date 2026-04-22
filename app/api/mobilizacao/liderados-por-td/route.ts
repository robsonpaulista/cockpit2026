import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'

export const dynamic = 'force-dynamic'

const TD_SET = new Set<string>(TERRITORIOS_DESENVOLVIMENTO_PI)

type CoordRow = { regiao: string | null }
type LeaderJoin = { coordinators: CoordRow | CoordRow[] | null }
type LeadRow = { leaders: LeaderJoin | LeaderJoin[] | null }
/** Linha da tabela `leaders` com join em `coordinators`. */
type LeaderRow = { coordinators: CoordRow | CoordRow[] | null }

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

function mapaContagemZero(): Map<TerritorioDesenvolvimentoPI, number> {
  const m = new Map<TerritorioDesenvolvimentoPI, number>()
  for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
    m.set(td, 0)
  }
  return m
}

function recordFromMap(counts: Map<TerritorioDesenvolvimentoPI, number>): Record<string, number> {
  const porTd: Record<string, number> = {}
  for (const [td, n] of counts) {
    porTd[td] = n
  }
  return porTd
}

export async function GET() {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

  const admin = createAdminClient()
  const countsLiderados = mapaContagemZero()

  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leads_militancia')
      .select(
        `
        id,
        leaders!inner (
          coordinators!inner ( regiao )
        )
      `
      )
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[mobilizacao/liderados-por-td] leads', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = (data ?? []) as LeadRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const td = extrairRegiaoTdLead(row)
      if (!td) continue
      countsLiderados.set(td, (countsLiderados.get(td) ?? 0) + 1)
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  const countsLideres = mapaContagemZero()
  from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leaders')
      .select(
        `
        id,
        coordinators!inner ( regiao )
      `
      )
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[mobilizacao/liderados-por-td] leaders', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = (data ?? []) as LeaderRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const td = extrairRegiaoTdLeader(row)
      if (!td) continue
      countsLideres.set(td, (countsLideres.get(td) ?? 0) + 1)
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return NextResponse.json({
    porTd: recordFromMap(countsLiderados),
    lideresPorTd: recordFromMap(countsLideres),
  })
}
