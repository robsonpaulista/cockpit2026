#!/usr/bin/env node
/**
 * Backup lógico das tabelas public do Supabase (JSONL.gz por tabela).
 *
 * Usa a service role (mesmo padrão dos outros scripts). Não precisa de pg_dump.
 *
 * Uso:
 *   npm run db:backup
 *   npm run db:backup -- --keep=14
 *   npm run db:backup -- --tables=obras,polls,cities
 *   npm run db:backup -- --upload
 *   npm run db:backup -- --dry-run
 *
 * Requer .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Opcional:
 *   SUPABASE_BACKUP_BUCKET  (default: db-backups) — só com --upload
 */
import { createClient } from '@supabase/supabase-js'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.local')
const BACKUPS_ROOT = join(root, 'backups', 'supabase')
const PAGE_SIZE = 1000
const DEFAULT_KEEP = 14
const DEFAULT_BUCKET = 'db-backups'

/** Tabelas grandes / ruidosas — só entram com --full */
const SKIP_UNLESS_FULL = new Set([
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

const FALLBACK_TABLES = [
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
]

function parseArgs(argv) {
  const args = {
    keep: DEFAULT_KEEP,
    tables: null,
    upload: false,
    dryRun: false,
    full: false,
  }
  for (const a of argv) {
    if (a === '--upload') args.upload = true
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--full') args.full = true
    else if (a.startsWith('--keep=')) {
      const n = Number(a.slice('--keep='.length))
      if (!Number.isFinite(n) || n < 1) {
        console.error('Use --keep=N com N >= 1')
        process.exit(1)
      }
      args.keep = Math.floor(n)
    } else if (a.startsWith('--tables=')) {
      args.tables = a
        .slice('--tables='.length)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    } else if (a === '--help' || a === '-h') {
      console.log(`Backup Supabase (JSONL.gz)

  npm run db:backup
  npm run db:backup -- --full          # inclui tabelas grandes (radar, votos…)
  npm run db:backup -- --keep=14
  npm run db:backup -- --tables=obras,polls
  npm run db:backup -- --upload        # envia para Storage
  npm run db:backup -- --dry-run`)
      process.exit(0)
    }
  }
  return args
}

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error('Arquivo .env.local não encontrado')
    process.exit(1)
  }
  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        let v = l.slice(i + 1).trim()
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1)
        }
        return [l.slice(0, i).trim(), v]
      }),
  )
}

function stampNow() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  )
}

async function listTablesFromOpenApi(url, key) {
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/openapi+json',
    },
  })
  if (!res.ok) {
    throw new Error(`OpenAPI ${res.status}: ${await res.text()}`)
  }
  const spec = await res.json()
  const paths = spec?.paths || {}
  const tables = Object.keys(paths)
    .map((p) => p.replace(/^\//, ''))
    .filter((name) => name && !name.includes('{') && !name.includes('/'))
    .sort()
  return [...new Set(tables)]
}

async function fetchTablePage(supabase, table, from, to) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .range(from, to)
  if (error) throw new Error(error.message)
  return data || []
}

