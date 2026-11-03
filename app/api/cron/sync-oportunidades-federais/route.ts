import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncOportunidadesFederais } from '@/lib/services/oportunidades-federais-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * POST /api/cron/sync-oportunidades-federais
 * Authorization: Bearer $CRON_SECRET
 *
 * Puxa programas discricionários abertos (PI) do Transferegov.
 */
export async function POST(request: Request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  try {
    const supabase = createAdminClient()
    const resultado = await syncOportunidadesFederais(supabase)
    if (!resultado.ok) {
      return NextResponse.json(resultado, { status: resultado.tableMissing ? 503 : 500 })
    }
    return NextResponse.json(resultado)
  } catch (e: unknown) {
    console.error('[cron/sync-oportunidades-federais]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
