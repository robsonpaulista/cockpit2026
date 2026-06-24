import { NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import {
  buildLiderancasCargoPorCidade,
  summarizeLiderancasCargoPorCidade,
} from '@/lib/territorio-liderancas-cargo-por-cidade'
import {
  buildCitySummaries,
  getTerritorioExpectativaSheetConfig,
  getTerritorioExpectativaSheetCredentials,
} from '@/lib/territorio-expectativa-sheet'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const { spreadsheetId, sheetName } = getTerritorioExpectativaSheetConfig({})
    const credentials = getTerritorioExpectativaSheetCredentials(undefined, 'territorio')

    if (!spreadsheetId || !sheetName || !credentials) {
      return NextResponse.json(
        { error: 'Planilha de Território & Base não configurada no servidor.', rows: [] },
        { status: 503 }
      )
    }

    const { leadersByCity } = await buildCitySummaries(spreadsheetId, sheetName, undefined, credentials)
    const rows = buildLiderancasCargoPorCidade(leadersByCity)
    const resumo = summarizeLiderancasCargoPorCidade(rows, leadersByCity)

    return NextResponse.json({ resumo, rows })
  } catch (error: unknown) {
    console.error('[territorio/liderancas-por-cargo-cidade]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
