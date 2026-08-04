/**
 * Backup lógico do schema public (export via PostgREST / service role).
 * Usado pela rota de cron; o script CLI espelha a mesma ideia.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { gzipSync } from 'node:zlib'
import type { BackupManifest, BackupRunSummary, BackupTableResult } from '@/lib/supabase-backup-types'
import { createZipStore } from '@/lib/zip-store'

export type { BackupManifest, BackupRunSummary, BackupTableResult } from '@/lib/supabase-backup-types'
export { formatBackupBytes } from '@/lib/supabase-backup-types'

export const SUPABASE_BACKUP_BUCKET = process.env.SUPABASE_BACKUP_BUCKET || 'db-backups'
export const BACKUP_PAGE_SIZE = 1000

/** Tabelas grandes — omitidas no modo standard (cron diário). */
export const SKIP_UNLESS_FULL = new Set([
  'instagram_comments',
  'instagram_post_metrics_history',
  'instagram_metrics_history',
  'instagram_publish_day_engagement',
  'google_news_mentions',
  'google_videos_mentions',
  'google_trends_interest',
  'google_trends_related',
  'youtube_mentions',
  'meta_ads_mentions',
  'meta_ads_collect_log',
  'votacao_secao_local',
  'federal_2018',
  'face_descriptors',
  'photos',
  'photo_tags',
  'sync_events',
])

/**
 * Sempre fora do backup (planilha importada / volume enorme).
 * Nem o modo full inclui.
 */
export const ALWAYS_SKIP_BACKUP = new Set(['votacao_secao_voto'])

export const FALLBACK_BACKUP_TABLES = [
  'profiles',
  'permissions',
  'cities',
  'agendas',
  'visits',
  'demands',
  'leaderships',
  'news',
  'adversaries',
  'narratives',
  'crises',
  'campaign_phases',
  'obras',
  'polls',
  'poll_reports',
  'emendas',
  'emendas_suas',
  'leads_militancia',
  'leaders',
  'chapas_partidos',
  'chapas_cenarios',
  'instagram_radar_posts',
  'instagram_post_classifications',
  'publicacoes_conteudo',
  'conteudos_planejados',
  'users',
  'persons',
] as const

function stampNow(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  )
}

export async function listPublicTablesFromOpenApi(
  url: string,
  key: string,
): Promise<string[]> {
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/openapi+json',
    },
  })
  if (!res.ok) {
    throw new Error(`OpenAPI ${res.status}`)
  }
  const spec = (await res.json()) as { paths?: Record<string, unknown> }
  const paths = spec.paths || {}
  return [
    ...new Set(
      Object.keys(paths)
        .map((p) => p.replace(/^\//, ''))
        .filter((name) => name && !name.includes('{') && !name.includes('/')),
    ),
  ].sort()
}

export async function resolveBackupTables(options: {
  full?: boolean
  tables?: string[]
}): Promise<{ tables: string[]; mode: BackupManifest['mode'] }> {
  if (options.tables?.length) {
    return {
      tables: options.tables.filter((t) => !ALWAYS_SKIP_BACKUP.has(t)),
      mode: 'custom',
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  let tables: string[] = [...FALLBACK_BACKUP_TABLES]

  if (url && key) {
    try {
      tables = await listPublicTablesFromOpenApi(url, key)
    } catch {
      // fallback já definido
    }
  }

  tables = tables.filter((t) => !ALWAYS_SKIP_BACKUP.has(t))

  if (!options.full) {
    tables = tables.filter((t) => !SKIP_UNLESS_FULL.has(t))
    return { tables, mode: 'standard' }
  }
  return { tables, mode: 'full' }
}

async function fetchAllRows(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + BACKUP_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data || []) as Record<string, unknown>[]
    rows.push(...page)
    if (page.length < BACKUP_PAGE_SIZE) break
    from += BACKUP_PAGE_SIZE
  }
  return rows
}

/** Máx. Free plan / seguro vs global do projeto — não pode superar o limite global. */
const BACKUP_BUCKET_FILE_SIZE_LIMIT = 50 * 1024 * 1024

export async function ensureBackupBucket(
  supabase: ReturnType<typeof createAdminClient>,
  bucket = SUPABASE_BACKUP_BUCKET,
): Promise<void> {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw new Error(`listBuckets: ${error.message}`)
  if ((buckets || []).some((b) => b.name === bucket)) return

  // Sem fileSizeLimit alto: 512MB falha se o global do projeto for menor (ex.: Free 50MB).
  let { error: createErr } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: BACKUP_BUCKET_FILE_SIZE_LIMIT,
  })

  if (createErr && /exceeded the maximum allowed size|file.?size/i.test(createErr.message)) {
    ;({ error: createErr } = await supabase.storage.createBucket(bucket, {
      public: false,
    }))
  }

  if (createErr && !/already exists/i.test(createErr.message)) {
    throw new Error(`createBucket: ${createErr.message}`)
  }
}

/**
 * Exporta tabelas em memória (JSONL.gz + manifest) — sem Storage.
 */
