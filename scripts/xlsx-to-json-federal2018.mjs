#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const XLSX_PATH = path.join(ROOT, 'federal2018.xlsx')
const JSON_OUTPUT = path.join(ROOT, 'data', 'federal2018.json')

function normalizeHeader(v, idx) {
  const raw = String(v ?? '').trim()
  if (!raw) return `col_${idx + 1}`
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `col_${idx + 1}`
}

function normalizeCell(v) {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).trim()
  if (!s) return null
  return s
}

function sheetToObjects(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false })
  if (!rows.length) return []
  const headers = (rows[0] || []).map((h, idx) => normalizeHeader(h, idx))
  const out = []
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r] || []
    const obj = { __sheet: sheetName }
    let hasValue = false
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i]
      const value = normalizeCell(row[i])
      obj[key] = value
      if (value !== null) hasValue = true
    }
    if (hasValue) out.push(obj)
  }
  return out
}

function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`Arquivo não encontrado: ${XLSX_PATH}`)
    process.exit(1)
  }

  const wb = XLSX.read(fs.readFileSync(XLSX_PATH), { type: 'buffer', cellDates: true })
  const all = []
  const perSheet = {}

  for (const name of wb.SheetNames) {
    const data = sheetToObjects(wb, name)
    perSheet[name] = data.length
    for (const row of data) all.push(row)
  }

  const dir = path.dirname(JSON_OUTPUT)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(all, null, 2), 'utf8')

  const sizeKb = Math.round(fs.statSync(JSON_OUTPUT).size / 1024)
  console.log('JSON gerado:', JSON_OUTPUT)
  console.log('Abas:', wb.SheetNames.join(', '))
  console.log('Linhas por aba:', perSheet)
  console.log('Total de registros:', all.length)
  console.log('Tamanho aproximado:', `${sizeKb} KB`)
}

main()
