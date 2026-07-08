import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import { carregarObrasJadyelLista, carregarObrasJadyelMapa } from '@/lib/jadyel-obras-mapa'
import type { JadyelObraPeriodo } from '@/lib/jadyel-obras-planilha'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const escopo = searchParams.get('escopo') ?? 'mapa'
    const periodo = (searchParams.get('periodo') ?? 'todos') as JadyelObraPeriodo | 'todos'

    const obras =
      escopo === 'lista'
        ? await carregarObrasJadyelLista(supabase, { incluirOutros: true, periodo })
        : await carregarObrasJadyelMapa(supabase)

    return NextResponse.json({
      obras,
      fonte: 'planilha-jadyel',
      total: obras.length,
    })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível. Aguarde alguns segundos e tente novamente.',
          retryable: true,
          obras: [],
        },
        { status: 503 }
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao carregar obras do mapa'
    console.error('[obras/mapa]', e)
    return NextResponse.json({ error: msg, obras: [] }, { status: 500 })
  }
}
