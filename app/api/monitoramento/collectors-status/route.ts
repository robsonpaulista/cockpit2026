import { NextResponse } from 'next/server'
import { getMonitoramentoCollectorsStatus } from '@/lib/monitoramento-collectors-status'
import { createClient } from '@/lib/supabase/server'

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

    return NextResponse.json(getMonitoramentoCollectorsStatus())
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar coletores'
    console.error('[monitoramento/collectors-status]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
