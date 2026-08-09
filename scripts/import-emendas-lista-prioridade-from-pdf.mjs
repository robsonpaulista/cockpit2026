#!/usr/bin/env node
/**
 * Importa emendas do PDF "Lista de Prioridade Dep Jadyel..." filtrando pela coluna Ano.
 *
 * Uso:
 *   node scripts/import-emendas-lista-prioridade-from-pdf.mjs --ano=2023
 *   node scripts/import-emendas-lista-prioridade-from-pdf.mjs --ano=2023 --dry-run
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PDF_PATH = path.join(
  ROOT,
  'Lista de Prioridade Dep Jadyel separadas - Google Planilhas.pdf',
)

const args = process.argv.slice(2)
const anoArg = Number((args.find((a) => a.startsWith('--ano=')) || '--ano=2023').split('=')[1])
const dryRun = args.includes('--dry-run')
const OUT = path.join(ROOT, 'data', `emendas-${anoArg}-extraidas.json`)

const envPath = path.join(ROOT, '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const value = m[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function norm(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMoney(s) {
  const t = norm(s).replace(/^R\$\s*/i, '')
  if (!t || t === '-') return null
  // "PAGO R$ 335.187,60 - 23.05.24" → first money
  const m = t.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/)
  if (!m) return null
  // Ignore tiny looks-like-day fragments when surrounded by dates only
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseDate(s) {
  const t = norm(s)
  const m = t.match(/(\d{2})[./](\d{2})[./](\d{2,4})/)
  if (!m) return null
  let y = m[3]
  if (y.length === 2) y = Number(y) >= 70 ? `19${y}` : `20${y}`
  return `${y}-${m[2]}-${m[1]}`
}

function parseAno(s) {
  const t = norm(s)
  if (/^(19|20)\d{2}$/.test(t)) return Number(t)
  if (/^\d{2}$/.test(t)) {
    const n = Number(t)
    return n >= 70 ? 1900 + n : 2000 + n
  }
  return null
}

function isMoneyToken(s) {
  const t = norm(s)
  if (!t || t === '-') return false
  return /^(R\$\s*)?\d{1,3}(?:\.\d{3})+(?:,\d{2})?$/.test(t) || /^\d+(?:,\d{2})?$/.test(t)
}

function isHeaderish(cells) {
  const j = cells.join(' ')
  return (
    (/Tipo/i.test(j) && /Ano/i.test(j)) ||
    (/Valor/i.test(j) && /Indicado/i.test(j) && cells.length < 6)
  )
}

function looksLikeMunicipio(s) {
  const t = norm(s)
  if (!t || t === '-' || isMoneyToken(t)) return false
  if (/^[34]$/.test(t)) return false
  if (/^NE\d+/i.test(t) || /^\d{4}NE/i.test(t)) return false
  if (/^\d+\/\d{4}$/.test(t)) return false
  if (/^PAGO\b/i.test(t)) return false
  return /[A-Za-zÀ-ÿ]/.test(t)
}

function groupPageRows(items) {
  const map = new Map()
  for (const it of items) {
    const y = Math.round(it.y)
    if (!map.has(y)) map.set(y, [])
    map.get(y).push(it)
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, arr]) => ({
      y,
      cells: arr
        .sort((a, b) => a.x - b.x)
        .map((i) => norm(i.str))
        .filter(Boolean),
    }))
}

