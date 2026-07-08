#!/usr/bin/env node
/**
 * Converte as planilhas Jadyel (2023-24, 2025, 2026) em data/obras-jadyel.json
 * Uso: node scripts/build-jadyel-obras-json.mjs
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUTPUT = path.join(ROOT, 'data', 'obras-jadyel.json')
const MUNICIPIOS_PI = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'lib', 'municipios-piaui.json'), 'utf8')
)
  .map((m) => m.nome.trim())
  .sort((a, b) => b.length - a.length)

const SOURCES = [
  { periodo: '2026', file: 'Jadyel 2026.xlsx' },
  { periodo: '2025', file: 'Jad 2025.xlsx' },
  { periodo: '2023-24', file: 'Jad 2023-24.xlsx' },
]

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeMunicipioName(value) {
  const trimmed = String(value ?? '').trim().replace(/\s+/g, ' ')
  const norm = normalizeText(trimmed)
  const match = MUNICIPIOS_PI.find((m) => normalizeText(m) === norm)
  return match ?? trimmed
}

function splitMunicipiosCell(value) {
  return String(value ?? '')
    .split(/[/,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalizeMunicipioName)
}

function extractMunicipioFromObraText(obra) {
  const trimmed = String(obra ?? '').trim()
  if (!trimmed) return null
  const normObra = normalizeText(trimmed)
  for (const municipio of MUNICIPIOS_PI) {
    if (normObra.startsWith(normalizeText(municipio))) return normalizeMunicipioName(municipio)
  }
  return null
}

function parseValor(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const limpo = String(value).trim().replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.')
  const n = Number.parseFloat(limpo)
  return Number.isFinite(n) ? n : null
}

function parseText(value) {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s || null
}

function classificarTipo(obra) {
  const nome = normalizeText(obra)
  if (/paralelepipedo/.test(nome)) return 'paralelepipedo'
  if (/paviment|asfalt|calcamento|cbuq|tsd|pmf|recuperacao de estrada|estrada vicinal|restauracao.*estrada/.test(nome)) {
    return 'asfalto'
  }
  if (/quadra|areninha|esportiv|poliesportiv|campo sintet|ginasio|praca publica|praca|society|estadio|reforma de estadio/.test(nome)) {
    return 'quadras-esportivas'
  }
  if (/trator|escavadeira|maquinario|maquina agricola/.test(nome)) return 'maquinario-agricola'
  if (/passagem molhada|passagens molhadas|cisterna|cisternas|sistema de abastecimento de agua|abastecimento de agua/.test(nome)) {
    return 'passagens-cisternas'
  }
  return 'outros'
}

function buildId(periodo, municipio, obra, sei, linha) {
  const hash = createHash('sha256')
    .update(`${periodo}|${municipio}|${obra}|${sei ?? ''}|${linha}`)
    .digest('hex')
    .slice(0, 16)
  return `jad-${periodo.replace(/\D/g, '')}-${hash}`
}

function parseRows(periodo, rows) {
  const parsed = []
  let contextMunicipios = []
  let contextOrgao = null
  let contextSei = null
  let contextCota = null
  let contextObs = null

  rows.forEach((row, index) => {
    const obra = parseText(row.obra)
    if (!obra) return

    const municipioCell = parseText(row.municipio)
    if (municipioCell) contextMunicipios = splitMunicipiosCell(municipioCell)

    const orgao = parseText(row.orgao) ?? contextOrgao
    const sei = parseText(row.sei) ?? contextSei
    const cota = parseValor(row.cota) ?? contextCota
    const obs = parseText(row.obs) ?? contextObs
    const valor_total = parseValor(row.valor)

    if (parseText(row.orgao)) contextOrgao = parseText(row.orgao)
    if (parseText(row.sei)) contextSei = parseText(row.sei)
    if (parseValor(row.cota) != null) contextCota = parseValor(row.cota)
    if (parseText(row.obs)) contextObs = parseText(row.obs)

    const municipioExtraido = extractMunicipioFromObraText(obra)
    let municipio =
      municipioExtraido ??
      (contextMunicipios.length === 1 ? contextMunicipios[0] : null) ??
      contextMunicipios[0] ??
      'Município não informado'

    if (!municipioExtraido && contextMunicipios.length > 1) {
      const normObra = normalizeText(obra)
      const match = contextMunicipios.find((m) => normObra.includes(normalizeText(m)))
      if (match) municipio = match
    }

    municipio = normalizeMunicipioName(municipio)
    const tipo = classificarTipo(obra)

    parsed.push({
      id: buildId(periodo, municipio, obra, sei, index + 2),
      periodo,
      municipio,
      obra,
      valor_total,
      orgao,
      sei,
      cota,
      obs,
      tipo,
      status: null,
    })
  })

  return parsed
}

function readSheetRows(filePath) {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const headers = (raw[0] ?? []).map((h) => String(h ?? '').trim().toLowerCase())
  const idx = {
    municipio: headers.findIndex((h) => h.includes('munic')),
    obra: headers.findIndex((h) => h === 'obra'),
    valor: headers.findIndex((h) => h.includes('valor')),
    orgao: headers.findIndex((h) => h.includes('rg')),
    sei: headers.findIndex((h) => h === 'sei'),
    cota: headers.findIndex((h) => h.includes('cota')),
    obs: headers.findIndex((h) => h.includes('obs')),
  }

  return raw.slice(1).map((row) => ({
    municipio: idx.municipio >= 0 ? row[idx.municipio] : '',
    obra: idx.obra >= 0 ? row[idx.obra] : '',
    valor: idx.valor >= 0 ? row[idx.valor] : null,
    orgao: idx.orgao >= 0 ? row[idx.orgao] : null,
    sei: idx.sei >= 0 ? row[idx.sei] : null,
    cota: idx.cota >= 0 ? row[idx.cota] : null,
    obs: idx.obs >= 0 ? row[idx.obs] : null,
  }))
}

const all = []
for (const source of SOURCES) {
  const filePath = path.join(ROOT, source.file)
  if (!fs.existsSync(filePath)) {
    console.error('Arquivo não encontrado:', filePath)
    process.exit(1)
  }
  const rows = readSheetRows(filePath)
  const parsed = parseRows(source.periodo, rows)
  console.log(`${source.file}: ${parsed.length} obra(s)`)
  all.push(...parsed)
}

const porTipo = all.reduce((acc, obra) => {
  acc[obra.tipo] = (acc[obra.tipo] ?? 0) + 1
  return acc
}, {})

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(
  OUTPUT,
  JSON.stringify({ geradoEm: new Date().toISOString(), total: all.length, porTipo, obras: all }, null, 2),
  'utf8'
)

console.log('Total:', all.length)
console.log('Por tipo:', porTipo)
console.log('Salvo em:', OUTPUT)
