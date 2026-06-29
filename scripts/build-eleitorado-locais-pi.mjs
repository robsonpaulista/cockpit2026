#!/usr/bin/env node
/**
 * Gera cache estático a partir do ZIP TSE "Eleitorado por local de votação".
 * - data/eleitorado-locais-pi-2024.json (locais por municipio_chave)
 * - lib/eleitores-piaui.json (totais por município)
 *
 * Uso:
 *   node scripts/build-eleitorado-locais-pi.mjs
 *   node scripts/build-eleitorado-locais-pi.mjs --ano 2024
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CACHE_DIR = path.join(ROOT, '.cache')

const URLS = {
  2024: 'https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2024.zip',
  2022: 'https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2022.zip',
}

function parseArgs(argv) {
  let ano = 2024
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--ano' && argv[i + 1]) ano = Number(argv[++i])
  }
  if (![2022, 2024].includes(ano)) throw new Error('Ano deve ser 2022 ou 2024')
  return { ano }
}

function normalizeChave(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function titleCaseMunicipio(nome) {
  const lower = new Set(['de', 'do', 'da', 'dos', 'das', 'e'])
  return String(nome ?? '')
    .trim()
    .split(/\s+/)
    .map((part, i) => {
      const p = part.toLowerCase()
      if (i > 0 && lower.has(p)) return p
      return p.charAt(0).toUpperCase() + p.slice(1)
    })
    .join(' ')
}

function parseIntSafe(v) {
  const n = Number.parseInt(String(v ?? '').trim(), 10)
  return Number.isFinite(n) ? n : 0
}

function parseFloatCoord(v) {
  const s = String(v ?? '').trim()
  if (!s || s === '-1') return null
  const n = Number.parseFloat(s.replace(',', '.'))
  if (!Number.isFinite(n) || n === 0) return null
  if (n < -90 || n > 90) {
    // longitude passed as latitude slot — handled separately
  }
  return n
}

function parseCoordPair(latRaw, lngRaw) {
  const lat = parseFloatCoord(latRaw)
  const lng = parseFloatCoord(lngRaw)
  if (lat == null || lng == null) return { lat: null, lng: null }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { lat: null, lng: null }
  return { lat, lng }
}

function isZonaRural(row) {
  const endereco = String(row.DS_ENDERECO ?? '').toUpperCase()
  const bairro = String(row.NM_BAIRRO ?? '').toUpperCase()
  const tipo = String(row.DS_TIPO_LOCAL ?? '').toUpperCase()
  if (endereco.includes('ZONA RURAL') || endereco.includes('POVOADO')) return true
  if (bairro.includes('RURAL') || bairro.includes('POVOADO') || bairro.includes('DISTRITO')) return true
  if (tipo.includes('RURAL')) return true
  return false
}

function ensureZip(ano) {
  const zipPath = path.join(CACHE_DIR, `eleitorado_local_votacao_${ano}.zip`)
  if (fs.existsSync(zipPath) && fs.statSync(zipPath).size > 1_000_000) {
    return zipPath
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const url = URLS[ano]
  console.log(`Baixando ${url}…`)
  execSync(`curl -fsSL "${url}" -o "${zipPath}"`, { stdio: 'inherit' })
  return zipPath
}

function extractCsvFromZip(zipPath) {
  const tmpDir = path.join(CACHE_DIR, '_eleitorado_extract')
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(`unzip -o -q "${zipPath}" -d "${tmpDir}"`)
  const files = fs.readdirSync(tmpDir).filter((f) => f.toLowerCase().endsWith('.csv'))
  if (!files.length) throw new Error('CSV não encontrado no ZIP')
  return path.join(tmpDir, files[0])
}

function parseCsvLine(line) {
  const parts = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ';' && !inQuotes) {
      parts.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  parts.push(cur.trim())
  return parts
}

async function processCsv(csvPath) {
  const rl = createInterface({ input: createReadStream(csvPath, { encoding: 'latin1' }), crlfDelay: Infinity })
  let headers = null
  const porMunicipio = {}
  const eleitoradoMunicipio = new Map()
  let linhasPi = 0

  for await (const line of rl) {
    if (!line.trim()) continue
    const cols = parseCsvLine(line)
    if (!headers) {
      headers = cols.map((h) => h.replace(/^"|"$/g, ''))
      continue
    }
    const row = {}
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? '').replace(/^"|"$/g, '')
    })
    if ((row.SG_UF ?? '').trim().toUpperCase() !== 'PI') continue
    linhasPi += 1

    const nmMunicipio = titleCaseMunicipio(row.NM_MUNICIPIO)
    const chave = normalizeChave(nmMunicipio)
    if (!chave) continue

    const qt = parseIntSafe(row.QT_ELEITOR_SECAO)
    eleitoradoMunicipio.set(nmMunicipio, (eleitoradoMunicipio.get(nmMunicipio) ?? 0) + qt)

    const { lat, lng } = parseCoordPair(row.NR_LATITUDE, row.NR_LONGITUDE)
    const local = {
      nrZona: parseIntSafe(row.NR_ZONA),
      nrSecao: parseIntSafe(row.NR_SECAO),
      nrLocalVotacao: parseIntSafe(row.NR_LOCAL_VOTACAO) || null,
      nmLocalVotacao: (row.NM_LOCAL_VOTACAO ?? '').trim() || null,
      dsEndereco: (row.DS_ENDERECO ?? '').trim() || null,
      nmBairro: (row.NM_BAIRRO ?? '').trim() || null,
      nrCep: (row.NR_CEP ?? '').trim() || null,
      nrLatitude: lat,
      nrLongitude: lng,
      qtEleitoresSecao: qt,
      dsTipoLocal: (row.DS_TIPO_LOCAL ?? '').trim() || null,
      zonaRural: isZonaRural(row),
    }

    if (!porMunicipio[chave]) porMunicipio[chave] = { nmMunicipio, locais: [] }
    porMunicipio[chave].locais.push(local)
  }

  return { porMunicipio, eleitoradoMunicipio, linhasPi }
}

async function main() {
  const { ano } = parseArgs(process.argv)
  const zipPath = ensureZip(ano)
  const csvPath = extractCsvFromZip(zipPath)
  console.log(`Processando ${csvPath}…`)

  const { porMunicipio, eleitoradoMunicipio, linhasPi } = await processCsv(csvPath)

  const outLocais = path.join(ROOT, 'data', `eleitorado-locais-pi-${ano}.json`)
  fs.writeFileSync(
    outLocais,
    JSON.stringify(
      {
        ano,
        fonte: 'TSE Eleitorado por local de votação',
        geradoEm: new Date().toISOString(),
        municipios: porMunicipio,
      },
      null,
      0,
    ),
  )

  const eleitores = [...eleitoradoMunicipio.entries()]
    .map(([municipio, eleitorado]) => ({ municipio, eleitorado }))
    .sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'))

  const outEleitores = path.join(ROOT, 'lib', 'eleitores-piaui.json')
  fs.writeFileSync(outEleitores, `${JSON.stringify(eleitores, null, 2)}\n`)

  const totalEleitorado = eleitores.reduce((s, e) => s + e.eleitorado, 0)
  const locaisComGeo = Object.values(porMunicipio).reduce(
    (s, m) => s + m.locais.filter((l) => l.nrLatitude != null && l.nrLongitude != null).length,
    0,
  )

  console.log('')
  console.log('Cache TSE gerado')
  console.log(`  Ano: ${ano}`)
  console.log(`  Linhas PI: ${linhasPi}`)
  console.log(`  Municípios: ${eleitores.length}`)
  console.log(`  Total eleitorado: ${totalEleitorado.toLocaleString('pt-BR')}`)
  console.log(`  Locais com coordenadas: ${locaisComGeo}`)
  console.log(`  Saída locais: ${outLocais}`)
  console.log(`  Saída eleitorado: ${outEleitores}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
