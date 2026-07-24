#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.local')
if (!existsSync(envPath)) {
  console.error('Arquivo .env.local não encontrado')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const tables = [
  // Arquivos / PhotoFinder
  'users',
  'photos',
  'sync_events',
  'persons',
  'face_descriptors',
  'photo_tags',
  // Outras tabelas grandes comuns no projeto
  'news',
  'instagram_radar_posts',
  'instagram_comments',
  'instagram_post_metrics_history',
  'instagram_metrics_history',
  'instagram_post_classifications',
  'instagram_publish_day_engagement',
  'youtube_mentions',
  'google_news_mentions',
  'google_videos_mentions',
  'google_trends_interest',
  'google_trends_related',
  'meta_ads_mentions',
  'meta_ads_collect_log',
  'polls',
  'poll_reports',
  'cities',
  'obras',
  'demands',
  'leads_militancia',
  'leaders',
  'votacao_secao_local',
  'federal_2018',
  'chapas_partidos',
  'chapas_cenarios',
  'visits',
  'agendas',
  'publicacoes_conteudo',
  'conteudos_planejados',
  'emendas',
  'emendas_suas',
  'profiles',
]

console.log('table\trows')
for (const table of tables) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) {
    console.log(`${table}\tERROR: ${error.message}`)
  } else {
    console.log(`${table}\t${count ?? 0}`)
  }
}