export async function buildSupabaseBackupFiles(options: {
  full?: boolean
  tables?: string[]
}): Promise<{
  stamp: string
  mode: BackupManifest['mode']
  manifest: BackupManifest
  files: Array<{ path: string; data: Buffer }>
}> {
  const supabase = createAdminClient()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const { tables, mode } = await resolveBackupTables(options)
  const stamp = stampNow()
  const started = Date.now()
  const results: BackupTableResult[] = []
  const files: Array<{ path: string; data: Buffer }> = []

  for (const table of tables) {
    try {
      const rows = await fetchAllRows(supabase, table)
      const jsonl = rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')
      const gz = gzipSync(Buffer.from(jsonl, 'utf8'), { level: 9 })
      files.push({ path: `tables/${table}.jsonl.gz`, data: gz })
      results.push({ table, rows: rows.length, bytes: gz.length, ok: true })
    } catch (err) {
      results.push({
        table,
        rows: 0,
        bytes: 0,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const manifest: BackupManifest = {
    createdAt: new Date().toISOString(),
    projectUrl: url,
    mode,
    durationMs: Date.now() - started,
    stamp,
    tables: results,
    totals: {
      tablesOk: results.filter((r) => r.ok).length,
      tablesFail: results.filter((r) => !r.ok).length,
      rows: results.reduce((s, r) => s + r.rows, 0),
      bytes: results.reduce((s, r) => s + r.bytes, 0),
    },
  }

  files.unshift({
    path: 'manifest.json',
    data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'),
  })

  return { stamp, mode, manifest, files }
}

/**
 * Gera ZIP para download local (sem Storage).
 */
export async function buildSupabaseBackupZip(options: {
  full?: boolean
  tables?: string[]
}): Promise<{
  filename: string
  zip: Buffer
  manifest: BackupManifest
}> {
  const { stamp, manifest, files } = await buildSupabaseBackupFiles(options)
  const zip = createZipStore(
    files.map((f) => ({ path: `${stamp}/${f.path}`, data: f.data })),
  )
  return {
    filename: `supabase-backup-${stamp}-${manifest.mode}.zip`,
    zip,
    manifest,
  }
}

/**
 * Exporta tabelas e envia JSONL.gz + manifest para o Storage.
 */
export async function runSupabaseBackupToStorage(options: {
  full?: boolean
  tables?: string[]
  bucket?: string
}): Promise<BackupManifest> {
  const supabase = createAdminClient()
  const bucket = options.bucket || SUPABASE_BACKUP_BUCKET
  const { stamp, manifest, files } = await buildSupabaseBackupFiles(options)

  await ensureBackupBucket(supabase, bucket)

  for (const file of files) {
    const remote = `${stamp}/${file.path}`
    const contentType = file.path.endsWith('.json')
      ? 'application/json'
      : 'application/gzip'
    const { error } = await supabase.storage.from(bucket).upload(remote, file.data, {
      contentType,
      upsert: true,
    })
    if (error) {
      if (file.path === 'manifest.json') {
        throw new Error(`manifest upload: ${error.message}`)
      }
      const table = file.path.replace(/^tables\//, '').replace(/\.jsonl\.gz$/, '')
      const row = manifest.tables.find((t) => t.table === table)
      if (row) {
        row.ok = false
        row.error = error.message
        row.rows = 0
        row.bytes = 0
      }
    }
  }

  const updated: BackupManifest = {
    ...manifest,
    totals: {
      tablesOk: manifest.tables.filter((r) => r.ok).length,
      tablesFail: manifest.tables.filter((r) => !r.ok).length,
      rows: manifest.tables.reduce((s, r) => s + r.rows, 0),
      bytes: manifest.tables.reduce((s, r) => s + r.bytes, 0),
    },
  }

  if (updated.totals.tablesFail > 0) {
    const { error: manErr } = await supabase.storage.from(bucket).upload(
      `${stamp}/manifest.json`,
      Buffer.from(JSON.stringify(updated, null, 2), 'utf8'),
      { contentType: 'application/json', upsert: true },
    )
    if (manErr) throw new Error(`manifest upload: ${manErr.message}`)
  }

  return updated
}

const STAMP_FOLDER_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/

/**
 * Lista pastas de backup no Storage (mais recentes primeiro) e lê o manifest.
 */
export async function listSupabaseBackupRuns(options?: {
  limit?: number
  bucket?: string
}): Promise<BackupRunSummary[]> {
  const supabase = createAdminClient()
  const bucket = options?.bucket || SUPABASE_BACKUP_BUCKET
  const limit = options?.limit ?? 40

  await ensureBackupBucket(supabase, bucket)

  const { data: entries, error } = await supabase.storage.from(bucket).list('', {
    limit: 100,
    sortBy: { column: 'name', order: 'desc' },
  })
  if (error) throw new Error(error.message)

  const stamps = (entries || [])
    .map((e) => e.name)
    .filter((name) => STAMP_FOLDER_RE.test(name))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, limit)

  const runs: BackupRunSummary[] = []
  for (const stamp of stamps) {
    const { data, error: dlErr } = await supabase.storage
      .from(bucket)
      .download(`${stamp}/manifest.json`)
    if (dlErr || !data) {
      runs.push({
        stamp,
        createdAt: null,
        mode: null,
        durationMs: null,
        totals: null,
        hasManifest: false,
      })
      continue
    }
    try {
      const manifest = JSON.parse(await data.text()) as BackupManifest
      runs.push({
        stamp,
        createdAt: manifest.createdAt ?? null,
        mode: manifest.mode ?? null,
        durationMs: manifest.durationMs ?? null,
        totals: manifest.totals ?? null,
        hasManifest: true,
      })
    } catch {
      runs.push({
        stamp,
        createdAt: null,
        mode: null,
        durationMs: null,
        totals: null,
        hasManifest: false,
      })
    }
  }
  return runs
}
