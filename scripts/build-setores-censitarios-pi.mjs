#!/usr/bin/env node
/**
 * Gera cache de setores censitários do Piauí (malha IBGE 2022 + população agregados).
 *
 * Saídas:
 *   data/setores-censitarios-pi-2022/index.json
 *   data/setores-censitarios-pi-2022/municipios/{chave}.json
 *
 * Uso:
 *   node scripts/build-setores-censitarios-pi.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { execSync } from 'child_process'
import { open as openShapefile } from 'shapefile'
import centroid from '@turf/centroid'
import simplify from '@turf/simplify'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CACHE = path.join(ROOT, '.cache', 'ibge-setores')
const OUT_DIR = path.join(ROOT, 'data', 'setores-censitarios-pi-2022')
const OUT_MUN = path.join(OUT_DIR, 'municipios')

const URLS = {
  agregados:
    'https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios/Agregados_por_Setor_csv/Agregados_por_setores_basico_BR_20260520.zip',
  malha:
    'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/setores/shp/UF/PI_setores_CD2022.zip',
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

function fixLatin1(s) {
  if (!s) return s
  try {
    return Buffer.from(s, 'latin1').toString('utf8')
  } catch {
    return s
  }
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

function ensureFile(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return dest
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  console.log(`Baixando ${url}…`)
  execSync(`/usr/bin/curl -fsSL "${url}" -o "${dest}"`, { stdio: 'inherit' })
  return dest
}

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  execSync(`unzip -o -q "${zipPath}" -d "${destDir}"`)
  return destDir
}

async function loadPopulacaoPorSetor(csvPath) {
  const mapa = new Map()
  const rl = createInterface({ input: createReadStream(csvPath, { encoding: 'latin1' }), crlfDelay: Infinity })
  let headers = null
  let linhasPi = 0

  for await (const line of rl) {
    if (!line.trim()) continue
    const cols = parseCsvLine(line)
    if (!headers) {
      headers = cols.map((h) => h.replace(/^"|"$/g, '').toLowerCase())
      continue
    }
    const row = {}
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? '').replace(/^"|"$/g, '')
    })
    if (row.cd_uf !== '22') continue
    linhasPi += 1
    const cdSetor = row.cd_setor
    if (!cdSetor) continue
    mapa.set(cdSetor, {
      populacao: Number.parseInt(row.v0001 ?? '0', 10) || 0,
      domicilios: Number.parseInt(row.v0002 ?? '0', 10) || 0,
    })
  }

  console.log(`Agregados PI: ${linhasPi} setores · mapa ${mapa.size}`)
  return mapa
}

function simplificarGeometria(geometry) {
  try {
    const feature = { type: 'Feature', properties: {}, geometry }
    const simplified = simplify(feature, { tolerance: 0.00025, highQuality: false })
    return simplified.geometry
  } catch {
    return geometry
  }
}

function centroideDeGeometria(geometry) {
  try {
    const c = centroid({ type: 'Feature', properties: {}, geometry })
    const [lng, lat] = c.geometry.coordinates
    return { lat, lng }
  } catch {
    return null
  }
}

function isUrbano(props) {
  const sit = String(props.CD_SIT ?? props.cd_sit ?? '')
  const situacao = String(props.SITUACAO ?? props.situacao ?? '').toLowerCase()
  if (sit === '1') return true
  if (situacao.includes('urbana')) return true
  return false
}

function rotuloSetor(props) {
  const bairro = fixLatin1(String(props.NM_BAIRRO ?? '').trim())
  if (bairro) return bairro
  const cd = String(props.CD_SETOR ?? '')
  const sufixo = cd.slice(-4)
  return `Setor ${sufixo}`
}

async function main() {
  const agZip = ensureFile(URLS.agregados, path.join(CACHE, 'agregados.zip'))
  const shpZip = ensureFile(URLS.malha, path.join(CACHE, 'PI_setores.zip'))

  const agDir = extractZip(agZip, path.join(CACHE, 'agregados_extract'))
  const csvPath = fs.readdirSync(agDir).find((f) => f.endsWith('.csv'))
  if (!csvPath) throw new Error('CSV agregados não encontrado')
  const populacao = await loadPopulacaoPorSetor(path.join(agDir, csvPath))

  const shpDir = extractZip(shpZip, path.join(CACHE, 'shp_extract'))
  const shpFile = fs.readdirSync(shpDir).find((f) => f.endsWith('.shp'))
  if (!shpFile) throw new Error('Shapefile não encontrado')

  fs.mkdirSync(OUT_MUN, { recursive: true })

  const porMunicipio = new Map()
  const source = await openShapefile(path.join(shpDir, shpFile))
  let totalSetores = 0

  while (true) {
    const result = await source.read()
    if (result.done) break
    const feature = result.value
    const props = feature.properties ?? {}
    const cdSetor = String(props.CD_SETOR ?? '')
    const cdMun = String(props.CD_MUN ?? '')
    const nmMun = titleCaseMunicipio(fixLatin1(String(props.NM_MUN ?? '')))
    const chave = normalizeChave(nmMun)
    if (!chave || !cdSetor) continue

    const pop = populacao.get(cdSetor) ?? { populacao: 0, domicilios: 0 }
    const geometry = simplificarGeometria(feature.geometry)
    const centroide = centroideDeGeometria(geometry)

    const setor = {
      cdSetor,
      cdMunicipio: cdMun,
      nmMunicipio: nmMun,
      rotulo: rotuloSetor(props),
      situacao: fixLatin1(String(props.SITUACAO ?? '')),
      cdSit: String(props.CD_SIT ?? ''),
      urbano: isUrbano(props),
      populacao: pop.populacao,
      domicilios: pop.domicilios,
      areaKm2: Number(props.AREA_KM2) || null,
      centroide,
      geometry,
    }

    if (!porMunicipio.has(chave)) {
      porMunicipio.set(chave, { nmMunicipio: nmMun, cdMunicipio: cdMun, setores: [] })
    }
    porMunicipio.get(chave).setores.push(setor)
    totalSetores += 1
  }

  const indexMunicipios = []
  for (const [chave, entry] of porMunicipio.entries()) {
    entry.setores.sort((a, b) => b.populacao - a.populacao)
    const arquivo = `${chave}.json`
    fs.writeFileSync(
      path.join(OUT_MUN, arquivo),
      JSON.stringify(
        {
          chave,
          cdMunicipio: entry.cdMunicipio,
          nmMunicipio: entry.nmMunicipio,
          totalSetores: entry.setores.length,
          setores: entry.setores,
        },
        null,
        0,
      ),
    )
    indexMunicipios.push({
      chave,
      nmMunicipio: entry.nmMunicipio,
      cdMunicipio: entry.cdMunicipio,
      totalSetores: entry.setores.length,
      arquivo,
    })
  }

  indexMunicipios.sort((a, b) => a.nmMunicipio.localeCompare(b.nmMunicipio, 'pt-BR'))

  fs.writeFileSync(
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify(
      {
        ano: 2022,
        fonte: 'IBGE Malha Setores Censitários CD2022 + Agregados básicos por setor',
        geradoEm: new Date().toISOString(),
        totalSetores,
        totalMunicipios: indexMunicipios.length,
        municipios: indexMunicipios,
      },
      null,
      2,
    ),
  )

  console.log('')
  console.log('Setores censitários PI gerados')
  console.log(`  Setores: ${totalSetores}`)
  console.log(`  Municípios: ${indexMunicipios.length}`)
  console.log(`  Saída: ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
