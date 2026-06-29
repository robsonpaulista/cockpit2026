#!/usr/bin/env node
/**
 * Atualiza lib/eleitores-piaui.json a partir de quantidade_de_eleitores.csv (TSE).
 * O CSV traz uma linha por zona eleitoral — somamos por município.
 *
 * Uso:
 *   node scripts/atualizar-eleitores-piaui.mjs
 *   node scripts/atualizar-eleitores-piaui.mjs --input caminho/para/arquivo.csv
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const DEFAULT_INPUT = path.join(ROOT, 'quantidade_de_eleitores.csv')
const OUTPUT_JSON = path.join(ROOT, 'lib', 'eleitores-piaui.json')

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) {
      args.input = path.resolve(argv[++i])
    }
  }
  return args
}

function parseQuantidadeBr(raw) {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Quantidade inválida: "${raw}"`)
  }
  return Math.round(n)
}

function normalizeMunicipio(nome) {
  return String(nome ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function parseCsvLine(line) {
  return line.split(';').map((part) => part.trim())
}

function aggregateEleitoresFromCsv(filePath) {
  const buffer = fs.readFileSync(filePath)
  const text = buffer.toString('latin1')
  const lines = text.split(/\r?\n/).filter((line) => line.trim())

  if (lines.length < 2) {
    throw new Error('CSV vazio ou sem dados.')
  }

  const header = parseCsvLine(lines[0])
  const idxMesAno = header.findIndex((h) => h.toLowerCase().includes('mês') || h.toLowerCase().includes('mes'))
  const idxUf = header.findIndex((h) => h.toUpperCase() === 'UF')
  const idxMunicipio = header.findIndex((h) => h.toLowerCase().includes('munic'))
  const idxZona = header.findIndex((h) => h.toLowerCase() === 'zona')
  const idxQuantidade = header.findIndex((h) => h.toLowerCase().includes('quantidade'))

  if (idxMunicipio < 0 || idxQuantidade < 0) {
    throw new Error(`Cabeçalho inesperado: ${header.join(';')}`)
  }

  const porMunicipio = new Map()
  const referencias = new Set()
  let linhas = 0
  let zonas = 0

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line)
    if (cols.length < header.length) continue

    const municipio = normalizeMunicipio(cols[idxMunicipio])
    if (!municipio) continue

    const quantidade = parseQuantidadeBr(cols[idxQuantidade])
    porMunicipio.set(municipio, (porMunicipio.get(municipio) ?? 0) + quantidade)

    if (idxMesAno >= 0 && cols[idxMesAno]) {
      referencias.add(cols[idxMesAno].trim())
    }

    linhas += 1
    if (idxZona >= 0 && cols[idxZona]) zonas += 1
  }

  const referenciaLista = [...referencias]
  const referencia = referenciaLista.length === 1 ? referenciaLista[0] : referenciaLista.join(' | ')
  const referenciaAno = referenciaLista
    .map((item) => {
      const match = item.match(/\b(19|20)\d{2}\b/)
      return match ? Number(match[0]) : null
    })
    .filter((ano) => ano != null)

  const dados = [...porMunicipio.entries()]
    .map(([municipio, eleitorado]) => ({ municipio, eleitorado }))
    .sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'))

  return {
    referencia,
    referenciaAnoMin: referenciaAno.length ? Math.min(...referenciaAno) : null,
    referenciaAnoMax: referenciaAno.length ? Math.max(...referenciaAno) : null,
    uf: idxUf >= 0 ? parseCsvLine(lines[1])[idxUf] : 'PI',
    linhas,
    zonas,
    municipios: dados.length,
    totalEleitorado: dados.reduce((s, item) => s + item.eleitorado, 0),
    dados,
  }
}

function main() {
  const { input } = parseArgs(process.argv)

  if (!fs.existsSync(input)) {
    console.error(`Arquivo não encontrado: ${input}`)
    process.exit(1)
  }

  const anterior = fs.existsSync(OUTPUT_JSON)
    ? JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'))
    : []

  const agregado = aggregateEleitoresFromCsv(input)

  const anoAtual = new Date().getFullYear()
  if (agregado.referenciaAnoMax != null && agregado.referenciaAnoMax < anoAtual - 1) {
    console.warn('')
    console.warn('⚠️  ATENÇÃO: a planilha parece desatualizada.')
    console.warn(`   Referência no arquivo: ${agregado.referencia ?? agregado.referenciaAnoMax}`)
    console.warn('   Para eleições municipais recentes, use o CSV do TSE (ex.: eleitorado 2024).')
    console.warn('   https://dadosabertos.tse.jus.br/dataset/eleitorado-2024')
    console.warn('')
  }

  if (!process.argv.includes('--force')) {
    console.error('Importação abortada. Use --force para gravar mesmo com referência antiga.')
    process.exit(1)
  }

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(agregado.dados, null, 2)}\n`, 'utf8')

  const anteriorMap = new Map(anterior.map((item) => [item.municipio.toUpperCase(), item.eleitorado]))
  let alterados = 0
  for (const item of agregado.dados) {
    const prev = anteriorMap.get(item.municipio)
    if (prev !== item.eleitorado) alterados += 1
  }

  console.log('Eleitorado PI atualizado')
  console.log(`  Fonte: ${input}`)
  if (agregado.referencia) console.log(`  Referência: ${agregado.referencia}`)
  console.log(`  Linhas lidas: ${agregado.linhas} (${agregado.zonas} zonas)`)
  console.log(`  Municípios: ${agregado.municipios}`)
  console.log(`  Total eleitorado: ${agregado.totalEleitorado.toLocaleString('pt-BR')}`)
  console.log(`  Saída: ${OUTPUT_JSON}`)
  console.log(`  Municípios alterados vs. JSON anterior: ${alterados}/${agregado.municipios}`)
}

main()
