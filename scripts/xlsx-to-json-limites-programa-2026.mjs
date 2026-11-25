#!/usr/bin/env node
/**
 * Converte PRT-10169-*-PI.xlsx em tetos de PROGRAMA (por município) em data/.
 * Esses arquivos NÃO são os tetos de emenda PAP/MAC.
 *
 * Uso: node scripts/xlsx-to-json-limites-programa-2026.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const PAP_XLSX = path.join(ROOT, 'PRT-10169-PAP_PI.xlsx')
const MAC_XLSX = path.join(ROOT, 'PRT-10169-MAC_PI.xlsx')
const OUT_PAP = path.join(ROOT, 'data', 'limites-programa-pap-2026.json')
const OUT_MAC = path.join(ROOT, 'data', 'limites-programa-mac-2026.json')

function padIbge(v) {
  const s = String(v ?? '').replace(/\D/g, '')
  return s.length >= 6 ? s.slice(0, 7) : s.padStart(6, '0')
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function arredondarMoeda(v) {
  return Math.round(toNum(v) * 100) / 100
}

function normalizeMunicipioUpper(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

function findHeaderRow(rows, test) {
  return rows.findIndex(test)
}

function sheetRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`)
  }
  const wb = XLSX.readFile(filePath)
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
}

function parsePapPrograma() {
  const rows = sheetRows(PAP_XLSX)
  const hdr = findHeaderRow(
    rows,
    (r) => r[0] === 'UF' && String(r[2] ?? '').toUpperCase().includes('MUNIC'),
  )
  if (hdr < 0) throw new Error('Cabeçalho PROGRAMA PAP (PRT-10169) não encontrado')

  const out = []
  for (const row of rows.slice(hdr + 1)) {
    if (row[0] !== 'PI') continue
    const ibge = padIbge(row[1])
    const municipio = normalizeMunicipioUpper(row[2])
    const valor = arredondarMoeda(row[3])
    if (!municipio || !ibge || ibge === '220000') continue
    out.push({
      uf: 'PI',
      ibge,
      municipio,
      valor,
      tipo: 'PROGRAMA',
      programa: 'PAP',
    })
  }
  return out
}

function parseMacPrograma() {
  const rows = sheetRows(MAC_XLSX)
  const hdr = findHeaderRow(
    rows,
    (r) =>
      r[0] === 'UF' &&
      (String(r[2] ?? '').toUpperCase().includes('SECRETARIA') ||
        String(r[2] ?? '').toUpperCase().includes('MUNIC')),
  )
  if (hdr < 0) throw new Error('Cabeçalho PROGRAMA MAC (PRT-10169) não encontrado')

  const out = []
  for (const row of rows.slice(hdr + 1)) {
    if (row[0] !== 'PI') continue
    const gestao = String(row[3] ?? '').toUpperCase()
    if (gestao === 'ESTADUAL') continue
    const ibge = padIbge(row[1])
    const municipio = normalizeMunicipioUpper(row[2])
    const valor = arredondarMoeda(row[4])
    if (!municipio || !ibge || ibge === '220000') continue
    out.push({
      uf: 'PI',
      ibge,
      municipio,
      valor,
      tipo: 'PROGRAMA',
      programa: 'MAC',
    })
  }
  return out
}

function main() {
  const pap = parsePapPrograma()
  const mac = parseMacPrograma()

  fs.mkdirSync(path.dirname(OUT_PAP), { recursive: true })
  fs.writeFileSync(OUT_PAP, JSON.stringify(pap, null, 2))
  fs.writeFileSync(OUT_MAC, JSON.stringify(mac, null, 2))

  console.log(`PROGRAMA PAP: ${pap.length} municípios → ${OUT_PAP}`)
  console.log(`PROGRAMA MAC: ${mac.length} municípios → ${OUT_MAC}`)
}

main()
