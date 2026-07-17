import { NextResponse } from 'next/server'
import { buildCitySummariesFromDb } from '@/lib/territorio-liderancas-db'

export const dynamic = 'force-dynamic'

/** Total de Expectativa 2026 (cenário Legado) a partir de territorio_liderancas. */
export async function POST() {
  try {
    const { summaries } = await buildCitySummariesFromDb()
    let totalExpectativaVotos = 0
    for (const summary of summaries.values()) {
      totalExpectativaVotos += Number(summary.expectativaLegadoVotos || 0)
    }

    return NextResponse.json({
      fonte: 'db',
      cenarioPadrao: 'legado_anterior',
      total: Math.round(totalExpectativaVotos),
      formatted: Math.round(totalExpectativaVotos).toLocaleString('pt-BR'),
      totalCidades: summaries.size,
    })
  } catch (error: unknown) {
    console.error('Erro ao calcular Expectativa 2026 (DB):', error)
    const err = error as { message?: string }
    return NextResponse.json(
      { error: err.message || 'Erro ao processar expectativa de votos' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return POST()
}