function nearbyMunicipioName(rows, idx) {
  const main = rows[idx]
  // Nome do beneficiário costuma estar imediatamente acima (e às vezes partido em 2 linhas).
  const above = []
  for (const delta of [-1, -2]) {
    const other = rows[idx + delta]
    if (!other) continue
    if (main.y - other.y > 16 || other.y - main.y > 0) {
      // want lines with y > main.y (above in PDF coords)
    }
    if (other.y <= main.y || other.y - main.y > 16) continue
    const last = other.cells[other.cells.length - 1]
    if (parseAno(last) != null) continue
    const text = other.cells.filter(looksLikeMunicipio).join(' ')
    if (
      !text ||
      /^DE \d/i.test(text) ||
      /^PORTARIA/i.test(text) ||
      /^PAGO\b/i.test(text) ||
      /OB\d+/i.test(text)
    ) {
      continue
    }
    above.push({ y: other.y, text })
  }
  if (above.length === 0) {
    // fallback: linha logo abaixo (continuação do nome)
    for (const delta of [1, 2]) {
      const other = rows[idx + delta]
      if (!other) continue
      if (main.y - other.y > 16 || other.y >= main.y) continue
      const last = other.cells[other.cells.length - 1]
      if (parseAno(last) != null) continue
      const text = other.cells.filter(looksLikeMunicipio).join(' ')
      if (
        text &&
        !/^DE \d/i.test(text) &&
        !/^PORTARIA/i.test(text) &&
        !/^PAGO\b/i.test(text) &&
        !/OB\d+/i.test(text)
      ) {
        above.push({ y: other.y, text })
      }
    }
  }
  if (above.length === 0) return null
  above.sort((a, b) => b.y - a.y)
  return norm(above.map((p) => p.text).join(' '))
}

function parseRow(cells, municipioHint) {
  const ano = parseAno(cells[cells.length - 1])
  if (ano == null) return null
  const body = cells.slice(0, -1)
  if (body.length < 2) return null

  const tipo = body[0]
  let municipio = body[1]
  let rest = body.slice(2)

  if (!looksLikeMunicipio(municipio) && /^[34]$/.test(norm(municipio))) {
    // pattern: Tipo | GND | valores... (município em linha vizinha)
    rest = [municipio, ...rest]
    municipio = municipioHint || ''
  } else if (!looksLikeMunicipio(municipio)) {
    municipio = municipioHint || municipio
  }

  let gnd = null
  const gndIdx = rest.findIndex((c) => /^[34]$/.test(norm(c)))
  if (gndIdx >= 0) {
    gnd = rest[gndIdx]
    rest = [...rest.slice(0, gndIdx), ...rest.slice(gndIdx + 1)]
  }

  const moneys = []
  const dates = []
  const texts = []
  for (const c of rest) {
    const n = norm(c)
    if (n === '-') {
      texts.push(n)
      continue
    }
    if (isMoneyToken(n) || /^PAGO\b/i.test(n)) {
      const money = parseMoney(n)
      if (money != null) moneys.push(money)
      const d = parseDate(n)
      if (d) dates.push(d)
      if (/[A-Za-z]/.test(n) && !isMoneyToken(n)) texts.push(n)
      continue
    }
    if (/^\d{2}[./]\d{2}[./]\d{2,4}$/.test(n)) {
      dates.push(parseDate(n))
      continue
    }
    texts.push(n)
  }

  let valor_indicado = null
  let valor_pago = null
  let valor_a_ser_pago = null
  let valor_a_empenhar = null

  if (moneys.length === 1) {
    valor_indicado = moneys[0]
  } else if (moneys.length === 2) {
    valor_indicado = moneys[0]
    valor_pago = moneys[1]
  } else if (moneys.length >= 3) {
    valor_indicado = moneys[0]
    valor_a_ser_pago = moneys[moneys.length - 1]
    valor_pago = moneys[moneys.length - 2]
    if (moneys.length >= 4) {
      const mid = moneys.slice(1, -2)
      if (mid.includes(0)) valor_a_empenhar = 0
    }
  }

  const empenho =
    texts.find((t) => /^NE\d+/i.test(t) || /^\d{4}NE\d+/i.test(t)) || null
  const portaria =
    texts.find((t) => /\d+\/\d{4}/.test(t) || /^PAGO\b/i.test(t) || /OB\d+/i.test(t)) ||
    null
  const alteracao = texts.find((t) => /ALTERADO|SUBSTITU/i.test(t)) || null

  return {
    bloco: null,
    exercicio: ano,
    emenda: norm(tipo) || 'Emenda',
    municipio_beneficiario: norm(municipio) || null,
    gnd: gnd ? String(gnd) : null,
    valor_indicado,
    valor_empenhado: null,
    valor_a_empenhar,
    valor_pago,
    valor_a_ser_pago,
    empenho,
    data_empenho: dates[0] || null,
    portaria_convenio: portaria,
    data_pagamento: dates[1] || (portaria ? parseDate(portaria) : null) || null,
    alteracao,
    objeto:
      texts
        .filter((t) => t !== empenho && t !== portaria && t !== alteracao && t !== '-')
        .join(' | ') || null,
  }
}

