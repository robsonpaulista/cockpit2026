#!/usr/bin/env node
/**
 * Estima tamanho das tabelas via amostragem de payload JSON (aproximação).
 * Para tamanho exato, rode database/check-table-sizes.sql no SQL Editor do Supabase.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const tables = [
  'users',
  'photos',
  'sync_events',
  'persons',
  'face_descriptors',
  'photo_tags',
  'news',
  'instagram_comments',
  'instagram_radar_posts',
  'votacao_secao_local',
  'meta_ads_mentions',
  'google_news_mentions',
  'polls',
  'youtube_mentions',
  'obras',
]

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

console.log('table\trows\test_bytes\tindex_est\tnotes')
let totalEst = 0

for (const table of tables) {
  const { count, error: countErr } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (countErr) {
    console.log(`${table}\t-\t-\t-\t${countErr.message}`)
    continue
  }

  const rows = count ?? 0
  if (rows === 0) {
    console.log(`${table}\t0\t0 B\t0 B\tvazia`)
    continue
  }

  const sampleSize = Math.min(rows, 50)
  const { data, error } = await supabase.from(table).select('*').limit(sampleSize)
  if (error) {
    console.log(`${table}\t${rows}\t-\t-\t${error.message}`)
    continue
  }

  const payload = JSON.stringify(data ?? [])
  const avgRow = payload.length / Math.max(1, (data ?? []).length)
  const estData = Math.round(avgRow * rows)
  const estIndex = Math.round(estData * 0.35)
  const estTotal = estData + estIndex
  totalEst += estTotal

  const tag = ['users', 'photos', 'sync_events', 'persons', 'face_descriptors', 'photo_tags'].includes(table)
    ? 'arquivos'
    : ''

  console.log(
    `${table}\t${rows}\t${fmt(estData)}\t${fmt(estIndex)}\t${tag}`,
  )
}

console.log(`\nTOTAL_ESTIMADO_AMOSTRA\t\t${fmt(totalEst)}\t\t(só tabelas listadas; índices ~35%)`)
