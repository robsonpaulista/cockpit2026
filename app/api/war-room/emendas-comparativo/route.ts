import { NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { loadEmendasComparativoPi } from '@/lib/war-room/emendas-comparativo-pi-server'
import { filterEmendasComparativoPorAnos } from '@/lib/war-room/emendas-comparativo-pi'

export const dynamic = 'force-dynamic'

/**
 * GET /api/war-room/emendas-comparativo?anos=2023,2025  |  ?ano=todos|2024
 * Ranking da bancada federal do PI · Portal da Transparência (cache local).
 */
export async function GET(request: Request) {
  const auth = await requireRouteUser()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const anosParam = searchParams.get('anos')?.trim()
    const ano = searchParams.get('ano')?.trim() || 'todos'
    const payload = await loadEmendasComparativoPi()

    const anos = anosParam
      ? anosParam
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean)
      : ano === 'todos'
        ? []
        : [ano]

    const filtered = filterEmendasComparativoPorAnos(payload, anos)

    return NextResponse.json(filtered, {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error) {
    console.error('emendas-comparativo GET:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Falha ao carregar comparativo de emendas',
      },
      { status: 500 },
    )
  }
}
