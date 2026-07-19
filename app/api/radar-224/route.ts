import { NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { buildRadar224TopMunicipios } from '@/lib/radar-224/build-radar-224'

export const dynamic = 'force-dynamic'

/** Visão agregada Radar 224 (top 50 + fontes seed). */
export async function GET(request: Request) {
  const auth = await requireRouteUser()
  if (!auth.ok) return auth.response

  try {
    const url = new URL(request.url)
    const refresh = url.searchParams.get('refresh') === '1'
    const topNRaw = Number(url.searchParams.get('top') || 50)
    const topN = Number.isFinite(topNRaw) ? Math.min(Math.max(Math.round(topNRaw), 10), 224) : 50

    const data = await buildRadar224TopMunicipios({ topN, forceRefresh: refresh })

    return NextResponse.json({
      ok: true,
      fonteExpectativa: 'territorio_liderancas',
      cenarioPadrao: 'legado_anterior',
      ...data,
    })
  } catch (error) {
    console.error('[radar-224 GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao montar Radar 224' },
      { status: 500 },
    )
  }
}
