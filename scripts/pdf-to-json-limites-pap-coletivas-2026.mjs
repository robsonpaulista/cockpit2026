#!/usr/bin/env node
/**
 * Extrai limites PAP coletivos 2026 dos PDFs (Consulta FNS — lista por município).
 * Arquivos na raiz:
 *   Limites Coletivas PAP 2026 parte 1.pdf
 *   Limites Coletivas PAP 2026 parte 2.pdf
 *   Limites Coletivas PAP 2026 parte 3.pdf
 *
 * Uso: node scripts/pdf-to-json-limites-pap-coletivas-2026.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const EXERCICIO = 2026
const OUT = path.join(ROOT, 'data', `limites-pap-${EXERCICIO}-coletivas.json`)
const PAP_LISTA = path.join(ROOT, 'data', 'limites-pap-2026.json')

const PDFS = [
  'Limites Coletivas PAP 2026 parte 1.pdf',
  'Limites Coletivas PAP 2026 parte 2.pdf',
  'Limites Coletivas PAP 2026 parte 3.pdf',
]

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isMoneyToken(s) {
  return /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(String(s ?? '').trim())
}

function moneyNum(s) {
  return Number(String(s).replace(/\./g, '').replace(',', '.'))
}

function groupRows(items, tol = 3) {
  const rows = []
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    let row = rows.find((r) => Math.abs(r.y - it.y) <= tol)
    if (!row) {
      row = { y: it.y, parts: [] }
      rows.push(row)
    }
    row.parts.push(it)
  }
  for (const r of rows) r.parts.sort((a, b) => a.x - b.x)
  return rows
}

function buildMunicipioIndex() {
  const lista = JSON.parse(fs.readFileSync(PAP_LISTA, 'utf8'))
  return lista
    .map((item) => ({
      nome: item.municipio,
      ibge: String(item.ibge),
      norm: norm(item.municipio),
    }))
    .sort((a, b) => b.norm.length - a.norm.length)
}

function matchMunicipio(texto, index) {
  const n = norm(texto)
  if (!n || n.length < 3) return null

  for (const m of index) {
    if (n === m.norm || n.endsWith(` ${m.norm}`) || n.includes(` ${m.norm} `) || n.endsWith(m.norm)) {
      return m
    }
  }
  return null
}

function isPapMunicipioRow(row) {
  const label = row.parts.find((p) => p.x >= 55 && p.x <= 240 && /^PI\s*-/i.test(p.str))
  const limite = row.parts.find((p) => isMoneyToken(p.str) && p.x >= 255 && p.x <= 335)
  return Boolean(label && limite)
}

function parsePapLabel(labelStr) {
  return String(labelStr)
    .replace(/^PI\s*-\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractPdf(filePath, index) {
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await pdfjsLib.getDocument({ data, disableWorker: true }).promise
  const parsed = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const pageItems = []
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue
      pageItems.push({
        x: it.transform[4],
        y: it.transform[5],
        str: it.str.trim(),
      })
    }

    for (const row of groupRows(pageItems)) {
      if (!isPapMunicipioRow(row)) continue

      const labelPart = row.parts.find((p) => /^PI\s*-/i.test(p.str))
      const limitePart = row.parts.find((p) => isMoneyToken(p.str) && p.x >= 255 && p.x <= 335)
      const nomePlanilha = parsePapLabel(labelPart.str)
      const mun = matchMunicipio(nomePlanilha, index)
      if (!mun) {
        console.warn(`  Município não mapeado: "${nomePlanilha}"`)
        continue
      }

      const valor = moneyNum(limitePart.str)
      if (valor <= 0) continue

      parsed.push({
        uf: 'PI',
        ibge: mun.ibge,
        municipio: mun.nome,
        valor,
        tipo: 'PAP',
        modalidade: 'coletiva',
        label_pdf: labelPart.str,
      })
    }
  }

  return parsed
}

function dedupePorMunicipio(linhas) {
  const byIbge = new Map()
  for (const item of linhas) {
    byIbge.set(item.ibge, item)
  }
  return Array.from(byIbge.values())
}

async function main() {
  if (!fs.existsSync(PAP_LISTA)) {
    console.error('Execute antes: npm run limites2026:json')
    process.exit(1)
  }

  const index = buildMunicipioIndex()
  let todas = []

  for (const pdf of PDFS) {
    const fp = path.join(ROOT, pdf)
    if (!fs.existsSync(fp)) {
      console.warn(`Pulando: ${pdf}`)
      continue
    }
    const linhas = await extractPdf(fp, index)
    console.log(`${pdf}: ${linhas.length} municípios`)
    todas = todas.concat(linhas)
  }

  if (todas.length === 0) {
    console.error('Nenhum registro extraído dos PDFs.')
    process.exit(1)
  }

  const agregado = dedupePorMunicipio(todas)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(agregado, null, 2))
  console.log(`PAP coletiva: ${todas.length} linhas → ${agregado.length} municípios → ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
