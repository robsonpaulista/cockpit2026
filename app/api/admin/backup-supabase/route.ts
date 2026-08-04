import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureAdmin } from '@/lib/auth-admin'
import {
  buildSupabaseBackupZip,
  listSupabaseBackupRuns,
  runSupabaseBackupToStorage,
  SUPABASE_BACKUP_BUCKET,
} from '@/lib/supabase-backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Admin: listar backups no Storage, enviar ao Storage ou baixar ZIP local.
 *
 * GET  /api/admin/backup-supabase
 * POST /api/admin/backup-supabase
 *   body: { full?: boolean, download?: boolean, upload?: boolean }
 *   - download=true → ZIP (application/zip)
 *   - upload=true (ou só full) → grava no Storage e devolve JSON
 */
export async function GET() {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    try {
      const runs = await listSupabaseBackupRuns({ limit: 40 })
      return NextResponse.json({
        bucket: SUPABASE_BACKUP_BUCKET,
        runs,
      })
    } catch (listErr: unknown) {
      const message =
        listErr instanceof Error ? listErr.message : 'Erro ao listar backups no Storage'
      return NextResponse.json({
        bucket: SUPABASE_BACKUP_BUCKET,
        runs: [],
        listError: message,
      })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao listar backups'
    console.error('[admin/backup-supabase] GET', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    let full = false
    let download = false
    let upload = false
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => ({}))) as {
        full?: boolean
        download?: boolean
        upload?: boolean
      }
      full = Boolean(body.full)
      download = Boolean(body.download)
      upload = Boolean(body.upload)
    } else {
      const { searchParams } = new URL(request.url)
      full = searchParams.get('full') === '1' || searchParams.get('full') === 'true'
      download =
        searchParams.get('download') === '1' || searchParams.get('download') === 'true'
      upload = searchParams.get('upload') === '1' || searchParams.get('upload') === 'true'
    }

    // Default: download local (sem Storage). Upload só se pedido.
    if (download || !upload) {
      const { filename, zip, manifest } = await buildSupabaseBackupZip({ full })
      return new NextResponse(new Uint8Array(zip), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(zip.length),
          'X-Backup-Stamp': manifest.stamp,
          'X-Backup-Mode': manifest.mode,
          'X-Backup-Tables-Ok': String(manifest.totals.tablesOk),
          'X-Backup-Tables-Fail': String(manifest.totals.tablesFail),
          'X-Backup-Rows': String(manifest.totals.rows),
          'X-Backup-Bytes': String(manifest.totals.bytes),
          'X-Backup-Duration-Ms': String(manifest.durationMs),
        },
      })
    }

    const manifest = await runSupabaseBackupToStorage({ full })

    return NextResponse.json({
      success: true,
      stamp: manifest.stamp,
      mode: manifest.mode,
      totals: manifest.totals,
      durationMs: manifest.durationMs,
      failures: manifest.tables
        .filter((t) => !t.ok)
        .map((t) => ({ table: t.table, error: t.error })),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro no backup'
    console.error('[admin/backup-supabase] POST', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
