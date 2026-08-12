import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron-auth'
import { runSupabaseBackupToStorage } from '@/lib/supabase-backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Cron de backup lógico → Supabase Storage (bucket db-backups).
 *
 * POST /api/cron/backup-supabase
 * Authorization: Bearer $CRON_SECRET
 *
 * Query:
 *   ?full=1  — inclui tabelas grandes (radar, votos…)
 */
export async function POST(request: Request) {
  try {
    const denied = assertCronAuthorized(request)
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const full = searchParams.get('full') === '1' || searchParams.get('full') === 'true'

    const manifest = await runSupabaseBackupToStorage({ full })

    return NextResponse.json({
      success: true,
      stamp: manifest.stamp,
      mode: manifest.mode,
      totals: manifest.totals,
      durationMs: manifest.durationMs,
      failures: manifest.tables.filter((t) => !t.ok).map((t) => ({
        table: t.table,
        error: t.error,
      })),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro no backup'
    console.error('[cron/backup-supabase]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
