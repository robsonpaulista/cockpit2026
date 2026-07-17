import { NextRequest, NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import {
  invalidateTerritorioLiderancasDbCache,
  listAllTerritorioLiderancas,
} from '@/lib/territorio-liderancas-db'
import {
  TERRITORIO_BASE_HEADERS,
  mapTerritorioLiderancaToBaseRecord,
} from '@/lib/territorio-base-records'

export const dynamic = 'force-dynamic'

/**
 * Base Eleitoral completa a partir de territorio_liderancas
 * (substitui POST /api/territorio/google-sheets na aba Base).
 */
export async function GET(request: NextRequest) {
  const auth = await requireRouteUser()
  if (!auth.ok) return auth.response

  try {
    const refresh = request.nextUrl.searchParams.get('refresh') === '1'
    if (refresh) invalidateTerritorioLiderancasDbCache()

    const rows = await listAllTerritorioLiderancas()
    const records = rows.map(mapTerritorioLiderancaToBaseRecord)

    return NextResponse.json({
      fonte: 'db',
      cenarioPadrao: 'legado_anterior',
      headers: [...TERRITORIO_BASE_HEADERS],
      records,
      total: records.length,
    })
  } catch (error) {
    console.error('[territorio/base GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar base territorial' },
      { status: 500 },
    )
  }
}