function rowKey(r) {
  return [
    r.exercicio,
    norm(r.emenda).toLowerCase(),
    norm(r.municipio_beneficiario).toLowerCase(),
    r.valor_indicado ?? '',
    r.valor_pago ?? '',
    norm(r.empenho).toLowerCase(),
  ].join('|')
}

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    console.error('PDF não encontrado:', PDF_PATH)
    process.exit(1)
  }

  const data = new Uint8Array(fs.readFileSync(PDF_PATH))
  const doc = await pdfjsLib.getDocument({ data }).promise
  const parsed = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const items = tc.items
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))
      .filter((i) => i.str && norm(i.str))
    const rows = groupPageRows(items)

    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].cells
      if (isHeaderish(cells)) continue
      const last = cells[cells.length - 1]
      if (parseAno(last) == null) continue
      const hint = nearbyMunicipioName(rows, i)
      const row = parseRow(cells, hint)
      if (!row) continue
      if (row.exercicio !== anoArg) continue
      parsed.push(row)
    }
  }

  const seen = new Set()
  const unique = []
  for (const r of parsed) {
    // corrige nomes partidos no PDF
    if (r.municipio_beneficiario) {
      let m = r.municipio_beneficiario
      if (/TURISMO/i.test(m) && !/PIAUI|PIAUÍ/i.test(m)) {
        m = 'SECRETARIA DO TURISMO DO ESTADO DO PIAUI'
      }
      if (/AGRONEGOCIO/i.test(m) || /^PIAUI SECRETARIA DO AGRONEGOCIO/i.test(m)) {
        m = 'SECRETARIA DO AGRONEGOCIO E EMPREENDEDORISMO RURAL'
      }
      r.municipio_beneficiario = m
    }
    const k = rowKey(r)
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(r)
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(unique, null, 2))
  console.log(`Ano ${anoArg}: ${unique.length} emenda(s) → ${OUT}`)
  for (const r of unique) {
    console.log(
      `- ${r.emenda} | ${r.municipio_beneficiario} | ind ${r.valor_indicado ?? '—'} | pago ${r.valor_pago ?? '—'}`,
    )
  }

  if (dryRun) {
    console.log('Dry-run: sem inserção no banco.')
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    console.log('Sem credenciais Supabase. JSON gerado; importe via POST /api/emendas { rows }.')
    return
  }

  const supabase = createClient(url, key)
  const { data: existing, error: exErr } = await supabase
    .from('emendas')
    .select('emenda, municipio_beneficiario, valor_indicado, valor_pago, empenho, exercicio')
    .eq('exercicio', anoArg)

  if (exErr) {
    console.error('Erro ao listar emendas existentes:', exErr.message || exErr)
    process.exit(1)
  }

  const existingKeys = new Set((existing || []).map(rowKey))
  const toInsert = unique.filter((r) => !existingKeys.has(rowKey(r)))
  console.log(`Já no banco (ano ${anoArg}): ${existing?.length ?? 0}. Novas: ${toInsert.length}`)

  if (toInsert.length === 0) {
    console.log('Nada novo para inserir.')
    return
  }

  const { data: inserted, error: insErr } = await supabase
    .from('emendas')
    .insert(toInsert)
    .select('id')

  if (insErr) {
    console.error('Erro ao inserir:', insErr.message || insErr)
    process.exit(1)
  }

  console.log(`Inseridas: ${inserted?.length ?? 0}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
