#!/usr/bin/env node
/**
 * Remove notícias e comentários com mais de 60 dias.
 *
 * Uso:
 *   node scripts/purge-retention-60d.mjs           # só mostra o que seria apagado
 *   node scripts/purge-retention-60d.mjs --execute # executa a limpeza
 *   node scripts/purge-retention-60d.mjs --days 45 # janela customizada
 *
 * Requer .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.local')

const args = process.argv.slice(2)
const execute = args.includes('--execute')
const daysArg = args.find((a) => a.startsWith('--days='))
const days = daysArg ? Number(daysArg.split('=')[1]) : 60

if (!Number.isFinite(days) || days < 1) {
  console.error('Use --days=N com N >= 1')
  process.exit(1)
}

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
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const cutoff = new Date()
cutoff.setUTCDate(cutoff.getUTCDate() - days)
const cutoffIso = cutoff.toISOString()

const targets = [
  {
    table: 'news',
    label: 'Notícias (news)',
    countOld: async () => {
      const { count: withPublished } = await supabase
        .from('news')
        .select('*', { count: 'exact', head: true })
        .not('published_at', 'is', null)
        .lt('published_at', cutoffIso)
      const { count: nullPublished } = await supabase
        .from('news')
        .select('*', { count: 'exact', head: true })
        .is('published_at', null)
        .lt('collected_at', cutoffIso)
      return (withPublished ?? 0) + (nullPublished ?? 0)
    },
    deleteOld: async () => {
      const { error: e1 } = await supabase
        .from('news')
        .delete()
        .not('published_at', 'is', null)
        .lt('published_at', cutoffIso)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('news')
        .delete()
        .is('published_at', null)
        .lt('collected_at', cutoffIso)
      if (e2) throw e2
    },
  },
  {
    table: 'google_news_mentions',
    label: 'Google Notícias (radar)',
    countOld: async () => {
      const { count: withPublished } = await supabase
        .from('google_news_mentions')
        .select('*', { count: 'exact', head: true })
        .not('published_at', 'is', null)
        .lt('published_at', cutoffIso)
      const { count: nullPublished } = await supabase
        .from('google_news_mentions')
        .select('*', { count: 'exact', head: true })
        .is('published_at', null)
        .lt('collected_at', cutoffIso)
      return (withPublished ?? 0) + (nullPublished ?? 0)
    },
    deleteOld: async () => {
      const { error: e1 } = await supabase
        .from('google_news_mentions')
        .delete()
        .not('published_at', 'is', null)
        .lt('published_at', cutoffIso)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('google_news_mentions')
        .delete()
        .is('published_at', null)
        .lt('collected_at', cutoffIso)
      if (e2) throw e2
    },
  },
  {
    table: 'instagram_comments',
    label: 'Comentários Instagram',
    countOld: async () => {
      const { count } = await supabase
        .from('instagram_comments')
        .select('*', { count: 'exact', head: true })
        .lt('commented_at', cutoffIso)
      return count ?? 0
    },
    deleteOld: async () => {
      const { error } = await supabase
        .from('instagram_comments')
        .delete()
        .lt('commented_at', cutoffIso)
      if (error) throw error
    },
  },
]

console.log(`Retenção: ${days} dias · cutoff UTC: ${cutoffIso}`)
console.log(execute ? 'Modo: EXECUTAR' : 'Modo: PREVIEW (adicione --execute para apagar)')
console.log('')

let totalRemove = 0

for (const t of targets) {
  const { count: total, error: totalError } = await supabase
    .from(t.table)
    .select('*', { count: 'exact', head: true })
  if (totalError) {
    console.error(`Erro ao contar ${t.table}:`, totalError.message)
    process.exit(1)
  }
  const toRemove = await t.countOld()
  totalRemove += toRemove
  console.log(`${t.label}`)
  console.log(`  tabela: ${t.table}`)
  console.log(`  total atual: ${total ?? 0}`)
  console.log(`  remover (> ${days}d): ${toRemove}`)
  console.log(`  ficaria: ${Math.max(0, (total ?? 0) - toRemove)}`)
  console.log('')

  if (execute && toRemove > 0) {
    await t.deleteOld()
    console.log(`  ✓ ${toRemove} registro(s) removido(s)`)
    console.log('')
  }
}

if (!execute) {
  console.log(`Total a remover (preview): ${totalRemove}`)
  console.log('Para executar: node scripts/purge-retention-60d.mjs --execute')
} else {
  console.log(`Limpeza concluída. Total removido: ${totalRemove}`)
  console.log('Dica: no Supabase SQL Editor, rode VACUUM ANALYZE nas tabelas se o tamanho do banco não cair de imediato.')
}