async function exportTableToGzip(supabase, table, outPath) {
  const gzip = createGzip({ level: 9 })
  const out = createWriteStream(outPath)
  let rows = 0
  let from = 0

  async function* rowsAsLines() {
    while (true) {
      const page = await fetchTablePage(supabase, table, from, from + PAGE_SIZE - 1)
      if (page.length === 0) break
      for (const row of page) {
        rows += 1
        yield `${JSON.stringify(row)}\n`
      }
      if (page.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  await pipeline(Readable.from(rowsAsLines()), gzip, out)
  return rows
}

function pruneOldBackups(keep) {
  if (!existsSync(BACKUPS_ROOT)) return []
  const dirs = readdirSync(BACKUPS_ROOT)
    .map((name) => ({ name, path: join(BACKUPS_ROOT, name) }))
    .filter((d) => {
      try {
        return statSync(d.path).isDirectory()
      } catch {
        return false
      }
    })
    .sort((a, b) => b.name.localeCompare(a.name))

  const removed = []
  for (const d of dirs.slice(keep)) {
    rmSync(d.path, { recursive: true, force: true })
    removed.push(d.name)
  }
  return removed
}

async function ensureBucket(supabase, bucket) {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw new Error(`listBuckets: ${error.message}`)
  const exists = (buckets || []).some((b) => b.name === bucket)
  if (exists) return
  const { error: createErr } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: '512MB',
  })
  if (createErr && !/already exists/i.test(createErr.message)) {
    throw new Error(`createBucket: ${createErr.message}`)
  }
}

async function uploadDir(supabase, bucket, stamp, dir) {
  const tablesDir = join(dir, 'tables')
  const files = [
    { local: join(dir, 'manifest.json'), remote: `${stamp}/manifest.json`, type: 'application/json' },
    ...readdirSync(tablesDir).map((f) => ({
      local: join(tablesDir, f),
      remote: `${stamp}/tables/${f}`,
      type: 'application/gzip',
    })),
  ]

  for (const f of files) {
    const body = readFileSync(f.local)
    const { error } = await supabase.storage.from(bucket).upload(f.remote, body, {
      contentType: f.type,
      upsert: true,
    })
    if (error) throw new Error(`upload ${f.remote}: ${error.message}`)
    console.log(`  ↑ ${f.remote} (${(body.length / 1024).toFixed(1)} KB)`)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const bucket = env.SUPABASE_BACKUP_BUCKET || DEFAULT_BUCKET

  if (!url || !key) {
    console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  let tables
  if (args.tables?.length) {
    tables = args.tables
  } else {
    try {
      tables = await listTablesFromOpenApi(url, key)
      console.log(`Descobertas ${tables.length} tabelas via OpenAPI`)
    } catch (err) {
      console.warn(`OpenAPI falhou (${err.message}). Usando lista fallback.`)
      tables = FALLBACK_TABLES
    }
    if (!args.full) {
      const before = tables.length
      tables = tables.filter((t) => !SKIP_UNLESS_FULL.has(t))
      if (before !== tables.length) {
        console.log(
          `Modo padrão: omitindo ${before - tables.length} tabelas grandes (use --full para incluir).`,
        )
      }
    }
  }

  const stamp = stampNow()
  const outDir = join(BACKUPS_ROOT, stamp)
  const tablesDir = join(outDir, 'tables')

  console.log(`\nBackup Supabase → ${outDir}`)
  console.log(`Tabelas: ${tables.length}${args.dryRun ? ' (dry-run)' : ''}\n`)

  if (args.dryRun) {
    for (const t of tables) console.log(`  - ${t}`)
    process.exit(0)
  }

  mkdirSync(tablesDir, { recursive: true })

  const results = []
  const started = Date.now()

  for (const table of tables) {
    const file = join(tablesDir, `${table}.jsonl.gz`)
    process.stdout.write(`  ${table} … `)
    try {
      const rows = await exportTableToGzip(supabase, table, file)
      const size = statSync(file).size
      console.log(`${rows} linhas (${(size / 1024).toFixed(1)} KB)`)
      results.push({ table, rows, bytes: size, ok: true })
    } catch (err) {
      console.log(`ERRO: ${err.message}`)
      results.push({ table, rows: 0, bytes: 0, ok: false, error: err.message })
      if (existsSync(file)) rmSync(file, { force: true })
    }
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    projectUrl: url,
    mode: args.full ? 'full' : args.tables ? 'custom' : 'standard',
    durationMs: Date.now() - started,
    tables: results,
    totals: {
      tablesOk: results.filter((r) => r.ok).length,
      tablesFail: results.filter((r) => !r.ok).length,
      rows: results.reduce((s, r) => s + r.rows, 0),
      bytes: results.reduce((s, r) => s + r.bytes, 0),
    },
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  console.log(
    `\nConcluído: ${manifest.totals.tablesOk} ok, ${manifest.totals.tablesFail} falha(s), ` +
      `${manifest.totals.rows} linhas, ${(manifest.totals.bytes / 1024 / 1024).toFixed(2)} MB ` +
      `em ${(manifest.durationMs / 1000).toFixed(1)}s`,
  )

  if (args.upload) {
    console.log(`\nEnviando para Storage bucket "${bucket}"…`)
    await ensureBucket(supabase, bucket)
    await uploadDir(supabase, bucket, stamp, outDir)
    console.log('Upload concluído.')
  }

  const removed = pruneOldBackups(args.keep)
  if (removed.length) {
    console.log(`\nRetenção: removidos ${removed.length} backup(s) antigo(s) (keep=${args.keep})`)
    for (const name of removed) console.log(`  ✕ ${name}`)
  }

  if (manifest.totals.tablesFail > 0) process.exitCode = 2
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
