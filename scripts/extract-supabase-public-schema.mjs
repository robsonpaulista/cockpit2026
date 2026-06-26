#!/usr/bin/env node
/**
 * Extrai schema e (opcionalmente) dados do schema public de um dump SQL do Supabase.
 *
 * Uso:
 *   node scripts/extract-supabase-public-schema.mjs
 *   node scripts/extract-supabase-public-schema.mjs --data
 *   node scripts/extract-supabase-public-schema.mjs --backup caminho/para/backup.gz
 */

import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const DEFAULT_BACKUP = join(ROOT, 'scripts/db_cluster-17-11-2025@02-49-17.backup.gz')
const OUT_SCHEMA = join(ROOT, 'database/restore-from-backup-public-schema-extracted.sql')
const OUT_DATA = join(ROOT, 'database/restore-from-backup-public-data-extracted.sql')

const PUBLIC_TABLES = new Set([
  'face_descriptors',
  'persons',
  'photo_tags',
  'photos',
  'sync_events',
  'users',
])

function parseArgs() {
  const args = process.argv.slice(2)
  let backup = DEFAULT_BACKUP
  let includeData = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data') includeData = true
    if (args[i] === '--backup' && args[i + 1]) backup = args[++i]
  }
  return { backup, includeData }
}

async function readBackupLines(backupPath) {
  if (!existsSync(backupPath)) {
    throw new Error(`Backup não encontrado: ${backupPath}`)
  }

  const lines = []
  const input = backupPath.endsWith('.gz')
    ? createReadStream(backupPath).pipe(createGunzip())
    : createReadStream(backupPath)

  const rl = createInterface({ input, crlfDelay: Infinity })
  for await (const line of rl) lines.push(line)
  return lines
}

function isPublicObjectLine(line) {
  return /-- Name: .+; Type: .+; Schema: public; Owner:/.test(line)
}

function stripOwnership(line) {
  if (/^ALTER (TABLE|FUNCTION|VIEW) public\./.test(line) && /OWNER TO/.test(line)) return null
  if (/^ALTER DEFAULT PRIVILEGES/.test(line)) return null
  if (/^-- Name:.*Type: ACL; Schema: public/.test(line)) return null
  if (/^GRANT /.test(line)) return null
  if (/^REVOKE /.test(line)) return null
  return line
}

function extractSchema(lines) {
  const chunks = []
  let inPublicBlock = false
  let buffer = []

  const flush = () => {
    if (buffer.length) {
      chunks.push(buffer.join('\n'))
      buffer = []
    }
  }

  for (const line of lines) {
    if (isPublicObjectLine(line)) {
      flush()
      inPublicBlock = true
      buffer.push(line)
      continue
    }

    if (inPublicBlock) {
      if (line.startsWith('-- Name:') && !line.includes('Schema: public')) {
        flush()
        inPublicBlock = false
        continue
      }
      if (line.startsWith('COPY public.')) {
        flush()
        inPublicBlock = false
        continue
      }
      const cleaned = stripOwnership(line)
      if (cleaned !== null) buffer.push(cleaned)
    }
  }
  flush()

  const header = `-- Extraído automaticamente de backup Supabase (schema public apenas)
-- Gerado em: ${new Date().toISOString()}
-- Revise antes de aplicar em produção.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`

  return header + chunks.join('\n\n')
}

function extractData(lines) {
  const parts = []
  let capturing = false
  let tableName = ''
  let block = []

  for (const line of lines) {
    const copyMatch = line.match(/^COPY public\.(\w+) /)
    if (copyMatch) {
      if (capturing && block.length) parts.push(block.join('\n'))
      tableName = copyMatch[1]
      if (!PUBLIC_TABLES.has(tableName)) {
        capturing = false
        block = []
        continue
      }
      capturing = true
      block = [line]
      continue
    }

    if (capturing) {
      block.push(line)
      if (line === '\\.') {
        parts.push(block.join('\n'))
        capturing = false
        block = []
      }
    }
  }

  const header = `-- Dados public (formato COPY — requer psql, não o SQL Editor web)
-- Gerado em: ${new Date().toISOString()}
-- Uso: psql "$DATABASE_URL" -f database/restore-from-backup-public-data-extracted.sql

`

  return header + parts.join('\n\n')
}

async function main() {
  const { backup, includeData } = parseArgs()
  console.log(`Lendo backup: ${backup}`)
  const lines = await readBackupLines(backup)

  const tables = lines
    .filter((l) => l.startsWith('CREATE TABLE public.'))
    .map((l) => l.replace('CREATE TABLE public.', '').replace(/ \(.*$/, ''))

  console.log('Tabelas public encontradas:', tables.join(', ') || '(nenhuma)')

  const schemaSql = extractSchema(lines)
  await pipeline(
    async function* () {
      yield schemaSql
    },
    createWriteStream(OUT_SCHEMA),
  )
  console.log(`Schema extraído → ${OUT_SCHEMA}`)

  if (includeData) {
    const dataSql = extractData(lines)
    await pipeline(
      async function* () {
        yield dataSql
      },
      createWriteStream(OUT_DATA),
    )
    console.log(`Dados (COPY) extraídos → ${OUT_DATA}`)
  }

  console.log('\nPróximo passo: executar o schema no SQL Editor do novo projeto Supabase.')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
