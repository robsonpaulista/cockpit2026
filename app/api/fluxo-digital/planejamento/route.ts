import { NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { buildPlanejamentoFromAgenda } from '@/lib/fluxo-digital/agenda-planejamento'
import { supabaseNetworkErrorResponse } from '@/lib/supabase/network-error'

export const dynamic = 'force-dynamic'

/** Planejado do Fluxo Digital a partir da agenda (visitas). */
export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const de = searchParams.get('de') ?? undefined
    const ate = searchParams.get('ate') ?? undefined
    const limiteRaw = searchParams.get('limite')
    const limite = limiteRaw ? Number(limiteRaw) : undefined

    const data = await buildPlanejamentoFromAgenda({ de, ate, limite })
    return NextResponse.json(data)
  } catch (error: unknown) {
    const networkResponse = supabaseNetworkErrorResponse(error)
    if (networkResponse) return networkResponse
    console.error('[fluxo-digital/planejamento]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
