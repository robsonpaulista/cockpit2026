import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

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
    const resumo = summarizeLiderancasCargoPorCidade(rows)

    return NextResponse.json({ resumo, rows })
  } catch (error: unknown) {
    console.error('[territorio/liderancas-por-cargo-cidade]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
