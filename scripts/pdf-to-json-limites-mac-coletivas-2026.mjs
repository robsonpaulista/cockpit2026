#!/usr/bin/env node
/**
 * Extrai limites MAC coletivos 2026 dos PDFs (prints do Consulta FNS).
 * Arquivos na raiz:
 *   Limites Coletivas MAC 2026 parte 1.pdf
 *   Limites Coletivas MAC 2026 parte 2.pdf
 *
 * Uso: node scripts/pdf-to-json-limites-mac-coletivas-2026.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const EXERCICIO = 2026
const OUT = path.join(ROOT, 'data', `limites-mac-${EXERCICIO}-coletivas.json`)

const PDFS = [
  'Limites Coletivas MAC 2026 parte 1.pdf',
  'Limites Coletivas MAC 2026 parte 2.pdf',
]

const PAP_LISTA = path.join(ROOT, 'data', 'limites-pap-2026.json')

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

function isMoneyRowItem(it) {
  return isMoneyToken(it.str) && it.x >= 240 && it.x <= 320
}

function isDataRow(row) {
  const gestao = row.parts.some((p) => /^(MUNICIPAL|ESTADUAL)$/i.test(p.str))
  const limite = row.parts.find(isMoneyRowItem)
  const cnes = row.parts.some((p) => /^\d{7,8}$/.test(p.str) && p.x < 120)
  return Boolean(gestao && limite && cnes)
}

function isSecretariaRow(row) {
  return row.parts.some((p) => /SECRETARIA|FUND(O|MUNICIPAL)|ASSOCIACAO|CLINICA/i.test(p.str))
}

function namePartsFromRow(row) {
  return row.parts
    .filter(
      (p) =>
        p.x >= 50 &&
        p.x <= 280 &&
        !isMoneyToken(p.str) &&
        !/^(MUNICIPAL|ESTADUAL)$/i.test(p.str) &&
        !/^\d{7,8}$/.test(p.str),
    )
    .map((p) => p.str)
}

function rowText(row) {
  return row.parts
    .map((p) => p.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  return rows.sort((a, b) => b.y - a.y)
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
  if (!n || n.length < 4) return null
  if (/TIPO DA EMENDA|SELECIONE|CONSULTAR|MACPAP|CNPJ|CNES|EMENDA/i.test(n)) return null

  if (/\bTERESINA\b/.test(n) || /\bAPADA\b/.test(n)) {
    const teresina = index.find((m) => m.norm === 'TERESINA')
    if (teresina) return teresina
  }

  for (const m of index) {
    if (n === m.norm || n.endsWith(` ${m.norm}`) || n.includes(` ${m.norm} `) || n.endsWith(m.norm)) {
      return m
    }
  }
  return null
}

function cleanNomeContexto(s) {
  return String(s ?? '')
    .replace(/SECRETARIA MUNICIPAL DE SAUDE( DE)?/gi, ' ')
    .replace(/SECRETARIA MUNICIPAL/gi, ' ')
    .replace(/SMS|FMS|FUNDACHRISMUNICIPAL/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMunicipioForDataRow(rows, idx, index) {
  const chunks = []

  for (let j = idx - 1; j >= 0 && j >= idx - 8; j--) {
    const row = rows[j]
    if (isDataRow(row)) break
    const np = namePartsFromRow(row)
    if (np.length) chunks.unshift(...np)
    else if (!isMoneyToken(rowText(row))) chunks.unshift(rowText(row))
  }

  for (let j = idx + 1; j < rows.length && j <= idx + 6; j++) {
    const row = rows[j]
    if (isDataRow(row)) break
    if (row.parts.some((p) => /SECRETARIA MUNICIPAL DE SAUDE/i.test(p.str))) break
    const np = namePartsFromRow(row)
    if (np.length) chunks.push(...np)
    else if (!isMoneyToken(rowText(row))) chunks.push(rowText(row))
  }

  const raw = cleanNomeContexto(chunks.join(' '))
  return matchMunicipio(raw, index)
}

/** Blocos iniciados em SECRETARIA → linha(s) de nome → linha CNES/valores */
function extractFromSecretariaBlocks(rows, index) {
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const start = rowText(rows[i])
    if (
      !/SECRETARIA MUNICIPAL DE SAUDE|FUND(O|MUNICIPAL)|HOSPITAL|DIRETORIA|ASSOCIACAO|CLINICA/i.test(
        start,
      )
    ) {
      continue
    }

    const names = [start]
    let dataRow = null

    for (let j = i + 1; j < rows.length && j <= i + 8; j++) {
      if (isDataRow(rows[j])) {
        dataRow = rows[j]
        break
      }
      const np = namePartsFromRow(rows[j])
      if (np.length) names.push(...np)
      else {
        const t = cleanNomeContexto(rowText(rows[j]))
        if (t && !/^(MAC|PAP|TIPO|ANO|UF|MUNICIPIO|CNPJ|CNES)/i.test(t)) names.push(t)
      }
    }

    if (!dataRow) continue
    const mun = matchMunicipio(cleanNomeContexto(names.join(' ')), index)
    if (!mun) continue

    const limiteItem = dataRow.parts.find(isMoneyRowItem)
    const limite = limiteItem ? moneyNum(limiteItem.str) : 0
    if (limite <= 0) continue

    const cnes = dataRow.parts.find((p) => /^\d{7,8}$/.test(p.str) && p.x < 120)?.str
    out.push({ mun, limite, cnes, names: names.join(' ').slice(0, 120) })
  }
  return out
}

