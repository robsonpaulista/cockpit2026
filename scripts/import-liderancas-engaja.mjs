#!/usr/bin/env node
/**
 * Importa liderancas-engaja.csv → public.leaders
 *
 * Uso:
 *   node scripts/import-liderancas-engaja.mjs
 *   node scripts/import-liderancas-engaja.mjs --dry-run
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CSV_PATH = path.join(ROOT, 'liderancas-engaja.csv')
const DRY = process.argv.includes('--dry-run')

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

function stripBom(s) {
  return s.replace(/^\uFEFF/, '')
}

function normalizeHandle(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  return digits || null
}

function normalizeKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function parseCsv(text) {
  const lines = stripBom(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].split(';').map((h) => stripBom(h).trim())
  const idx = (name) => header.findIndex((h) => normalizeKey(h) === normalizeKey(name))
  const iNome = idx('Nome')
  const iCidade = idx('Cidade')
  const iIg = idx('Instagram')
  const iWa = idx('WhatsApp')
  const iEmail = idx('Email')
  const iLink = idx('Link de afiliacao')
  const iAtivo = idx('Ativo')

  const rows = []
  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li].split(';')
    const nome = (cols[iNome] ?? '').trim()
    if (!nome) continue
    const ativo = normalizeKey(cols[iAtivo] ?? 'sim')
    if (ativo === 'nao' || ativo === 'não' || ativo === 'n') continue
    rows.push({
      nome,
      cidade: (cols[iCidade] ?? '').trim() || null,
      instagram: normalizeHandle(cols[iIg]),
      telefone: normalizePhone(cols[iWa]),
      email: (cols[iEmail] ?? '').trim().toLowerCase() || null,
      afiliacao_url: (cols[iLink] ?? '').trim() || null,
    })
  }
  return rows
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local')
    process.exit(1)
  }
  if (!fs.existsSync(CSV_PATH)) {
    console.error('CSV não encontrado:', CSV_PATH)
    process.exit(1)
  }

  const parsed = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'))
  console.log(`CSV: ${parsed.length} lideranças ativas`)

  if (DRY) {
    console.log(parsed.slice(0, 5))
    console.log('(dry-run — nada gravado)')
    return
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Prefetch existentes (nome+municipio e instagram)
  const existingByNomeMun = new Set()
  const existingByIg = new Set()
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leaders')
      .select('nome, municipio, cidade, telefone, instagram')
      .range(from, from + 999)
    if (error) {
      // Coluna instagram pode não existir ainda — tenta sem ela
      if (String(error.message || '').includes('instagram')) {
        console.warn('Coluna instagram ausente — rode database/add-leaders-engaja-columns.sql no Supabase.')
        break
      }
      console.error('Erro ao ler leaders:', error)
      process.exit(1)
    }
    const rows = data ?? []
    if (rows.length === 0) break
    for (const r of rows) {
      const mun = (r.municipio || r.cidade || '').trim()
      existingByNomeMun.add(`${normalizeKey(r.nome)}|${normalizeKey(mun)}`)
      if (r.instagram) existingByIg.add(normalizeHandle(r.instagram))
    }
    if (rows.length < 1000) break
    from += 1000
  }

  const toInsert = []
  let skippedDup = 0
  for (const row of parsed) {
    const mun = row.cidade || ''
    const keyNome = `${normalizeKey(row.nome)}|${normalizeKey(mun)}`
    if (existingByNomeMun.has(keyNome) || (row.instagram && existingByIg.has(row.instagram))) {
      skippedDup += 1
      continue
    }
    toInsert.push({
      nome: row.nome,
      telefone: row.telefone,
      cidade: mun || null,
      municipio: mun || null,
      instagram: row.instagram || null,
      email: row.email,
      afiliacao_url: row.afiliacao_url,
      coordinator_id: null,
    })
    existingByNomeMun.add(keyNome)
    if (row.instagram) existingByIg.add(row.instagram)
  }

  console.log(`Inserir: ${toInsert.length} · Duplicados: ${skippedDup}`)

  if (toInsert.length === 0) {
    console.log('Nada a inserir.')
    return
  }

  // Tenta com colunas novas; se falhar, cai para colunas base
  let { error } = await admin.from('leaders').insert(toInsert)
  if (error && /instagram|email|afiliacao/i.test(error.message || '')) {
    console.warn('Insert com colunas Engaja falhou — tentando só nome/telefone/cidade/municipio')
    console.warn(error.message)
    const basic = toInsert.map(({ nome, telefone, cidade, municipio, coordinator_id }) => ({
      nome,
      telefone,
      cidade,
      municipio,
      coordinator_id,
    }))
    ;({ error } = await admin.from('leaders').insert(basic))
  }

  if (error) {
    console.error('Erro no insert:', error)
    process.exit(1)
  }

  console.log(`OK — ${toInsert.length} lideranças gravadas em public.leaders`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
