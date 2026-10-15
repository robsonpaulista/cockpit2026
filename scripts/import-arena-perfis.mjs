#!/usr/bin/env node
/**
 * Importa a base de perfis da Arena de Apoiadores → public.arena_perfis
 * (nome, @, papel, cidade, região; upsert pelo @; o CSV fica fora do git).
 * A pontuação não vem do CSV: é calculada em /api/arena/perfis a partir dos comentários.
 *
 * Uso:
 *   node scripts/import-arena-perfis.mjs data/ranking-2026-08-16_2026-10-04.csv --dry-run
 *   node scripts/import-arena-perfis.mjs data/ranking-2026-08-16_2026-10-04.csv
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const csvArg = process.argv.slice(2).find((a) => !a.startsWith('--'))

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    let value = m[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function normalizeKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeHandle(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].split(';').map(normalizeKey)
  const idx = (name) => header.indexOf(normalizeKey(name))
  const col = {
    nome: idx('Nome'),
    instagram: idx('Instagram'),
    papel: idx('Papel'),
    cidade: idx('Cidade'),
    regiao: idx('Regiao'),
  }
  const faltando = Object.entries(col)
    .filter(([, i]) => i < 0)
    .map(([k]) => k)
  if (faltando.length > 0) {
    throw new Error(`Colunas ausentes no CSV: ${faltando.join(', ')}`)
  }

  const porHandle = new Map()
  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li].split(';')
    const get = (k) => (cols[col[k]] ?? '').trim()
    const instagram = normalizeHandle(get('instagram'))
    const nome = get('nome')
    if (!instagram || !nome) continue
    const papel = normalizeKey(get('papel')) === 'lideranca' ? 'lideranca' : 'liderado'
    porHandle.set(instagram, {
      instagram,
      nome,
      papel,
      cidade: get('cidade') || null,
      regiao: get('regiao') || null,
      updated_at: new Date().toISOString(),
    })
  }
  return [...porHandle.values()]
}

async function main() {
  if (!csvArg) {
    console.error('Informe o CSV: node scripts/import-arena-perfis.mjs data/ranking-....csv [--dry-run]')
    process.exit(1)
  }
  const csvPath = path.resolve(ROOT, csvArg)
  if (!fs.existsSync(csvPath)) {
    console.error('CSV não encontrado:', csvPath)
    process.exit(1)
  }

  const perfis = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  const liderancas = perfis.filter((p) => p.papel === 'lideranca').length
  console.log(
    `CSV: ${perfis.length} perfis (${liderancas} lideranças · ${perfis.length - liderancas} liderados)`
  )

  if (DRY) {
    console.log('(dry-run — nada gravado)')
    return
  }

  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local')
    process.exit(1)
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error } = await admin.from('arena_perfis').upsert(perfis, { onConflict: 'instagram' })
  if (error) {
    if (/arena_perfis/.test(error.message || '')) {
      console.error('Tabela ausente — rode database/create-arena-perfis.sql no Supabase.')
    }
    console.error('Erro no upsert:', error)
    process.exit(1)
  }

  console.log(`OK — ${perfis.length} perfis gravados em public.arena_perfis`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
