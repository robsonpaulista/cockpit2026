#!/usr/bin/env node
/**
 * Coleta perfil demográfico dos municípios do Piauí via IBGE/SIDRA.
 *
 * Fontes:
 * - Localidades IBGE (municipios, meso e microrregião)
 * - SIDRA Tabela 9514 (Censo 2022: população por idade e sexo)
 * - SIDRA Tabela 9605 (Censo 2022: população por cor/raça)
 * - SIDRA Tabela 9543 (Censo 2022: taxa de alfabetização 15+)
 * - SIDRA Tabela 9923 (Censo 2022: população urbana/rural)
 * - SIDRA Tabela 6579 (estimativa populacional mais recente)
 * - Ipeadata OData (IPEA/Atlas DH): ADH_RDPC e ADH_PPOB (municipal)
 *
 * Saídas:
 * - data/demografia-municipios-piaui.json
 * - data/demografia-municipios-piaui.csv
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUTPUT_JSON = path.join(ROOT, 'data', 'demografia-municipios-piaui.json')
const OUTPUT_CSV = path.join(ROOT, 'data', 'demografia-municipios-piaui.csv')

const LOCALIDADES_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades'
const SIDRA_BASE = 'https://apisidra.ibge.gov.br/values'
const IPEADATA_BASE = 'http://www.ipeadata.gov.br/api/odata4'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ${response.status} em ${url}\n${body.slice(0, 300)}`)
  }

  return response.json()
}

async function fetchTextWithRetry(url, retries = 3) {
  let lastError = null
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { headers: { Accept: 'text/plain,*/*' } })
      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Falha ${response.status} em ${url}\n${body.slice(0, 200)}`)
      }
      return response.text()
    } catch (error) {
      lastError = error
      await sleep(250 * (i + 1))
    }
  }
  throw lastError
}

function sidraRows(payload) {
  if (!Array.isArray(payload) || payload.length <= 1) return []
  return payload.slice(1)
}

function municipioNomeLimpo(nome) {
  return String(nome || '').replace(/\s*[-(].*$/, '').trim()
}

function toInt(valor) {
  const n = Number(String(valor || '').replace(/\./g, '').trim())
  return Number.isFinite(n) ? Math.round(n) : null
}

function parseIntervaloIdade(label) {
  const texto = String(label || '').trim().toLowerCase()
  if (!texto) return null
  if (texto === 'total') return null

  // Usamos somente intervalos consolidados para evitar sobreposição.
  const faixa = texto.match(/^(\d+)\s+a\s+(\d+)\s+anos$/)
  if (faixa) return { inicio: Number(faixa[1]), fim: Number(faixa[2]) }

  if (texto === '100 anos ou mais') return { inicio: 100, fim: 130 }
  return null
}

function emptyDemografia() {
  return {
    populacao_censo_2022: null,
    populacao_estimada_ultimo_ano: null,
    ano_estimativa: null,
    sexo: {
      masculino: null,
      feminino: null,
      total: null,
    },
    faixas_etarias: {
      de_0_a_14: null,
      de_15_a_59: null,
      de_60_ou_mais: null,
      total: null,
    },
    cor_raca: {
      branca: null,
      preta: null,
      parda: null,
      amarela: null,
      indigena: null,
      total: null,
    },
    alfabetizacao: {
      taxa_15_mais: null,
      taxa_analfabetismo_15_mais: null,
    },
    urbanizacao: {
      urbana: null,
      rural: null,
      total: null,
      taxa_urbana: null,
      taxa_rural: null,
      nota_fonte: null,
    },
    renda_vulnerabilidade: {
      renda_per_capita: null,
      percentual_vulneraveis_pobreza: null,
      fonte: 'ipeadata_adh_rdpc_ppob',
      ano_referencia: null,
    },
  }
}

function extrairCorRaca(rows9605) {
  const out = {
    branca: null,
    preta: null,
    parda: null,
    amarela: null,
    indigena: null,
    total: null,
  }

  for (const row of rows9605) {
    if (row.D2C !== '93') continue
    if (String(row.MN || '').toLowerCase() !== 'pessoas') continue
    const key = String(row.D4N || '').toLowerCase()
    const valor = toInt(row.V)
    if (key === 'branca') out.branca = valor
    else if (key === 'preta') out.preta = valor
    else if (key === 'parda') out.parda = valor
    else if (key === 'amarela') out.amarela = valor
    else if (key.includes('ind')) out.indigena = valor
    else if (key === 'total') out.total = valor
  }

  return out
}

function extrairTaxaAlfabetizacao(rows9543) {
  const row = rows9543.find((item) => item.D2C === '2513' && String(item.D4N || '').toLowerCase() === 'total')
  const taxa = row ? Number(String(row.V || '').replace(',', '.')) : null
  if (!Number.isFinite(taxa)) {
    return {
      taxa_15_mais: null,
      taxa_analfabetismo_15_mais: null,
    }
  }
  const analfabetismo = Math.max(0, 100 - Number(taxa))
  return {
    taxa_15_mais: Number(taxa.toFixed(2)),
    taxa_analfabetismo_15_mais: Number(analfabetismo.toFixed(2)),
  }
}

function extrairUrbanizacao(rows9923) {
  let urbana = null
  let rural = null
  let total = null

  for (const row of rows9923) {
    if (row.D2C !== '93') continue
    if (String(row.MN || '').toLowerCase() !== 'pessoas') continue
    const situacao = String(row.D4N || '').toLowerCase()
    const valor = toInt(row.V)
    if (situacao === 'urbana') urbana = valor
    else if (situacao === 'rural') rural = valor
    else if (situacao === 'total') total = valor
  }

  const baseTotal = total || ((urbana || 0) + (rural || 0))
  const taxaUrbana = baseTotal > 0 && urbana !== null ? Number(((urbana / baseTotal) * 100).toFixed(2)) : null
  const taxaRural = baseTotal > 0 && rural !== null ? Number(((rural / baseTotal) * 100).toFixed(2)) : null

  return {
    urbana,
    rural,
    total: total ?? (baseTotal > 0 ? baseTotal : null),
    taxa_urbana: taxaUrbana,
    taxa_rural: taxaRural,
    nota_fonte: 'sidra_tabela_9923_c1',
  }
}

async function fetchIpeadataSerieMunicipalLatest(serCodigo) {
  const url = `${IPEADATA_BASE}/Metadados('${serCodigo}')/Valores?$top=25000`
  const payload = await fetchJson(url)
  const rows = Array.isArray(payload?.value) ? payload.value : []
  const map = new Map()

  for (const row of rows) {
    const nivel = String(row.NIVNOME || '')
    const codigo = String(row.TERCODIGO || '')
    if (nivel !== 'Municípios') continue
    if (!codigo.startsWith('22')) continue
    if (codigo.length !== 7) continue
    const valor = Number(row.VALVALOR)
    if (!Number.isFinite(valor)) continue
    const year = Number(String(row.VALDATA || '').slice(0, 4))
    const prev = map.get(codigo)
    if (!prev || year > prev.ano) {
      map.set(codigo, { valor, ano: Number.isFinite(year) ? year : null })
    }
  }

  return map
}

function extrairSexo(rows9514) {
  let masculino = null
  let feminino = null
  let total = null

  for (const row of rows9514) {
    if (row.D2C !== '93') continue
    if (String(row.D5N || '').toLowerCase() !== 'total') continue
    if (String(row.D6N || '').toLowerCase() !== 'total') continue
    if (String(row.MN || '').toLowerCase() !== 'pessoas') continue

    const sexo = String(row.D4N || '').toLowerCase()
    const valor = toInt(row.V)

    if (sexo === 'homens') masculino = valor
    else if (sexo === 'mulheres') feminino = valor
    else if (sexo === 'total') total = valor
  }

  return { masculino, feminino, total }
}

function extrairFaixasEtarias(rows9514) {
  let de0a14 = 0
  let de15a59 = 0
  let de60mais = 0
  let countUsados = 0

  for (const row of rows9514) {
    if (row.D2C !== '93') continue
    if (String(row.D4N || '').toLowerCase() !== 'total') continue
    if (String(row.D6N || '').toLowerCase() !== 'total') continue
    if (String(row.MN || '').toLowerCase() !== 'pessoas') continue

    const intervalo = parseIntervaloIdade(row.D5N)
    if (!intervalo) continue

    const valor = toInt(row.V)
    if (valor === null) continue

    countUsados += 1
    if (intervalo.fim <= 14) de0a14 += valor
    else if (intervalo.inicio >= 60) de60mais += valor
    else if (intervalo.inicio >= 15 && intervalo.fim <= 59) de15a59 += valor
  }

  if (countUsados === 0) {
    return { de_0_a_14: null, de_15_a_59: null, de_60_ou_mais: null, total: null }
  }

  return {
    de_0_a_14: de0a14,
    de_15_a_59: de15a59,
    de_60_ou_mais: de60mais,
    total: de0a14 + de15a59 + de60mais,
  }
}

function extrairPopulacaoCenso(rows9514) {
  const totalRow = rows9514.find(
    (row) =>
      row.D2C === '93' &&
      String(row.D4N || '').toLowerCase() === 'total' &&
      String(row.D5N || '').toLowerCase() === 'total' &&
      String(row.D6N || '').toLowerCase() === 'total' &&
      String(row.MN || '').toLowerCase() === 'pessoas',
  )

  return totalRow ? toInt(totalRow.V) : null
}

function extrairEstimativa(rows6579) {
  const row = rows6579.find((item) => item.D2C === '9324')
  if (!row) return { populacao: null, ano: null }
  return { populacao: toInt(row.V), ano: toInt(row.D3N) }
}

async function fetchMunicipiosPiaui() {
  const url = `${LOCALIDADES_BASE}/estados/22/municipios`
  const data = await fetchJson(url)
  return data
    .map((m) => ({
      codigo_ibge: String(m.id),
      municipio: municipioNomeLimpo(m.nome),
      estado: 'PI',
      mesorregiao: m?.microrregiao?.mesorregiao?.nome || null,
      microrregiao: m?.microrregiao?.nome || null,
    }))
    .sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'))
}

async function fetchDemografiaMunicipio(codigoIbge, ipeadataMap) {
  const sidra9514Url = `${SIDRA_BASE}/t/9514/n6/${codigoIbge}/v/93/p/2022/c2/all/c287/all/c286/all?formato=json`
  const sidra9605Url = `${SIDRA_BASE}/t/9605/n6/${codigoIbge}/v/93/p/2022/c86/all?formato=json`
  const sidra9543Url = `${SIDRA_BASE}/t/9543/n6/${codigoIbge}/v/2513/p/2022?formato=json`
  const sidra9923Url = `${SIDRA_BASE}/t/9923/n6/${codigoIbge}/v/93/p/2022/c1/all?formato=json`
  const sidra6579Url = `${SIDRA_BASE}/t/6579/n6/${codigoIbge}/v/9324/p/last%201?formato=json`

  const [raw9514, raw9605, raw9543, raw9923, raw6579] = await Promise.all([
    fetchJson(sidra9514Url),
    fetchJson(sidra9605Url),
    fetchJson(sidra9543Url),
    fetchJson(sidra9923Url),
    fetchJson(sidra6579Url),
  ])

  const rows9514 = sidraRows(raw9514)
  const rows9605 = sidraRows(raw9605)
  const rows9543 = sidraRows(raw9543)
  const rows9923 = sidraRows(raw9923)
  const rows6579 = sidraRows(raw6579)

  const populacaoCenso2022 = extrairPopulacaoCenso(rows9514)
  const sexo = extrairSexo(rows9514)
  const faixasEtarias = extrairFaixasEtarias(rows9514)
  const corRaca = extrairCorRaca(rows9605)
  const alfabetizacao = extrairTaxaAlfabetizacao(rows9543)
  const urbanizacao = extrairUrbanizacao(rows9923)
  const estimativa = extrairEstimativa(rows6579)
  const rendaVulnerabilidade = ipeadataMap.get(codigoIbge) || {
    renda_per_capita: null,
    percentual_vulneraveis_pobreza: null,
    fonte: 'ipeadata_adh_rdpc_ppob',
    ano_referencia: null,
  }

  return {
    populacao_censo_2022: populacaoCenso2022,
    populacao_estimada_ultimo_ano: estimativa.populacao,
    ano_estimativa: estimativa.ano,
    sexo,
    faixas_etarias: faixasEtarias,
    cor_raca: corRaca,
    alfabetizacao,
    urbanizacao,
    renda_vulnerabilidade: rendaVulnerabilidade,
  }
}

async function fetchDemografiaMunicipioComRetry(codigoIbge, ipeadataMap, retries = 3) {
  let lastError = null
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchDemografiaMunicipio(codigoIbge, ipeadataMap)
    } catch (error) {
      lastError = error
      await sleep(180 * (i + 1))
    }
  }
  throw lastError
}

function toCsv(rows) {
  const header = [
    'codigo_ibge',
    'municipio',
    'estado',
    'mesorregiao',
    'microrregiao',
    'populacao_censo_2022',
    'populacao_estimada_ultimo_ano',
    'ano_estimativa',
    'sexo_masculino',
    'sexo_feminino',
    'sexo_total',
    'faixa_0_14',
    'faixa_15_59',
    'faixa_60_mais',
    'faixa_total',
    'cor_branca',
    'cor_preta',
    'cor_parda',
    'cor_amarela',
    'cor_indigena',
    'cor_total',
    'taxa_alfabetizacao_15_mais',
    'taxa_analfabetismo_15_mais',
    'pop_urbana',
    'pop_rural',
    'taxa_urbana',
    'taxa_rural',
    'renda_per_capita',
    'pct_vulneraveis_pobreza',
    'ano_renda_vulnerabilidade',
  ]

  const escape = (value) => {
    if (value === null || value === undefined) return ''
    const text = String(value)
    if (!/[",\n]/.test(text)) return text
    return `"${text.replace(/"/g, '""')}"`
  }

  const lines = [header.join(',')]

  for (const row of rows) {
    lines.push(
      [
        row.codigo_ibge,
        row.municipio,
        row.estado,
        row.mesorregiao,
        row.microrregiao,
        row.populacao_censo_2022,
        row.populacao_estimada_ultimo_ano,
        row.ano_estimativa,
        row.sexo?.masculino,
        row.sexo?.feminino,
        row.sexo?.total,
        row.faixas_etarias?.de_0_a_14,
        row.faixas_etarias?.de_15_a_59,
        row.faixas_etarias?.de_60_ou_mais,
        row.faixas_etarias?.total,
        row.cor_raca?.branca,
        row.cor_raca?.preta,
        row.cor_raca?.parda,
        row.cor_raca?.amarela,
        row.cor_raca?.indigena,
        row.cor_raca?.total,
        row.alfabetizacao?.taxa_15_mais,
        row.alfabetizacao?.taxa_analfabetismo_15_mais,
        row.urbanizacao?.urbana,
        row.urbanizacao?.rural,
        row.urbanizacao?.taxa_urbana,
        row.urbanizacao?.taxa_rural,
        row.renda_vulnerabilidade?.renda_per_capita,
        row.renda_vulnerabilidade?.percentual_vulneraveis_pobreza,
        row.renda_vulnerabilidade?.ano_referencia,
      ]
        .map(escape)
        .join(','),
    )
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const municipios = await fetchMunicipiosPiaui()
  let ipeadataMap = new Map()
  try {
    const [rendaMap, vulnerMap] = await Promise.all([
      fetchIpeadataSerieMunicipalLatest('ADH_RDPC'),
      fetchIpeadataSerieMunicipalLatest('ADH_PPOB'),
    ])
    const merged = new Map()
    for (const [codigo, renda] of rendaMap.entries()) {
      merged.set(codigo, {
        renda_per_capita: Number(renda.valor.toFixed(2)),
        percentual_vulneraveis_pobreza: null,
        fonte: 'ipeadata_adh_rdpc_ppob',
        ano_referencia: renda.ano,
      })
    }
    for (const [codigo, vulner] of vulnerMap.entries()) {
      const prev = merged.get(codigo) || {
        renda_per_capita: null,
        percentual_vulneraveis_pobreza: null,
        fonte: 'ipeadata_adh_rdpc_ppob',
        ano_referencia: null,
      }
      merged.set(codigo, {
        ...prev,
        percentual_vulneraveis_pobreza: Number(vulner.valor.toFixed(2)),
        ano_referencia: prev.ano_referencia || vulner.ano,
      })
    }
    ipeadataMap = merged
    console.log(`Ipeadata carregado: ${ipeadataMap.size} município(s) com renda/vulnerabilidade.`)
  } catch (error) {
    console.warn(`Ipeadata indisponível no momento: ${String(error?.message || error)}`)
    console.warn('Continuando extração com campos de renda/vulnerabilidade em branco.')
  }
  console.log(`Municípios encontrados no Piauí: ${municipios.length}`)

  const result = []
  const falhas = []

  // Lotes pequenos para evitar bloqueio/timeout em massa da API.
  const concurrency = 6
  for (let i = 0; i < municipios.length; i += concurrency) {
    const lote = municipios.slice(i, i + concurrency)
    const loteResults = await Promise.all(
      lote.map(async (m) => {
        try {
          const demografia = await fetchDemografiaMunicipioComRetry(m.codigo_ibge, ipeadataMap, 3)
          return { ok: true, row: { ...m, ...demografia } }
        } catch (error) {
          return { ok: false, codigo_ibge: m.codigo_ibge, municipio: m.municipio, error: String(error.message || error) }
        }
      }),
    )

    for (const item of loteResults) {
      if (item.ok) {
        result.push(item.row)
      } else {
        falhas.push(item)
        result.push({
          ...municipios.find((m) => m.codigo_ibge === item.codigo_ibge),
          ...emptyDemografia(),
        })
      }
    }

    console.log(`Processados ${Math.min(i + concurrency, municipios.length)}/${municipios.length}`)
    await sleep(120)
  }

  const sorted = result.sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'))
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true })
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(sorted, null, 2), 'utf8')
  fs.writeFileSync(OUTPUT_CSV, toCsv(sorted), 'utf8')

  console.log('Arquivos gerados:')
  console.log('-', OUTPUT_JSON)
  console.log('-', OUTPUT_CSV)

  if (falhas.length > 0) {
    console.warn(`Falhas em ${falhas.length} município(s).`)
    for (const f of falhas.slice(0, 10)) {
      console.warn(`- ${f.codigo_ibge} ${f.municipio}: ${f.error}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
