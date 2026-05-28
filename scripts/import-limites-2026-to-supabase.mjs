#!/usr/bin/env node
/**
 * Importa limites PAP/MAC 2026 (JSON gerado pelas planilhas) para o Supabase.
 *
 * Uso:
 *   node scripts/xlsx-to-json-limites-2026.mjs
 *   node scripts/import-limites-2026-to-supabase.mjs
 *
 * Pré-requisitos:
 * - database/create-limites-tetos.sql executado no Supabase
 * - .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const EXERCICIO = 2026
const PAP_JSONS = [
  path.join(ROOT, 'data', 'limites-pap-2026.json'),
  path.join(ROOT, 'data', 'limites-pap-2026-coletivas.json'),
]
const MAC_JSONS = [
  path.join(ROOT, 'data', 'limites-mac-2026.json'),
  path.join(ROOT, 'data', 'limites-mac-2026-coletivas.json'),
]
const BATCH_SIZE = 200

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  const env = fs.readFileSync(envPath, 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const value = m[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function normalizeMunicipioNome(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function formatarNomeMunicipioLista(nomePlanilha) {
  return nomePlanilha
    .toLowerCase()
    .split(' ')
    .map((palavra) => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ')
    .replace(/\bDo\b/g, 'do')
    .replace(/\bDa\b/g, 'da')
    .replace(/\bDe\b/g, 'de')
    .replace(/\bDos\b/g, 'dos')
    .replace(/\bDas\b/g, 'das')
}

async function upsertBatches(supabase, table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: 'exercicio,municipio_chave,modalidade' })
    if (error) throw error
  }
}

async function main() {
  loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local')
    process.exit(1)
  }

  const loadJsons = (paths) => {
    const items = []
    for (const p of paths) {
      if (fs.existsSync(p)) items.push(...JSON.parse(fs.readFileSync(p, 'utf8')))
    }
    return items
  }

  const papLista = loadJsons(PAP_JSONS)
  const macLista = loadJsons(MAC_JSONS)

  if (papLista.length === 0 || macLista.length === 0) {
    console.error('Execute antes: npm run limites2026:json (e limites2026:json:coletivas quando houver planilhas)')
    process.exit(1)
  }

  const parseMod = (v) => (String(v ?? 'individual') === 'coletiva' ? 'coletiva' : 'individual')
  const papKey = (chave, mod) => `${chave}|${mod}`

  const papByMun = new Map()
  for (const item of papLista) {
    const chave = normalizeMunicipioNome(item.municipio)
    const modalidade = parseMod(item.modalidade)
    papByMun.set(papKey(chave, modalidade), {
      chave,
      ibge: String(item.ibge),
      nome: item.municipio,
      valor: item.valor,
      modalidade,
    })
  }

  const macByMun = new Map()
  for (const item of macLista) {
    const chave = normalizeMunicipioNome(item.municipio)
    const modalidade = parseMod(item.modalidade)
    const key = papKey(chave, modalidade)
    const prev = macByMun.get(key)
    const add = item.valor || 0
    if (prev) {
      prev.valor += add
    } else {
      macByMun.set(key, {
        chave,
        ibge: String(item.ibge),
        nome: item.municipio,
        valor: add,
        modalidade,
      })
    }
  }

  const papRows = Array.from(papByMun.values()).map((v) => ({
    exercicio: EXERCICIO,
    municipio_chave: v.chave,
    municipio_nome: formatarNomeMunicipioLista(v.nome),
    modalidade: v.modalidade,
    ibge: v.ibge,
    valor: v.valor,
    updated_at: new Date().toISOString(),
  }))

  const macRows = Array.from(macByMun.values()).map((v) => ({
    exercicio: EXERCICIO,
    municipio_chave: v.chave,
    municipio_nome: formatarNomeMunicipioLista(v.nome),
    modalidade: v.modalidade,
    ibge: v.ibge,
    valor: v.valor,
    updated_at: new Date().toISOString(),
  }))

  const supabase = createClient(url, key)

  console.log(`Importando exercício ${EXERCICIO}: ${papRows.length} PAP, ${macRows.length} MAC…`)

  await upsertBatches(supabase, 'limites_pap', papRows)
  await upsertBatches(supabase, 'limites_mac_municipio', macRows)

  const { error: cfgErr } = await supabase.from('tetos_config').upsert({
    chave: 'exercicio_ativo',
    valor: String(EXERCICIO),
    updated_at: new Date().toISOString(),
  })
  if (cfgErr) throw cfgErr

  console.log('OK — exercicio_ativo definido como', EXERCICIO)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
