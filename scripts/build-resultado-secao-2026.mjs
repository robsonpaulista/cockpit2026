#!/usr/bin/env node
/**
 * Resultado 2026 (Deputado Federal e Estadual · PI) a partir dos arquivos do TSE na raiz do projeto:
 * - votacao_secao-deputado_federal_t1_2026_pi.csv.zip
 * - votacao_secao-deputado_estadual_t1_2026_pi.csv.zip
 * - consulta_cand_2026_PI.csv (nome de urna, partido e situação; extraído de consulta_cand_2026.zip)
 *
 * Gera:
 * - data/resultado-secao-2026.json — votos por seção de todos os candidatos (tela Resultado 2026).
 *   Locais de votação e a marcação de dobradinha (`comparativo`) são preservados do arquivo anterior.
 * - data/votacao-deputados-2026-municipio.json — votos por município (quadros de Atendimento).
 *
 * Uso: node scripts/build-resultado-secao-2026.mjs
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SECAO_PATH = path.join(ROOT, 'data', 'resultado-secao-2026.json')
const MUNICIPIO_PATH = path.join(ROOT, 'data', 'votacao-deputados-2026-municipio.json')
const CANDIDATOS_PATH = path.join(ROOT, 'consulta_cand_2026_PI.csv')
const VOTACOES = [
  { cargo: 'Deputado Federal', zip: 'votacao_secao-deputado_federal_t1_2026_pi.csv.zip' },
  { cargo: 'Deputado Estadual', zip: 'votacao_secao-deputado_estadual_t1_2026_pi.csv.zip' },
]

const slug = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function parseLinha(linha) {
  if (!linha.includes('"')) return linha.split(';')
  const out = []
  let atual = ''
  let aspas = false
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i]
    if (aspas) {
      if (ch === '"' && linha[i + 1] === '"') {
        atual += '"'
        i++
      } else if (ch === '"') aspas = false
      else atual += ch
    } else if (ch === '"') aspas = true
    else if (ch === ';') {
      out.push(atual)
      atual = ''
    } else atual += ch
  }
  out.push(atual)
  return out
}

async function lerCsv(stream, onLinha) {
  stream.setEncoding('latin1')
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  let indice = null
  for await (const linha of rl) {
    if (!linha) continue
    const campos = parseLinha(linha)
    if (!indice) {
      indice = Object.fromEntries(campos.map((c, i) => [c.trim().toUpperCase(), i]))
      continue
    }
    onLinha(campos, indice)
  }
}

function exigir(arquivo) {
  if (!fs.existsSync(arquivo)) {
    console.error(`Arquivo não encontrado: ${path.relative(ROOT, arquivo)}`)
    process.exit(1)
  }
}

async function main() {
  exigir(CANDIDATOS_PATH)
  for (const v of VOTACOES) exigir(path.join(ROOT, v.zip))

  const anterior = fs.existsSync(SECAO_PATH) ? JSON.parse(fs.readFileSync(SECAO_PATH, 'utf8')) : null
  const locais = anterior?.locais ?? []
  const localPorSecao = new Map((anterior?.secoes ?? []).map((s) => [`${s.m}|${s.z}|${s.s}`, s.l]))
  const comparativoAnterior = (anterior?.candidatos ?? [])
    .filter((c) => c.comparativo)
    .map((c) => `${c.cargo}|${c.numero}`)

  const cadastro = new Map()
  await lerCsv(fs.createReadStream(CANDIDATOS_PATH), (c, ix) => {
    if (!/DEPUTADO (FEDERAL|ESTADUAL)/.test(c[ix.DS_CARGO] ?? '')) return
    const situacao = (c[ix.DS_SIT_TOT_TURNO] ?? '').trim()
    cadastro.set(c[ix.SQ_CANDIDATO], {
      urna: (c[ix.NM_URNA_CANDIDATO] ?? '').trim(),
      partido: (c[ix.SG_PARTIDO] ?? '').trim(),
      situacao: situacao === '#NULO' ? '' : situacao,
    })
  })

  const candidatos = new Map()
  const municipios = new Map()
  const secoes = new Map()
  let dataCarga = ''

  for (const { cargo, zip } of VOTACOES) {
    const proc = spawn('unzip', ['-p', path.join(ROOT, zip)])
    await lerCsv(proc.stdout, (c, ix) => {
      const numero = (c[ix.NR_VOTAVEL] ?? '').trim()
      if (numero.length < 4) return
      const sq = (c[ix.SQ_CANDIDATO] ?? '').trim()
      const qt = Number(c[ix.QT_VOTOS] ?? 0)
      if (!sq || !Number.isFinite(qt) || qt <= 0) return

      const m = (c[ix.CD_MUNICIPIO] ?? '').trim()
      const z = Number(c[ix.NR_ZONA])
      const s = Number(c[ix.NR_SECAO])
      if (!municipios.has(m)) municipios.set(m, (c[ix.NM_MUNICIPIO] ?? '').trim())
      dataCarga ||= (c[ix.DT_CARGA] ?? '').trim()

      let cand = candidatos.get(sq)
      if (!cand) {
        const info = cadastro.get(sq)
        const nomeCivil = (c[ix.NM_VOTAVEL] ?? '').trim()
        cand = {
          sq,
          numero,
          cargo,
          urna: info?.urna || nomeCivil,
          nome: nomeCivil,
          partido: info?.partido ?? '',
          situacao: info?.situacao ?? '',
          porSecao: new Map(),
          porMunicipio: new Map(),
          total: 0,
        }
        candidatos.set(sq, cand)
      }
      const chave = `${m}|${z}|${s}`
      if (!secoes.has(chave)) secoes.set(chave, { m, z, s, cargos: new Set() })
      secoes.get(chave).cargos.add(cargo)
      cand.porSecao.set(chave, (cand.porSecao.get(chave) ?? 0) + qt)
      cand.porMunicipio.set(m, (cand.porMunicipio.get(m) ?? 0) + qt)
      cand.total += qt
    })
  }

  const ordemCargo = (cargo) => VOTACOES.findIndex((v) => v.cargo === cargo)
  const posComparativo = (c) => {
    const i = comparativoAnterior.indexOf(`${c.cargo}|${c.numero}`)
    return i < 0 ? Number.POSITIVE_INFINITY : i
  }
  const lista = [...candidatos.values()].sort(
    (a, b) =>
      posComparativo(a) - posComparativo(b) ||
      ordemCargo(a.cargo) - ordemCargo(b.cargo) ||
      b.total - a.total,
  )

  const listaSecoes = [...secoes.values()].sort((a, b) => a.m.localeCompare(b.m) || a.z - b.z || a.s - b.s)
  const secoesPorCargo = (cargo) => listaSecoes.filter((s) => s.cargos.has(cargo)).length
  const fonte = `TSE · votação por seção · carga ${dataCarga.slice(0, 10).split('-').reverse().join('/')}`
  const listaMunicipios = [...municipios.entries()]
    .map(([codigo, nome]) => ({ codigo, nome }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo))

  const resultadoSecao = {
    meta: {
      eleicao: 'Eleições Gerais 2026',
      turno: 1,
      geradoEm: new Date().toISOString(),
      totalSecoes: listaSecoes.length,
      totalMunicipios: municipios.size,
    },
    candidatos: lista.map((c) => ({
      id: `${slug(c.urna)}-${c.numero}`,
      nome: c.urna,
      numero: c.numero,
      cargo: c.cargo,
      fonte,
      totalVotos: c.total,
      secoesNoRelatorio: secoesPorCargo(c.cargo),
      comparativo: Number.isFinite(posComparativo(c)),
    })),
    municipios: listaMunicipios,
    locais,
    secoes: listaSecoes.map((s) => {
      const chave = `${s.m}|${s.z}|${s.s}`
      return {
        m: s.m,
        z: s.z,
        s: s.s,
        l: localPorSecao.get(chave) ?? null,
        v: lista.map((c) => c.porSecao.get(chave) ?? 0),
      }
    }),
  }
  fs.writeFileSync(SECAO_PATH, JSON.stringify(resultadoSecao))

  const idxMunicipio = new Map(listaMunicipios.map((m, i) => [m.codigo, i]))
  const votacaoMunicipio = {
    meta: {
      eleicao: 'Eleições Gerais 2026',
      turno: 1,
      uf: 'PI',
      fonte: `${fonte} · consulta de candidatos`,
      geradoEm: resultadoSecao.meta.geradoEm,
    },
    candidatos: lista.map(({ sq, numero, cargo, urna, nome, partido, situacao }) => ({
      sq,
      numero,
      cargo,
      urna,
      nome,
      partido,
      situacao,
    })),
    municipios: listaMunicipios,
    votos: lista.flatMap((c, ci) =>
      [...c.porMunicipio.entries()].map(([m, v]) => [idxMunicipio.get(m), ci, v]),
    ),
  }
  fs.writeFileSync(MUNICIPIO_PATH, JSON.stringify(votacaoMunicipio))

  const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`
  const semLocal = resultadoSecao.secoes.filter((s) => s.l == null).length
  const semCadastro = lista.filter((c) => !cadastro.has(c.sq)).length
  for (const c of resultadoSecao.candidatos.filter((x) => x.comparativo)) {
    console.log(`· ${c.nome} (${c.numero}) ${c.cargo}: ${c.totalVotos} votos [comparativo]`)
  }
  console.log(
    `ok · ${lista.length} candidatos · ${listaSecoes.length} seções · ${municipios.size} municípios · ` +
      `${semLocal} seções sem local${semCadastro ? ` · ${semCadastro} sem cadastro` : ''}`,
  )
  console.log(`  ${path.relative(ROOT, SECAO_PATH)} (${kb(SECAO_PATH)}) · ${path.relative(ROOT, MUNICIPIO_PATH)} (${kb(MUNICIPIO_PATH)})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
