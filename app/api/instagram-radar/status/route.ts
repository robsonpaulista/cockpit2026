import { NextResponse } from 'next/server'
import { getInstagramRadarCollectStatus } from '@/lib/instagram-radar-collect'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()

    const status = await getInstagramRadarCollectStatus(supabase)

    let message = ''
    if (!status.apifyConfigured && !status.ownAccountConfigured) {
      message =
        'Configure a coleta de concorrentes no servidor ou abra Redes & Instagram para gravar dados do Jadyel.'
    } else if (status.ownAccountConfigured && status.ownInstagramSource === 'metrics_history') {
      message = `Jadyel: dados da página Redes & Instagram (${status.ownInstagramPostsInHistory ?? 0} posts no histórico). Concorrentes: coleta automatizada.`
    } else if (status.canCollect) {
      message = `Coleta liberada · Jadyel via ${status.ownAccountConfigured ? 'conta autenticada/histórico ✓' : '—'} · concorrentes ${status.apifyConfigured ? '✓' : '(opcional)'}.`
    } else if (status.cooldownEnabled && !status.canCollect && status.nextCollectAt) {
      message = `Próxima coleta disponível em ${new Date(status.nextCollectAt).toLocaleString('pt-BR')}.`
    }

    return NextResponse.json({
      ...status,
      setupRequired: false,
      message,
    })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível. Aguarde alguns segundos e tente novamente.',
          retryable: true,
        },
        { status: 503 }
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao carregar status'
    if (msg.includes('does not exist') || msg.includes('42P01')) {
      return NextResponse.json({
        setupRequired: true,
        canCollect: false,
        message: 'Execute database/create-instagram-radar-tables.sql no Supabase.',
      })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
