#!/usr/bin/env node
/**
 * Esvazia SOMENTE public.federal_2018 (nenhuma outra tabela).
 *
 * Uso:
 *   node scripts/truncate-federal-2018.mjs           # preview
 *   node scripts/truncate-federal-2018.mjs --execute
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TABLE = 'federal_2018'
const BATCH = 5000
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.local')
const execute = process.argv.includes('--execute')

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
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const { count: before, error: countErr } = await supabase
  .from(TABLE)
  .select('*', { count: 'exact', head: true })

if (countErr) {
  console.error('Erro ao contar:', countErr.message)
  process.exit(1)
}

console.log(`Tabela alvo: public.${TABLE}`)
console.log(`Linhas atuais: ${before ?? 0}`)
console.log(execute ? 'Modo: EXECUTAR (esvaziar tabela)' : 'Modo: PREVIEW')
console.log('')
console.log('Impacto no app:')
console.log('  - /api/resumo-eleicoes/historico-federal (dados 2018)')
console.log('  - /api/resumo-eleicoes/historico-federal/mapa-por-municipio (modo 2018)')
console.log('Nenhuma outra tabela será alterada.')
console.log('')

if (!execute) {
  console.log('Para executar: node scripts/truncate-federal-2018.mjs --execute')
  process.exit(0)
}

if ((before ?? 0) === 0) {
  console.log('Tabela já está vazia.')
  process.exit(0)
}

let removed = 0
while (true) {
  const { data: ids, error: selectErr } = await supabase
    .from(TABLE)
    .select('id')
    .order('id', { ascending: true })
    .limit(BATCH)

  if (selectErr) {
    console.error('Erro ao listar ids:', selectErr.message)
    process.exit(1)
  }
  if (!ids?.length) break

  const idList = ids.map((r) => r.id)
  const { error: delErr } = await supabase.from(TABLE).delete().in('id', idList)
  if (delErr) {
    console.error('Erro ao apagar lote:', delErr.message)
    process.exit(1)
  }

  removed += idList.length
  if (removed % 25000 === 0 || idList.length < BATCH) {
    console.log(`Removidos: ${removed}`)
  }
}

const { count: after } = await supabase.from(TABLE).select('*', { count: 'exact', head: true })
console.log('')
console.log(`Concluído. Removidos: ${removed}. Linhas restantes em ${TABLE}: ${after ?? 0}`)
