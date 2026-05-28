#!/usr/bin/env node
/**
 * Converte as planilhas de tetos 2026 (raiz do projeto) em JSON em data/.
 * Uso: node scripts/xlsx-to-json-limites-2026.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const PAP_XLSX = path.join(ROOT, 'Teto_PAP_PI_2026 Individuais.xlsx')
const MAC_XLSX = path.join(ROOT, 'Teto_MAC_PI_2026 Individuais.xlsx')
const OUT_PAP = path.join(ROOT, 'data', 'limites-pap-2026.json')
const OUT_MAC = path.join(ROOT, 'data', 'limites-mac-2026.json')

function padIbge(v) {
  const s = String(v ?? '').replace(/\D/g, '')
  return s.length >= 6 ? s.slice(0, 7) : s.padStart(6, '0')
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
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

function parsePap() {
  if (!fs.existsSync(PAP_XLSX)) {
    throw new Error(`Arquivo não encontrado: ${PAP_XLSX}`)
  }
  const wb = XLSX.readFile(PAP_XLSX)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
  const hdr = findHeaderRow(rows, (r) => r[0] === 'UF' && String(r[1] ?? '').toUpperCase().includes('MUNIC'))
  if (hdr < 0) throw new Error('Cabeçalho PAP não encontrado na planilha')

  const out = []
  for (const row of rows.slice(hdr + 1)) {
    if (row[0] !== 'PI') continue
    const municipio = normalizeMunicipioUpper(row[1])
    const ibge = padIbge(row[2])
    const valor = toNum(row[4])
    if (!municipio || !ibge) continue
    out.push({
      uf: 'PI',
      ibge,
      municipio,
      valor,
      tipo: 'PAP',
      modalidade: 'individual',
    })
  }
  return out
}

function parseMac() {
  if (!fs.existsSync(MAC_XLSX)) {
    throw new Error(`Arquivo não encontrado: ${MAC_XLSX}`)
  }
  const wb = XLSX.readFile(MAC_XLSX)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
  const hdr = findHeaderRow(
    rows,
    (r) => r[0] === 'UF' && String(r[3] ?? '').toUpperCase().includes('SECRETARIAS'),
  )
  if (hdr < 0) throw new Error('Cabeçalho MAC não encontrado na planilha')

  const out = []
  for (const row of rows.slice(hdr + 1)) {
    if (row[0] !== 'PI') continue
    const ibge = padIbge(row[2])
    const municipio = normalizeMunicipioUpper(row[3])
    const valor = toNum(row[7])
    if (!municipio || !ibge) continue
    out.push({
      uf: 'PI',
      ibge,
      municipio,
      valor,
      cnes: String(row[5] ?? ''),
      nome_fantasia: String(row[3] ?? '').trim(),
      tipo: 'MAC',
      modalidade: 'individual',
    })
  }
  return out
}

function main() {
  const pap = parsePap()
  const mac = parseMac()

  fs.mkdirSync(path.dirname(OUT_PAP), { recursive: true })
  fs.writeFileSync(OUT_PAP, JSON.stringify(pap, null, 2))
  fs.writeFileSync(OUT_MAC, JSON.stringify(mac, null, 2))

  const papIbge = new Set(pap.map((x) => x.ibge))
  const macIbge = new Set(mac.map((x) => x.ibge))

  console.log(`PAP: ${pap.length} municípios (${papIbge.size} IBGE únicos) → ${OUT_PAP}`)
  console.log(`MAC: ${mac.length} linhas (${macIbge.size} IBGE únicos) → ${OUT_MAC}`)
}

main()
