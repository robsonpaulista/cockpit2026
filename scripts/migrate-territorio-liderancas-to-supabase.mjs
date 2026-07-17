#!/usr/bin/env node
/**
 * Migra SOMENTE a planilha Território (aba VOTAÇÃO FINAL) → public.territorio_liderancas.
 *
 * Pré-requisito: database/create-territorio-liderancas.sql no SQL Editor do Supabase.
 *
 * Uso:
 *   node scripts/migrate-territorio-liderancas-to-supabase.mjs --audit
 *   node scripts/migrate-territorio-liderancas-to-supabase.mjs --import --verify
 *
 * Baseline esperado (planilha):
 *   673 linhas · 216 municípios
 *   expectativa Jadyel 117.685 · promessa 167.160 · legado 160.565
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BATCH_SIZE = 500

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

function sanitizeEnvValue(value) {
  let sanitized = String(value || '').trim()
  if (
    (sanitized.startsWith('"') && sanitized.endsWith('"')) ||
    (sanitized.startsWith("'") && sanitized.endsWith("'"))
  ) {
    sanitized = sanitized.slice(1, -1).trim()
  }
  return sanitized.replace(/,\s*$/, '').trim()
}

function formatPrivateKey(key) {
  return sanitizeEnvValue(key).replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').trim()
}

function normalizeCityKey(city) {
  return String(city || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function normalizeNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const str = String(value ?? '').trim()
  if (!str) return 0
  let cleaned = str.replace(/[^\d.,-]/g, '')
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts.length === 2 && parts[1].length <= 2) cleaned = cleaned.replace(',', '.')
    else cleaned = cleaned.replace(/,/g, '')
  }
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function parseArgs(argv) {
  return {
    audit: argv.includes('--audit'),
    doImport: argv.includes('--import'),
    verify: argv.includes('--verify'),
  }
}

function getTerritorioCredentials() {
  const email =
    process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_EMAIL ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey =
    process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_PRIVATE_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !privateKey) {
    throw new Error('Credenciais do Território não encontradas no .env.local')
  }
  return {
    email: sanitizeEnvValue(email),
    privateKey,
    spreadsheetId: sanitizeEnvValue(process.env.GOOGLE_SHEETS_SPREADSHEET_ID || ''),
    sheetName: sanitizeEnvValue(process.env.GOOGLE_SHEETS_NAME || 'Sheet1'),
    range: sanitizeEnvValue(process.env.GOOGLE_SHEETS_RANGE || ''),
  }
}

async function getSheetsClient(email, privateKey) {
  const auth = new google.auth.JWT(email, undefined, formatPrivateKey(privateKey), [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ])
  return google.sheets({ version: 'v4', auth })
}

function colIndex(headers, ...predicates) {
  for (const pred of predicates) {
    const idx = headers.findIndex((h) => pred(h))
    if (idx >= 0) return idx
  }
  return -1
}

function mapTerritorioRows(headers, dataRows) {
  const idx = {
    municipio: colIndex(headers, (h) => /munic[ií]pio|cidade/i.test(h)),
    lideranca: colIndex(headers, (h) => /^lideran[cç]a$/i.test(h) || /nome|pessoa/i.test(h)),
    senador1: colIndex(headers, (h) => /senador\s*1/i.test(h)),
    senador2: colIndex(headers, (h) => /senador\s*2/i.test(h)),
    depEstadual: colIndex(headers, (h) => /dep\.?\s*estadual/i.test(h)),
    liderancaAtual: colIndex(headers, (h) => /lideran[cç]a\s*atual/i.test(h)),
    cargo2020: colIndex(headers, (h) => /cargo\s*2020/i.test(h)),
    votos2020: colIndex(headers, (h) => /^votos\s*2020$/i.test(h)),
    totalVotos2020: colIndex(headers, (h) => /total\s*votos\s*elei[cç][aã]o\s*2020/i.test(h)),
    cargo2024: colIndex(headers, (h) => /cargo\s*2024/i.test(h)),
    votos2024: colIndex(headers, (h) => /^votos\s*2024$/i.test(h)),
    totalVotos2024: colIndex(headers, (h) => /total\s*votos\s*elei[cç][aã]o\s*2024/i.test(h)),
    promessa: colIndex(headers, (h) => /^promessa\s+da\s+lideran[cç]a\s+2026$/i.test(h)),
    totalPromessa: colIndex(headers, (h) => /total\s*promessa/i.test(h)),
    expectativaJadyel: colIndex(headers, (h) => /expectativa\s*jadyel\s*2026/i.test(h)),
    totalExpectativaJadyel: colIndex(headers, (h) => /total\s*votos\s*expectativa\s*jadyel/i.test(h)),
    votacaoFinal2022: colIndex(headers, (h) => /vota[cç][aã]o\s*final\s*2022/i.test(h)),
    expectativaVotos2026: colIndex(headers, (h) => /^expectativa\s+de\s+votos\s+2026$/i.test(h)),
    totalExpectativaVotos2026: colIndex(
      headers,
      (h) => /total\s*expectativa\s*de\s*votos\s*2026/i.test(h),
    ),
    diferenca: colIndex(headers, (h) => /diferen[cç]a/i.test(h)),
    pctAcerto: colIndex(headers, (h) => /%\s*acerto/i.test(h)),
    urlImagem: colIndex(headers, (h) => /url\s*imagem/i.test(h)),
  }

  const mapped = []
  for (const row of dataRows) {
    const municipio = idx.municipio >= 0 ? String(row[idx.municipio] || '').trim() : ''
    const lideranca = idx.lideranca >= 0 ? String(row[idx.lideranca] || '').trim() : ''
    if (!municipio && !lideranca) continue
    const liderancaAtual =
      idx.liderancaAtual >= 0 ? String(row[idx.liderancaAtual] || '').trim() : ''
    const emDialogo = /di[aá]logo/i.test(liderancaAtual)

    mapped.push({
      municipio: municipio || '(sem município)',
      municipio_normalizado: normalizeCityKey(municipio || '(sem município)'),
      lideranca: lideranca || '(sem nome)',
      senador_1: idx.senador1 >= 0 ? String(row[idx.senador1] || '').trim() || null : null,
      senador_2: idx.senador2 >= 0 ? String(row[idx.senador2] || '').trim() || null : null,
      dep_estadual: idx.depEstadual >= 0 ? String(row[idx.depEstadual] || '').trim() || null : null,
      lideranca_atual: liderancaAtual || null,
      cargo_2020: idx.cargo2020 >= 0 ? String(row[idx.cargo2020] || '').trim() || null : null,
      votos_2020: idx.votos2020 >= 0 ? normalizeNumber(row[idx.votos2020]) : null,
      total_votos_eleicao_2020:
        idx.totalVotos2020 >= 0 ? normalizeNumber(row[idx.totalVotos2020]) : null,
      cargo_2024: idx.cargo2024 >= 0 ? String(row[idx.cargo2024] || '').trim() || null : null,
      votos_2024: idx.votos2024 >= 0 ? normalizeNumber(row[idx.votos2024]) : null,
      total_votos_eleicao_2024:
        idx.totalVotos2024 >= 0 ? normalizeNumber(row[idx.totalVotos2024]) : null,
      promessa_lideranca_2026: idx.promessa >= 0 ? normalizeNumber(row[idx.promessa]) : null,
      total_promessa_lideranca_2026:
        idx.totalPromessa >= 0 ? normalizeNumber(row[idx.totalPromessa]) : null,
      expectativa_jadyel_2026:
        idx.expectativaJadyel >= 0 ? normalizeNumber(row[idx.expectativaJadyel]) : null,
      total_votos_expectativa_jadyel_2026:
        idx.totalExpectativaJadyel >= 0 ? normalizeNumber(row[idx.totalExpectativaJadyel]) : null,
      votacao_final_2022:
        idx.votacaoFinal2022 >= 0 ? normalizeNumber(row[idx.votacaoFinal2022]) : null,
      expectativa_votos_2026:
        idx.expectativaVotos2026 >= 0 ? normalizeNumber(row[idx.expectativaVotos2026]) : null,
      total_expectativa_votos_2026:
        idx.totalExpectativaVotos2026 >= 0
          ? normalizeNumber(row[idx.totalExpectativaVotos2026])
          : null,
      diferenca_final_votos_jadyel_2020:
        idx.diferenca >= 0 ? normalizeNumber(row[idx.diferenca]) : null,
      pct_acerto_final_votos_jadyel_2020:
        idx.pctAcerto >= 0 ? normalizeNumber(row[idx.pctAcerto]) : null,
      url_imagem: idx.urlImagem >= 0 ? String(row[idx.urlImagem] || '').trim() || null : null,
      em_dialogo: emDialogo,
      ativo: true,
      fonte: 'google_sheets',
      imported_at: new Date().toISOString(),
    })
  }
  return mapped
}

function summarize(mapped) {
  const municipios = new Set(mapped.map((r) => r.municipio_normalizado).filter(Boolean))
  return {
    dataRows: mapped.length,
    municipios: municipios.size,
    somaExpectativaJadyel: mapped.reduce((s, r) => s + Number(r.expectativa_jadyel_2026 || 0), 0),
    somaPromessa: mapped.reduce((s, r) => s + Number(r.promessa_lideranca_2026 || 0), 0),
    somaExpectativaLegado: mapped.reduce((s, r) => s + Number(r.expectativa_votos_2026 || 0), 0),
    somaVotacaoFinal2022: mapped.reduce((s, r) => s + Number(r.votacao_final_2022 || 0), 0),
    emDialogo: mapped.filter((r) => r.em_dialogo).length,
  }
}

async function assertTableExists(supabase) {
  const { error } = await supabase.from('territorio_liderancas').select('id').limit(1)
  if (error) {
    throw new Error(
      `Tabela public.territorio_liderancas indisponível (${error.message}). Rode database/create-territorio-liderancas.sql no SQL Editor.`,
    )
  }
}

async function replaceTable(supabase, rows) {
  console.log('  Limpando territorio_liderancas…')
  const { error: delErr } = await supabase
    .from('territorio_liderancas')
    .delete()
    .not('id', 'is', null)
  if (delErr) throw delErr

  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('territorio_liderancas').insert(batch)
    if (error) {
      throw new Error(`Falha ao inserir (offset ${i}): ${error.message}`)
    }
    inserted += batch.length
    console.log(`  territorio_liderancas: ${inserted}/${rows.length}`)
  }
  return inserted
}

async function dbStats(supabase) {
  const { count, error } = await supabase
    .from('territorio_liderancas')
    .select('*', { count: 'exact', head: true })
  if (error) throw error

  let somaExpectativaJadyel = 0
  let somaPromessa = 0
  let somaExpectativaLegado = 0
  let somaVotacaoFinal2022 = 0
  let emDialogo = 0
  const municipios = new Set()
  let from = 0
  const page = 1000
  for (;;) {
    const { data, error: pageErr } = await supabase
      .from('territorio_liderancas')
      .select(
        'municipio_normalizado, expectativa_jadyel_2026, promessa_lideranca_2026, expectativa_votos_2026, votacao_final_2022, em_dialogo',
      )
      .range(from, from + page - 1)
    if (pageErr) throw pageErr
    if (!data || data.length === 0) break
    for (const row of data) {
      if (row.municipio_normalizado) municipios.add(row.municipio_normalizado)
      somaExpectativaJadyel += Number(row.expectativa_jadyel_2026 || 0)
      somaPromessa += Number(row.promessa_lideranca_2026 || 0)
      somaExpectativaLegado += Number(row.expectativa_votos_2026 || 0)
      somaVotacaoFinal2022 += Number(row.votacao_final_2022 || 0)
      if (row.em_dialogo) emDialogo += 1
    }
    if (data.length < page) break
    from += page
  }

  return {
    dataRows: count ?? 0,
    municipios: municipios.size,
    somaExpectativaJadyel,
    somaPromessa,
    somaExpectativaLegado,
    somaVotacaoFinal2022,
    emDialogo,
  }
}

function compareNumber(label, a, b, diffs) {
  if (Number(a) !== Number(b)) diffs.push(`${label}: planilha=${a} vs banco=${b}`)
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  if (!args.audit && !args.doImport && !args.verify) {
    console.log(`Uso:
  node scripts/migrate-territorio-liderancas-to-supabase.mjs --audit
  node scripts/migrate-territorio-liderancas-to-supabase.mjs --import --verify`)
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local')
    process.exit(1)
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const terrCred = getTerritorioCredentials()
  if (!terrCred.spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID não definido')
  }

  console.log(`Lendo Território / ${terrCred.sheetName}…`)
  const sheets = await getSheetsClient(terrCred.email, terrCred.privateKey)
  const terrRange = terrCred.range
    ? terrCred.sheetName.includes(' ')
      ? `'${terrCred.sheetName}'!${terrCred.range}`
      : `${terrCred.sheetName}!${terrCred.range}`
    : terrCred.sheetName
  const terrResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: terrCred.spreadsheetId,
    range: terrRange,
  })
  const terrValues = terrResponse.data.values || []
  const terrHeaders = (terrValues[0] || []).map((h) => String(h || '').trim())
  const mapped = mapTerritorioRows(terrHeaders, terrValues.slice(1))
  const sheetStats = summarize(mapped)
  console.log('Planilha (baseline):', sheetStats)

  if (args.audit && !args.doImport && !args.verify) {
    console.log('\nAudit OK. Próximo: criar a tabela no Supabase e rodar --import --verify')
    return
  }

  await assertTableExists(supabase)

  if (args.doImport) {
    console.log('\nImportando territorio_liderancas…')
    const n = await replaceTable(supabase, mapped)
    console.log(`Inseridas ${n} linhas`)
  }

  if (args.verify) {
    console.log('\nConferindo banco × planilha…')
    const db = await dbStats(supabase)
    console.log('Banco:', db)

    const diffs = []
    compareNumber('dataRows', sheetStats.dataRows, db.dataRows, diffs)
    compareNumber('municipios', sheetStats.municipios, db.municipios, diffs)
    compareNumber(
      'somaExpectativaJadyel',
      Math.round(sheetStats.somaExpectativaJadyel),
      Math.round(db.somaExpectativaJadyel),
      diffs,
    )
    compareNumber(
      'somaPromessa',
      Math.round(sheetStats.somaPromessa),
      Math.round(db.somaPromessa),
      diffs,
    )
    compareNumber(
      'somaExpectativaLegado',
      Math.round(sheetStats.somaExpectativaLegado),
      Math.round(db.somaExpectativaLegado),
      diffs,
    )
    compareNumber(
      'somaVotacaoFinal2022',
      Math.round(sheetStats.somaVotacaoFinal2022),
      Math.round(db.somaVotacaoFinal2022),
      diffs,
    )
    compareNumber('emDialogo', sheetStats.emDialogo, db.emDialogo, diffs)

    if (diffs.length) {
      console.error('\nFALHA na conferência:')
      for (const d of diffs) console.error(' -', d)
      process.exit(2)
    }
    console.log('\nConferência OK: todos os totais batem.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
