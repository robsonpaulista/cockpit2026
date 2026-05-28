#!/usr/bin/env node
/**
 * Converte planilhas de tetos COLETIVOS 2026 (raiz do projeto) em JSON.
 * Nomes esperados (ajuste quando tiver os arquivos finais):
 *   Teto_PAP_PI_2026 Coletivas.xlsx
 *   Teto_MAC_PI_2026 Coletivas.xlsx
 *
 * Uso: node scripts/xlsx-to-json-limites-coletivas-2026.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const EXERCICIO = 2026

const CANDIDATOS = [
  { tipo: 'pap', xlsx: 'Teto_PAP_PI_2026 Coletivas.xlsx', out: `limites-pap-${EXERCICIO}-coletivas.json` },
  { tipo: 'mac', xlsx: 'Teto_MAC_PI_2026 Coletivas.xlsx', out: `limites-mac-${EXERCICIO}-coletivas.json` },
]

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

function parsePap(rows) {
  const hdr = findHeaderRow(rows, (r) => r[0] === 'UF' && String(r[1] ?? '').toUpperCase().includes('MUNIC'))
  if (hdr < 0) throw new Error('Cabeçalho PAP coletiva não encontrado')
  const out = []
  for (const row of rows.slice(hdr + 1)) {
    if (row[0] !== 'PI') continue
    const municipio = normalizeMunicipioUpper(row[1])
    const ibge = padIbge(row[2])
    const valor = toNum(row[4] ?? row[3])
    if (!municipio || !ibge) continue
    out.push({ uf: 'PI', ibge, municipio, valor, tipo: 'PAP', modalidade: 'coletiva' })
  }
  return out
}

function parseMac(rows) {
  const hdr = findHeaderRow(
    rows,
    (r) => r[0] === 'UF' && String(r[3] ?? '').toUpperCase().includes('SECRETARIAS'),
  )
  if (hdr < 0) {
    const hdrAlt = findHeaderRow(rows, (r) => r[0] === 'UF' && String(r[1] ?? '').toUpperCase().includes('MUNIC'))
    if (hdrAlt < 0) throw new Error('Cabeçalho MAC coletiva não encontrado')
    const out = []
    for (const row of rows.slice(hdrAlt + 1)) {
      if (row[0] !== 'PI') continue
      const municipio = normalizeMunicipioUpper(row[1])
      const ibge = padIbge(row[2])
      const valor = toNum(row[4] ?? row[3])
      if (!municipio || !ibge) continue
      out.push({ uf: 'PI', ibge, municipio, valor, tipo: 'MAC', modalidade: 'coletiva' })
    }
    return out
  }
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
      modalidade: 'coletiva',
    })
  }
  return out
}

function main() {
  let ok = 0
  for (const { tipo, xlsx, out } of CANDIDATOS) {
    const filePath = path.join(ROOT, xlsx)
    if (!fs.existsSync(filePath)) {
      console.warn(`Pulando (não encontrado): ${xlsx}`)
      continue
    }
    const wb = XLSX.readFile(filePath)
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
    const data = tipo === 'pap' ? parsePap(rows) : parseMac(rows)
    const outPath = path.join(ROOT, 'data', out)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2))
    console.log(`${tipo.toUpperCase()} coletiva: ${data.length} → ${outPath}`)
    ok++
  }
  if (ok === 0) {
    console.log('Nenhuma planilha coletiva encontrada. Coloque os arquivos na raiz do projeto.')
    process.exit(0)
  }
}

main()
