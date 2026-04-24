import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import { tdTerritorialPorLeadRowLike, tdTerritorialPorLeaderRowLike } from '@/lib/mobilizacao-td-por-municipio-leader'

export const dynamic = 'force-dynamic'

type LeaderJoin = { cidade: string | null; municipio: string | null }
type LeadRow = { cidade: string | null; leaders: LeaderJoin | LeaderJoin[] | null }
type LeaderRow = { cidade: string | null; municipio: string | null }

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
        cidade,
        leaders!inner (
          cidade,
          municipio
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
      const td = tdTerritorialPorLeadRowLike(row)
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
        cidade,
        municipio
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
      const td = tdTerritorialPorLeaderRowLike(row)
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
