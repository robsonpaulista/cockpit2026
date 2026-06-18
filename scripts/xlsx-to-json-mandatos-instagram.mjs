#!/usr/bin/env node
/**
 * Converte piaui_mandatos_instagram_2024.xlsx em JSON em data/.
 * Uso: node scripts/xlsx-to-json-mandatos-instagram.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const XLSX_PATH = path.join(ROOT, 'piaui_mandatos_instagram_2024.xlsx')
const OUT = path.join(ROOT, 'data', 'mandatos-instagram-piaui.json')

function normalizeMunicipioNome(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

function normalizeInstagramHandle(raw) {
  const t = String(raw ?? '').trim()
  if (!t || /^n[aã]o\s+declarado$/i.test(t)) return ''
  const withoutAt = t.replace(/^@+/, '')
  const handle = withoutAt.split(/[/?#\s]/)[0]?.trim().toLowerCase() ?? ''
  return handle.replace(/[^a-z0-9._]/g, '')
}

function slugId(cargo, municipio, nome) {
  const base = `${cargo}-${municipio}-${nome}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base || `${cargo}-${Date.now()}`
}

function parseSheet(rows, cargo, nomeCol) {
  const out = []
  const header = rows[0] ?? []
  const idxMun = header.findIndex((h) => String(h).toLowerCase().includes('munic'))
  const idxNome = header.findIndex((h) => String(h).toLowerCase().includes(nomeCol))
  const idxPartido = header.findIndex((h) => String(h).toLowerCase().includes('partido'))
  const idxIg = header.findIndex((h) => String(h).toLowerCase().includes('instagram'))
  const idxUrl = header.findIndex((h) => String(h).toLowerCase().includes('url'))

  for (const row of rows.slice(1)) {
    const municipio = String(row[idxMun] ?? '').trim()
    const nome = String(row[idxNome] ?? '').trim()
    const partido = String(row[idxPartido] ?? '').trim()
    const instagram = String(row[idxIg] ?? '').trim()
    const url = String(row[idxUrl] ?? '').trim()
    const handle = normalizeInstagramHandle(instagram)
    if (!municipio || !nome) continue
    out.push({
      id: slugId(cargo, municipio, nome),
      cargo,
      municipio,
      municipioNorm: normalizeMunicipioNome(municipio),
      nome,
      partido: partido || null,
      instagram: handle ? (instagram.startsWith('@') ? instagram : `@${handle}`) : null,
      handle: handle || null,
      url: url || null,
    })
  }
  return out
}

function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Arquivo não encontrado: ${XLSX_PATH}`)
  }
  const wb = XLSX.readFile(XLSX_PATH)
  const prefeitos = parseSheet(
    XLSX.utils.sheet_to_json(wb.Sheets['Prefeitos com IG (165)'], { header: 1, defval: '' }),
    'prefeito',
    'prefeito'
  )
  const vereadores = parseSheet(
    XLSX.utils.sheet_to_json(wb.Sheets['Vereadores com IG (1117)'], { header: 1, defval: '' }),
    'vereador',
    'vereador'
  )
  const mandatos = [...prefeitos, ...vereadores].filter((m) => m.handle)

  const payload = {
    geradoEm: new Date().toISOString(),
    fonte: 'piaui_mandatos_instagram_2024.xlsx',
    totalPrefeitosComIg: prefeitos.filter((m) => m.handle).length,
    totalVereadoresComIg: vereadores.filter((m) => m.handle).length,
    mandatos,
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`OK: ${mandatos.length} mandatários com IG → ${OUT}`)
}

main()
