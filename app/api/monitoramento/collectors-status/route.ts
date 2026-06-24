import { NextResponse } from 'next/server'
import { getMonitoramentoCollectorsStatus } from '@/lib/monitoramento-collectors-status'
import { requireRouteUser } from '@/lib/supabase/route-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    return NextResponse.json(getMonitoramentoCollectorsStatus())
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar coletores'
    console.error('[monitoramento/collectors-status]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
