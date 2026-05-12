#!/usr/bin/env node
/**
 * Importa Emendas 2025 direto do PDF (sem CSV).
 *
 * Uso:
 *   node scripts/import-emendas-2025-from-pdf.mjs
 *
 * Saídas:
 *   - data/emendas-2025-extraidas.json
 *   - inserção em public.emendas (se variáveis do Supabase estiverem presentes)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PDF_PATH = path.join(ROOT, 'Emendas 2025 - Relatório.pdf')
const JSON_OUTPUT = path.join(ROOT, 'data', 'emendas-2025-extraidas.json')

// Carregar .env.local se existir.
const envPath = path.join(ROOT, '.env.local')
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8')
  env.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) return
    const key = match[1].trim()
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  })
}

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim()
}

function parseMoneyFromText(s) {
  const m = normSpace(s).match(/(\d{1,3}(?:\.\d{3})*,\d{2})/)
  if (!m) return null
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function extractSegmentTexts(items, xMin, xMax, yMin, yMax) {
  return items
    .filter((i) => i.x >= xMin && i.x < xMax && i.y >= yMin && i.y <= yMax)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((i) => i.str)
}

function pickMoney(items, xMin, xMax, yMin, yMax) {
  const texts = extractSegmentTexts(items, xMin, xMax, yMin, yMax)
  for (const t of texts) {
    const n = parseMoneyFromText(t)
    if (n !== null) return n
  }
  return null
}

function pickText(items, xMin, xMax, yMin, yMax) {
  return normSpace(extractSegmentTexts(items, xMin, xMax, yMin, yMax).join(' '))
}

function columnBoundaries(columns) {
  const xs = columns.map((c) => c.x).sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < xs.length; i++) {
    const left = i === 0 ? xs[i] - 2 : (xs[i - 1] + xs[i]) / 2
    const right = i === xs.length - 1 ? xs[i] + 28 : (xs[i] + xs[i + 1]) / 2
    out.push({ x: xs[i], left, right })
  }
  return out
}

function extractRowsFromPage(pageItems) {
  // Âncoras da coluna "Emenda" por registro.
  const emendaAnchors = pageItems
    .filter((i) => i.y >= 40 && i.y <= 50 && i.str && normSpace(i.str).toLowerCase() !== 'emenda')
    .map((i) => ({ x: i.x, str: i.str }))

  const xSeen = new Set()
  const uniqueAnchors = []
  for (const a of emendaAnchors.sort((a, b) => a.x - b.x)) {
    const key = Math.round(a.x * 10) / 10
    if (xSeen.has(key)) continue
    xSeen.add(key)
    uniqueAnchors.push({ x: key })
  }

  const bounds = columnBoundaries(uniqueAnchors)
  const rows = []

  for (const b of bounds) {
    const emenda = pickText(pageItems, b.left, b.right, 38, 56)
    if (!emenda || emenda.toLowerCase() === 'emenda') continue

    const municipio = pickText(pageItems, b.left, b.right, 72, 95)
    const valorIndicado = pickMoney(pageItems, b.left, b.right, 150, 175)
    const valorAEmpenhar = pickMoney(pageItems, b.left, b.right, 210, 235)
    const valorEmpenhado = pickMoney(pageItems, b.left, b.right, 268, 292)
    const valorPago = pickMoney(pageItems, b.left, b.right, 326, 350)
    const liderancas = pickText(pageItems, b.left, b.right, 486, 495)

    if (!municipio && valorIndicado === null && valorEmpenhado === null && valorPago === null) continue

    rows.push({
      bloco: 'BLOCO 1',
      exercicio: 2025,
      emenda: emenda || null,
      municipio_beneficiario: municipio || null,
      valor_indicado: valorIndicado,
      valor_a_empenhar: valorAEmpenhar,
      valor_empenhado: valorEmpenhado,
      valor_pago: valorPago,
      liderancas: liderancas || null,
    })
  }

  return rows
}

function totals(rows) {
  return rows.reduce(
    (acc, r) => {
      acc.indicado += Number(r.valor_indicado || 0)
      acc.aEmpenhar += Number(r.valor_a_empenhar || 0)
      acc.empenhado += Number(r.valor_empenhado || 0)
      acc.pago += Number(r.valor_pago || 0)
      return acc
    },
    { indicado: 0, aEmpenhar: 0, empenhado: 0, pago: 0 },
  )
}

function moneyBRL(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function cleanAndMergeRows(rows) {
  const cleaned = rows
    .map((r) => ({
      ...r,
      emenda: normSpace(r.emenda).replace(/^Emenda\s+/i, ''),
      municipio_beneficiario: normSpace(r.municipio_beneficiario).replace(/^Município\/Beneficiário\s+/i, ''),
      liderancas: normSpace(r.liderancas),
    }))
    .filter((r) => r.emenda && r.municipio_beneficiario)

  const merged = []
  for (const row of cleaned) {
    const hasAnyMoney =
      row.valor_indicado !== null ||
      row.valor_a_empenhar !== null ||
      row.valor_empenhado !== null ||
      row.valor_pago !== null

    if (hasAnyMoney) {
      merged.push({ ...row })
      continue
    }

    // Linha de continuação (quebra de texto do PDF): anexar ao registro anterior.
    const prev = merged[merged.length - 1]
    if (!prev) continue

    prev.emenda = normSpace(`${prev.emenda} ${row.emenda}`)
    prev.municipio_beneficiario = normSpace(`${prev.municipio_beneficiario} ${row.municipio_beneficiario}`)
    if (row.liderancas) {
      prev.liderancas = normSpace(`${prev.liderancas || ''} ${row.liderancas}`)
    }
  }

  return merged
}

async function extractFromPdf() {
  if (!fs.existsSync(PDF_PATH)) throw new Error(`PDF não encontrado: ${PDF_PATH}`)
  const data = new Uint8Array(fs.readFileSync(PDF_PATH))
  const doc = await pdfjsLib.getDocument({ data }).promise
  const allRows = []

  for (let p = 2; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const pageItems = content.items
      .map((it) => ({
        str: normSpace(it.str),
        x: Math.round(it.transform[4] * 10) / 10,
        y: Math.round(it.transform[5] * 10) / 10,
      }))
      .filter((it) => it.str)

    allRows.push(...extractRowsFromPage(pageItems))
  }

  // Limpeza + merge de linhas quebradas pelo layout do PDF.
  const cleaned = cleanAndMergeRows(allRows)

  const dedup = new Map()
  for (const r of cleaned) {
    const key = [
      r.exercicio,
      r.bloco,
      r.emenda.toLowerCase(),
      r.municipio_beneficiario.toLowerCase(),
      r.valor_indicado ?? '',
      r.valor_empenhado ?? '',
      r.valor_pago ?? '',
    ].join('|')
    if (!dedup.has(key)) dedup.set(key, r)
  }

  return [...dedup.values()]
}

async function insertRows(rows) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const key = serviceKey || anonKey

  if (!url || !key) {
    console.warn('Sem credenciais Supabase. Extração concluída, sem inserir no banco.')
    return { inserted: 0, skippedExisting: 0, canInsert: false }
  }

  const supabase = createClient(url, key)

  const { data: existing, error: existingErr } = await supabase
    .from('emendas')
    .select('emenda, municipio_beneficiario, exercicio, valor_indicado, valor_empenhado, valor_pago')
    .eq('exercicio', 2025)

  if (existingErr) throw new Error(`Erro ao consultar existentes: ${existingErr.message}`)

  const existingSet = new Set(
    (existing || []).map((r) =>
      [
        r.exercicio ?? '',
        normSpace(r.emenda).toLowerCase(),
        normSpace(r.municipio_beneficiario).toLowerCase(),
        Number(r.valor_indicado ?? 0).toFixed(2),
        Number(r.valor_empenhado ?? 0).toFixed(2),
        Number(r.valor_pago ?? 0).toFixed(2),
      ].join('|'),
    ),
  )

  const toInsert = rows.filter((r) => {
    const k = [
      r.exercicio ?? '',
      normSpace(r.emenda).toLowerCase(),
      normSpace(r.municipio_beneficiario).toLowerCase(),
      Number(r.valor_indicado ?? 0).toFixed(2),
      Number(r.valor_empenhado ?? 0).toFixed(2),
      Number(r.valor_pago ?? 0).toFixed(2),
    ].join('|')
    return !existingSet.has(k)
  })

  if (toInsert.length === 0) return { inserted: 0, skippedExisting: rows.length, canInsert: true }

  const BATCH = 100
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH)
    const { data, error } = await supabase.from('emendas').insert(chunk).select('id')
    if (error) throw new Error(`Erro ao inserir lote ${Math.floor(i / BATCH) + 1}: ${error.message}`)
    inserted += data?.length || 0
  }

  return { inserted, skippedExisting: rows.length - toInsert.length, canInsert: true }
}

async function main() {
  const rows = await extractFromPdf()

  if (!fs.existsSync(path.dirname(JSON_OUTPUT))) {
    fs.mkdirSync(path.dirname(JSON_OUTPUT), { recursive: true })
  }
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(rows, null, 2), 'utf8')

  const t = totals(rows)
  console.log('Registros extraídos:', rows.length)
  console.log('Totais extraídos:')
  console.log('- Indicado   :', moneyBRL(t.indicado))
  console.log('- A empenhar :', moneyBRL(t.aEmpenhar))
  console.log('- Empenhado  :', moneyBRL(t.empenhado))
  console.log('- Pago       :', moneyBRL(t.pago))

  const result = await insertRows(rows)
  if (!result.canInsert) {
    console.log('Sem inserção no banco (faltam variáveis). JSON gerado em:', JSON_OUTPUT)
    return
  }

  console.log('Inserção concluída.')
  console.log('- Inseridos      :', result.inserted)
  console.log('- Já existentes  :', result.skippedExisting)
  console.log('JSON salvo em   :', JSON_OUTPUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

