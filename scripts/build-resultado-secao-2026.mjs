#!/usr/bin/env node
/**
 * Gera data/resultado-secao-2026.json a partir de:
 * - PDFs do relatório SISTOT/TRE-PI "Resultado de votação por seção" (raiz ou scripts/), um por candidato,
 *   reconhecidos pelo conteúdo da 1ª página:
 *   · resultadoporsecao.pdf — candidato geral (sempre o 1º);
 *   · resultado<nome>.pdf — parceiros, entram nos comparativos;
 *   · <nome>.pdf — demais candidatos, só nas visões de resultado.
 * - scripts/locais-de-votacao.xlsx (endereço dos locais e seções efetivas/agregadas)
 *
 * Uso: node scripts/build-resultado-secao-2026.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const XLSX_PATH = path.join(ROOT, 'scripts', 'locais-de-votacao.xlsx')
const OUT_PATH = path.join(ROOT, 'data', 'resultado-secao-2026.json')

// Colunas do relatório SISTOT (coordenada x do texto, em pontos)
const COL_SECAO = [21, 206, 391]
const COL_VOTOS = [91, 276, 461]
const COL_TOL = 8

function normalizeChave(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const slug = (t) => normalizeChave(t).toLowerCase().replace(/\s+/g, '-')
const near = (x, cols) => cols.findIndex((c) => Math.abs(x - c) <= COL_TOL)
const toInt = (s) => Number(String(s).replace(/[.,\s]/g, ''))

const entraNoComparativo = (f) => /^resultado/i.test(path.basename(f))

async function ehRelatorioPorSecao(pdfPath) {
  try {
    const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)) }).promise
    const tc = await (await doc.getPage(1)).getTextContent()
    const texto = tc.items.map((it) => ('str' in it ? it.str : '')).join(' ')
    await doc.destroy()
    return /Candidato:/.test(texto) && /Zona Eleitoral:/.test(texto) && /Munic[ií]pio:/.test(texto)
  } catch {
    return false
  }
}

async function listarPdfs() {
  const out = []
  for (const dir of [path.join(ROOT, 'scripts'), ROOT]) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f)
      if (/\.pdf$/i.test(f) && (await ehRelatorioPorSecao(full))) out.push(full)
    }
  }
  const grupo = (f) =>
    path.basename(f).toLowerCase() === 'resultadoporsecao.pdf' ? 0 : entraNoComparativo(f) ? 1 : 2
  const salvoEm = (f) => fs.statSync(f).mtimeMs
  return out.sort((a, b) => grupo(a) - grupo(b) || salvoEm(a) - salvoEm(b) || a.localeCompare(b))
}

async function parsePdf(pdfPath) {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)) }).promise
  let data = ''
  let hora = ''
  let candidato = { numero: '', nome: '' }
  let cargo = ''
  const blocos = []
  let atual = null
  let zonaPendente = null
  let municipioPendente = null

  const abrirBloco = () => {
    if (!zonaPendente || !municipioPendente) return
    const mesmo =
      atual &&
      atual.total == null &&
      atual.zona === zonaPendente &&
      atual.municipioCodigo === municipioPendente.codigo
    if (!mesmo) {
      atual = {
        zona: zonaPendente,
        municipioCodigo: municipioPendente.codigo,
        municipio: municipioPendente.nome,
        secoes: [],
        total: null,
      }
      blocos.push(atual)
    }
    zonaPendente = null
    municipioPendente = null
  }

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const linhas = new Map()
    for (const it of tc.items) {
      if (!('str' in it)) continue
      const str = it.str.trim()
      if (!str) continue
      const y = Math.round(it.transform[5])
      const x = Math.round(it.transform[4])
      const linha = linhas.get(y) ?? []
      linha.push({ x, str })
      linhas.set(y, linha)
    }
    const ys = [...linhas.keys()].sort((a, b) => b - a)
    for (const y of ys) {
      const itens = linhas.get(y).sort((a, b) => a.x - b.x)
      const textos = itens.map((i) => i.str)

      if (p === 1) {
        data ||= textos.find((t) => /^\d{2}\/\d{2}\/\d{4}$/.test(t)) ?? ''
        hora ||= textos.find((t) => /^\d{2}:\d{2}:\d{2}$/.test(t)) ?? ''
      }
      const cargoTxt = textos.find((t) => t.startsWith('Cargo:'))
      if (cargoTxt) cargo = cargoTxt.replace('Cargo:', '').trim()

      if (textos.includes('Zona Eleitoral:')) {
        const z = itens.find((i) => /^\d{1,4}$/.test(i.str))
        if (z) zonaPendente = Number(z.str)
        abrirBloco()
        continue
      }
      if (textos.includes('Município:')) {
        const m = itens.find((i) => /^\d+ - /.test(i.str))
        if (m) {
          const [codigo, ...resto] = m.str.split(' - ')
          municipioPendente = { codigo: codigo.trim(), nome: resto.join(' - ').trim() }
        }
        abrirBloco()
        continue
      }
      if (textos.includes('Candidato:')) {
        const c = itens.find((i) => /^\d+ - /.test(i.str))
        if (c) {
          const [numero, ...resto] = c.str.split(' - ')
          candidato = { numero: numero.trim(), nome: resto.join(' - ').trim() }
        }
        continue
      }
      if (textos.includes('Total:')) {
        const v = itens.find((i) => i.str !== 'Total:')
        if (atual && v) atual.total = toInt(v.str)
        continue
      }
      if (!atual) continue

      const secoes = new Map()
      const votos = new Map()
      for (const it of itens) {
        const cs = near(it.x, COL_SECAO)
        const cv = near(it.x, COL_VOTOS)
        if (cs >= 0 && /^\d{1,4}$/.test(it.str)) secoes.set(cs, Number(it.str))
        else if (cv >= 0 && /^[\d.,]+$/.test(it.str)) votos.set(cv, toInt(it.str))
      }
      for (const [col, secao] of secoes) {
        if (!votos.has(col)) throw new Error(`${path.basename(pdfPath)}: seção ${secao} sem votos (pág. ${p})`)
        atual.secoes.push({ secao, votos: votos.get(col) })
      }
    }
  }

  const erros = []
  for (const b of blocos) {
    const soma = b.secoes.reduce((a, s) => a + s.votos, 0)
    if (b.total == null) erros.push(`sem total: ${b.municipio} zona ${b.zona}`)
    else if (soma !== b.total) erros.push(`${b.municipio} zona ${b.zona}: soma ${soma} ≠ total ${b.total}`)
  }
  if (erros.length) throw new Error(`${path.basename(pdfPath)}:\n  ${erros.join('\n  ')}`)

  return {
    arquivo: path.relative(ROOT, pdfPath),
    fonte: `${data} ${hora}`.trim(),
    candidato,
    cargo,
    blocos,
    comparativo: entraNoComparativo(pdfPath),
  }
}

function parseLocais() {
  const wb = XLSX.readFile(XLSX_PATH)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  const lista = (s) =>
    String(s ?? '')
      .split(/[,;]/)
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
  return rows.map((r, i) => {
    const get = (k) => r[Object.keys(r).find((key) => key.trim() === k)] ?? ''
    const lat = Number(String(get('Latitude')).replace(',', '.'))
    const lng = Number(String(get('Longitude')).replace(',', '.'))
    return {
      id: i + 1,
      municipio: String(get('Município')).trim(),
      zona: Number(get('Zona')),
      nome: String(get('Local de votação')).trim(),
      endereco: String(get('Endereço')).trim(),
      bairro: String(get('Bairro')).trim(),
      cep: String(get('CEP')).trim(),
      lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
      lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
      secoesEfetivas: lista(get('Seções efetivas')),
      secoesAgregadas: lista(get('Seções agregadas')),
    }
  })
}

const pdfs = await listarPdfs()
if (!pdfs.length) throw new Error('Nenhum PDF de resultado por seção (SISTOT) encontrado na raiz ou em scripts/')

const relatorios = []
for (const f of pdfs) {
  const r = await parsePdf(f)
  if (relatorios.some((x) => x.candidato.numero === r.candidato.numero && x.cargo === r.cargo)) {
    console.warn(`Ignorado (duplicado): ${r.arquivo}`)
    continue
  }
  relatorios.push(r)
}

const locais = parseLocais()
const localPorSecao = new Map()
for (const l of locais) {
  for (const s of [...l.secoesEfetivas, ...l.secoesAgregadas]) {
    localPorSecao.set(`${normalizeChave(l.municipio)}|${l.zona}|${s}`, l.id)
  }
}

const municipiosMap = new Map()
const secoesMap = new Map()
relatorios.forEach((r, ci) => {
  for (const b of r.blocos) {
    if (!municipiosMap.has(b.municipioCodigo)) {
      municipiosMap.set(b.municipioCodigo, { codigo: b.municipioCodigo, nome: b.municipio, chave: normalizeChave(b.municipio) })
    }
    const m = municipiosMap.get(b.municipioCodigo)
    for (const s of b.secoes) {
      const key = `${b.municipioCodigo}|${b.zona}|${s.secao}`
      const cur = secoesMap.get(key) ?? {
        m: b.municipioCodigo,
        z: b.zona,
        s: s.secao,
        l: localPorSecao.get(`${m.chave}|${b.zona}|${s.secao}`) ?? null,
        v: relatorios.map(() => 0),
      }
      cur.v[ci] = s.votos
      secoesMap.set(key, cur)
    }
  }
})

const secoes = [...secoesMap.values()].sort((a, b) => a.m.localeCompare(b.m) || a.z - b.z || a.s - b.s)
const semLocal = secoes.filter((s) => s.l == null).length
const locaisUsados = new Set(secoes.map((s) => s.l).filter((x) => x != null))

const candidatos = relatorios.map((r, ci) => ({
  id: slug(r.candidato.nome),
  nome: r.candidato.nome,
  numero: r.candidato.numero,
  cargo: r.cargo,
  fonte: `SISTOT · TRE-PI · ${r.fonte}`,
  totalVotos: secoes.reduce((a, s) => a + s.v[ci], 0),
  secoesNoRelatorio: r.blocos.reduce((a, b) => a + b.secoes.length, 0),
  comparativo: r.comparativo,
}))

const out = {
  meta: {
    eleicao: 'Eleições Gerais 2026',
    turno: 1,
    geradoEm: new Date().toISOString(),
    totalSecoes: secoes.length,
    totalMunicipios: municipiosMap.size,
  },
  candidatos,
  municipios: [...municipiosMap.values()].map(({ codigo, nome }) => ({ codigo, nome })),
  locais: locais
    .filter((l) => locaisUsados.has(l.id))
    .map(({ secoesEfetivas, secoesAgregadas, ...l }) => l),
  secoes,
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
fs.writeFileSync(OUT_PATH, JSON.stringify(out))
for (const c of candidatos) {
  console.log(
    `· ${c.nome} (${c.numero}) ${c.cargo}: ${c.totalVotos} votos em ${c.secoesNoRelatorio} seções${
      c.comparativo ? '' : ' [só resultados]'
    }`,
  )
}
console.log(
  `ok · ${secoes.length} seções · ${municipiosMap.size} municípios · ${out.locais.length} locais · ${semLocal} seções sem local`,
)
