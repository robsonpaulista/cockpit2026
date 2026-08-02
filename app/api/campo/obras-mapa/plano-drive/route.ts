import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import { listarPlanosDriveObras } from '@/lib/obras-mapa-plano-drive'

export const dynamic = 'force-dynamic'

/** Lista vínculos obra ↔ plano de trabalho no Drive. */
export async function GET() {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()
    const map = await listarPlanosDriveObras(supabase)
    const links = Array.from(map.values())

    return NextResponse.json({ links, count: links.length })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível.',
          retryable: true,
        },
        { status: 503 },
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao listar planos Drive'
    if (msg.includes('does not exist') || msg.includes('42P01')) {
      return NextResponse.json(
        {
          error:
            'Tabela obras_mapa_plano_drive ausente. Execute database/create-obras-mapa-plano-drive.sql no Supabase.',
          setupRequired: true,
          links: [],
          count: 0,
        },
        { status: 503 },
      )
    }
    console.error('[campo/obras-mapa/plano-drive GET]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
