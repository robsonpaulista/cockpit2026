import { NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import {
  buildLiderancasCargoPorCidade,
  summarizeLiderancasCargoPorCidade,
} from '@/lib/territorio-liderancas-cargo-por-cidade'
import { buildCitySummariesFromDb } from '@/lib/territorio-liderancas-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const { leadersByCity } = await buildCitySummariesFromDb()
    const rows = buildLiderancasCargoPorCidade(leadersByCity)
    const resumo = summarizeLiderancasCargoPorCidade(rows, leadersByCity)

    return NextResponse.json({ fonte: 'db', resumo, rows })
  } catch (error: unknown) {
    console.error('[territorio/liderancas-por-cargo-cidade]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
