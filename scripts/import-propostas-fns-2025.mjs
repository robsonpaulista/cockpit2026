#!/usr/bin/env node
/**
 * Importa snapshot das propostas FNS de 2025 para a tabela propostas_fns.
 * Rodar uma vez após executar database/create-propostas-fns.sql no Supabase.
 *
 * Uso:
 *   node scripts/import-propostas-fns-2025.mjs
 *
 * Pré-requisitos:
 * - .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *
 * Nota: o exercício corrente (2026+) NÃO é gravado — permanece consulta ao vivo.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const EXERCICIO = 2025
const BATCH_UPSERT = 100
const DELAY_MS = 250

const FNS_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N)',
  Referer: 'https://consultafns.saude.gov.br/',
}

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  const env = fs.readFileSync(envPath, 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const value = m[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function normalizeMunicipioNome(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function formatarNomeMunicipioLista(nomePlanilha) {
  return nomePlanilha
    .toLowerCase()
    .split(' ')
    .map((palavra) => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ')
    .replace(/\bDo\b/g, 'do')
    .replace(/\bDa\b/g, 'da')
    .replace(/\bDe\b/g, 'de')
    .replace(/\bDos\b/g, 'dos')
    .replace(/\bDas\b/g, 'das')
}

function parseNum(v) {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function inferirIdentificador(raw) {
  const nuProposta = String(raw.nuProposta ?? '').trim()
  if (nuProposta) return nuProposta
  const nuProcesso = String(raw.nuProcesso ?? '').trim()
  if (nuProcesso && nuProcesso !== 'N/A') return nuProcesso
  const tipo = String(raw.coTipoProposta ?? 'Proposta').trim()
  const recurso = String(raw.dsTipoRecurso ?? '').trim()
  if (recurso) return `${tipo} — ${recurso}`
  return tipo || 'Proposta FNS'
}

function inferirSituacao(raw, vlProposta, vlPagar, vlPago, constituidoProcesso, nuProcesso) {
  const ds = String(raw.dsSituacaoProposta ?? '').trim()
  if (ds) return ds
  if (vlProposta > 0 && vlPago >= vlProposta) return 'Pago integral'
  if (vlPago > 0 && vlPago < vlProposta) return 'Pago parcial'
  if (vlPagar > 0) return 'Valor a pagar'
  if (constituidoProcesso) return 'Processo constituído'
  if (nuProcesso && nuProcesso !== 'N/A') return 'Com nº processo'
  return 'Sem processo'
}

function normalizeProposta(raw, municipio) {
  const vlProposta = parseNum(raw.vlProposta)
  const vlPagar = parseNum(raw.vlPagar)
  const vlPago = parseNum(raw.vlPago)
  const nuProcesso = String(raw.nuProcesso ?? '').trim() || 'N/A'
  const constituidoProcesso = Boolean(raw.constituidoProcesso)
  const pagamentos = Array.isArray(raw.pagamentos) ? raw.pagamentos : []
  const parlamentares = Array.isArray(raw.parlamentares) ? raw.parlamentares : []
  const linhaPropostas = Array.isArray(raw.linhaPropostas) ? raw.linhaPropostas : []

  return {
    nu_proposta: inferirIdentificador(raw),
    co_tipo_proposta: String(raw.coTipoProposta ?? ''),
    ds_tipo_recurso: String(raw.dsTipoRecurso ?? ''),
    vl_proposta: vlProposta,
    vl_pagar: vlPagar,
    vl_pago: vlPago,
    dt_cadastramento: String(raw.dtCadastramento ?? '').trim() || null,
    ds_situacao_proposta: inferirSituacao(
      raw,
      vlProposta,
      vlPagar,
      vlPago,
      constituidoProcesso,
      nuProcesso,
    ),
    nu_processo: nuProcesso,
    constituido_processo: constituidoProcesso,
    payload: { pagamentos, parlamentares, linhaPropostas },
    municipio_nome: municipio,
  }
}

function loadMunicipios() {
  const filePath = path.join(ROOT, 'data', 'limites-pap-2025.json')
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const map = new Map()
  for (const item of data) {
    if (!map.has(item.municipio)) {
      map.set(item.municipio, {
        ibge: String(item.ibge),
        nome: formatarNomeMunicipioLista(item.municipio),
        chave: normalizeMunicipioNome(item.municipio),
      })
    }
  }
  return Array.from(map.values())
}

async function fetchFnsMunicipio(ibge, nome, maxPages = 8) {
  const propostas = []
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      ano: String(EXERCICIO),
      sgUf: 'PI',
      coMunicipioIbge: ibge,
      count: '100',
      page: String(page),
      coEsfera: '',
    })
    const res = await fetch(
      `https://consultafns.saude.gov.br/recursos/proposta/consultar?${params}`,
      { headers: FNS_HEADERS },
    )
    if (!res.ok) break
    const data = await res.json()
    const itens = data.resultado?.itensPagina ?? []
    if (itens.length === 0) break
    propostas.push(...itens.map((p) => normalizeProposta(p, nome)))
    await new Promise((r) => setTimeout(r, DELAY_MS))
  }
  return propostas
}

async function upsertBatch(supabase, rows) {
  const syncedAt = new Date().toISOString()
  for (let i = 0; i < rows.length; i += BATCH_UPSERT) {
    const chunk = rows.slice(i, i + BATCH_UPSERT).map((row) => ({
      ...row,
      synced_at: syncedAt,
    }))
    const { error } = await supabase
      .from('propostas_fns')
      .upsert(chunk, { onConflict: 'exercicio,municipio_chave,nu_proposta' })
    if (error) throw error
  }
}

async function main() {
  loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const municipios = loadMunicipios()
  console.log(`Importando propostas FNS ${EXERCICIO} — ${municipios.length} municípios`)

  let totalPropostas = 0
  let municipiosComDados = 0

  for (let i = 0; i < municipios.length; i++) {
    const m = municipios[i]
    process.stdout.write(`[${i + 1}/${municipios.length}] ${m.nome}… `)

    try {
      const propostas = await fetchFnsMunicipio(m.ibge, m.nome)
      if (propostas.length === 0) {
        console.log('0')
        continue
      }

      const rows = propostas.map((p) => ({
        exercicio: EXERCICIO,
        municipio_chave: m.chave,
        municipio_nome: m.nome,
        ibge: m.ibge,
        ...p,
      }))

      await upsertBatch(supabase, rows)
      totalPropostas += rows.length
      municipiosComDados += 1
      console.log(rows.length)
    } catch (e) {
      console.log('ERRO', e instanceof Error ? e.message : e)
    }
  }

  console.log('\nConcluído.')
  console.log(`  Exercício: ${EXERCICIO}`)
  console.log(`  Municípios com propostas: ${municipiosComDados}`)
  console.log(`  Total de registros: ${totalPropostas}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