async function extractPdf(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await pdfjsLib.getDocument({ data, disableWorker: true }).promise
  const rows = []

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
        page: p,
      })
    }
    rows.push(...groupRows(pageItems))
  }
  const index = buildMunicipioIndex()
  const parsed = []
  const seen = new Set()

  const push = (mun, limite, cnes, nomeFantasia) => {
    const key = `${mun.ibge}|${cnes || 'x'}`
    if (seen.has(key)) return
    seen.add(key)
    parsed.push({
      uf: 'PI',
      ibge: mun.ibge,
      municipio: mun.nome,
      valor: limite,
      cnes: cnes ? String(cnes).slice(0, 7) : '',
      nome_fantasia: nomeFantasia || mun.nome,
      tipo: 'MAC',
      modalidade: 'coletiva',
    })
  }

  for (const block of extractFromSecretariaBlocks(rows, index)) {
    push(block.mun, block.limite, block.cnes, block.names)
  }

  for (let i = 0; i < rows.length; i++) {
    if (!isDataRow(rows[i])) continue
    const limiteItem = rows[i].parts.find(isMoneyRowItem)
    const limite = limiteItem ? moneyNum(limiteItem.str) : 0
    const cnes = rows[i].parts.find((p) => /^\d{7,8}$/.test(p.str) && p.x < 120)?.str
    const mun = extractMunicipioForDataRow(rows, i, index)
    if (!mun || limite <= 0) continue
    push(mun, limite, cnes, namePartsFromRow(rows[i - 1] ?? rows[i]).join(' '))
  }

  return parsed
}

function aggregateByMunicipio(linhas) {
  const byMun = new Map()
  const cnesPorMun = new Map()

  for (const item of linhas) {
    const key = norm(item.municipio)
    const cnesKey = item.cnes || `sem-cnes-${norm(item.nome_fantasia).slice(0, 40)}`
    const seen = cnesPorMun.get(key) ?? new Set()
    if (seen.has(cnesKey)) continue
    seen.add(cnesKey)
    cnesPorMun.set(key, seen)

    const prev = byMun.get(key)
    if (prev) {
      prev.valor += item.valor
    } else {
      byMun.set(key, { ...item, valor: item.valor })
    }
  }
  return Array.from(byMun.values())
}

async function main() {
  if (!fs.existsSync(PAP_LISTA)) {
    console.error('Execute antes: npm run limites2026:json')
    process.exit(1)
  }

  let todas = []
  for (const pdf of PDFS) {
    const fp = path.join(ROOT, pdf)
    if (!fs.existsSync(fp)) {
      console.warn(`Pulando: ${pdf}`)
      continue
    }
    const linhas = await extractPdf(fp)
    console.log(`${pdf}: ${linhas.length} linhas com município identificado`)
    todas = todas.concat(linhas)
  }

  if (todas.length === 0) {
    console.error('Nenhum registro extraído dos PDFs.')
    process.exit(1)
  }

  const agregado = aggregateByMunicipio(todas)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(agregado, null, 2))
  console.log(`MAC coletiva: ${todas.length} CNES → ${agregado.length} municípios → ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
