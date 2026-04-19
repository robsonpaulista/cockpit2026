#!/usr/bin/env node
/**
 * Importa federal2018.xlsx para public.federal_2018 no Supabase.
 * Uso:
 *   node scripts/import-federal2018-to-supabase.mjs
 *
 * Pré-requisitos:
 * - Tabela criada via database/create-federal-2018-table.sql
 * - .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const XLSX_PATH = path.join(ROOT, 'federal2018.xlsx')
const BATCH_SIZE = 500

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

function toInt(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function toBigIntNumber(v) {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function toText(v) {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  return s || null
}

function toDate(v) {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(v).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `${y}-${m}-${d}`
  }
  return null
}

function mapRow(row) {
  return {
    ano_eleicao: toInt(row.ANO_ELEICAO),
    dt_eleicao: toDate(row.DT_ELEICAO),
    cd_municipio: toInt(row.CD_MUNICIPIO),
    nm_municipio: toText(row.NM_MUNICIPIO),
    nr_zona: toInt(row.NR_ZONA),
    nr_secao: toInt(row.NR_SECAO),
    cd_cargo: toInt(row.CD_CARGO),
    ds_cargo: toText(row.DS_CARGO),
    nr_votavel: toText(row.NR_VOTAVEL),
    nm_votavel: toText(row.NM_VOTAVEL),
    qt_votos: toInt(row.QT_VOTOS),
    nr_local_votacao: toInt(row.NR_LOCAL_VOTACAO),
    sq_candidato: toBigIntNumber(row.SQ_CANDIDATO),
    nm_local_votacao: toText(row.NM_LOCAL_VOTACAO),
    ds_local_votacao_endereco: toText(row.DS_LOCAL_VOTACAO_ENDERECO),
  }
}

async function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`Arquivo não encontrado: ${XLSX_PATH}`)
    process.exit(1)
  }

  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) {
    console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('Lendo planilha federal2018.xlsx...')
  const wb = XLSX.readFile(XLSX_PATH, { cellDates: true })
  const sheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })
  console.log(`Aba: ${sheetName} | linhas: ${rows.length}`)

  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE).map(mapRow).filter((r) => r.ano_eleicao !== null)
    const { error } = await supabase.from('federal_2018').insert(chunk)
    if (error) {
      console.error(`Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message)
      process.exit(1)
    }
    inserted += chunk.length
    if (inserted % 5000 === 0 || i + BATCH_SIZE >= rows.length) {
      console.log(`Progresso: ${inserted}/${rows.length}`)
    }
  }

  console.log(`Importação concluída. Registros inseridos: ${inserted}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

