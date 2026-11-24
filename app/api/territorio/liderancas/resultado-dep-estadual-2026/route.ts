import { NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { carregarVotacaoDeputados2026 } from '@/lib/services/votacao-deputados-2026-store'
import { buildLiderancasDepEstadual2026Rows } from '@/lib/territorio-campo/liderancas-dep-estadual-2026'
import { listAllTerritorioLiderancas } from '@/lib/territorio-liderancas-db'
import { resolveLiderancaEmDialogo } from '@/lib/territorio-lideranca-atual'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRouteUser()
  if (!auth.ok) return auth.response

  try {
    const [liderancasDb, votacao2026] = await Promise.all([
      listAllTerritorioLiderancas(),
      carregarVotacaoDeputados2026(),
    ])

    const fontes = liderancasDb.map((row) => {
      const liderancaAtual = String(row.lideranca_atual || '')
      return {
        id: Number(row.id),
        municipio: String(row.municipio || ''),
        nome: String(row.lideranca || ''),
        cargo: String(row.cargo_2024 || row.cargo_2020 || '-'),
        depEstadual: String(row.dep_estadual || ''),
        liderancaAtual,
        emDialogo: resolveLiderancaEmDialogo(liderancaAtual, row.em_dialogo),
      }
    })

    const rows = buildLiderancasDepEstadual2026Rows(fontes, votacao2026)

    return NextResponse.json({
      total: rows.length,
      comDepEstadual: rows.filter((r) => r.depEstadual).length,
      comMatch: rows.filter((r) => r.votos2026 != null).length,
      rows,
    })
  } catch (error) {
    console.error('[territorio/liderancas/resultado-dep-estadual-2026 GET]', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao cruzar lideranças com resultado dep. estadual 2026',
      },
      { status: 500 },
    )
  }
}
