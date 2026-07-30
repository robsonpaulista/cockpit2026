/**
 * Backup lógico do schema public (export via PostgREST / service role).
 * Usado pela rota de cron; o script CLI espelha a mesma ideia.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { gzipSync } from 'node:zlib'

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

export type BackupTableResult = {
  table: string
  rows: number
  bytes: number
  ok: boolean
  error?: string
}

export type BackupManifest = {
  createdAt: string
  projectUrl: string
  mode: 'standard' | 'full' | 'custom'
  durationMs: number
  stamp: string
  tables: BackupTableResult[]
  totals: {
    tablesOk: number
    tablesFail: number
    rows: number
    bytes: number
  }
}

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
    return { tables: options.tables, mode: 'custom' }
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

export async function ensureBackupBucket(
  supabase: ReturnType<typeof createAdminClient>,
  bucket = SUPABASE_BACKUP_BUCKET,
): Promise<void> {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw new Error(`listBuckets: ${error.message}`)
  if ((buckets || []).some((b) => b.name === bucket)) return
  const { error: createErr } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: '512MB',
  })
  if (createErr && !/already exists/i.test(createErr.message)) {
    throw new Error(`createBucket: ${createErr.message}`)
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const { tables, mode } = await resolveBackupTables(options)
  const stamp = stampNow()
  const started = Date.now()
  const results: BackupTableResult[] = []

  await ensureBackupBucket(supabase, bucket)

  for (const table of tables) {
    try {
      const rows = await fetchAllRows(supabase, table)
      const jsonl = rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')
      const gz = gzipSync(Buffer.from(jsonl, 'utf8'), { level: 9 })
      const remote = `${stamp}/tables/${table}.jsonl.gz`
      const { error } = await supabase.storage.from(bucket).upload(remote, gz, {
        contentType: 'application/gzip',
        upsert: true,
      })
      if (error) throw new Error(error.message)
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

  const { error: manErr } = await supabase.storage
    .from(bucket)
    .upload(`${stamp}/manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), {
      contentType: 'application/json',
      upsert: true,
    })
  if (manErr) throw new Error(`manifest upload: ${manErr.message}`)

  return manifest
}
