#!/usr/bin/env node
/**
 * Distribui os totais por município da planilha de potencial eleitoral
 * (Expectativa 2026 e Revisão Final) entre as lideranças ativas da cidade,
 * proporcionalmente ao peso de cada uma na expectativa atual (expectativa_votos_2026).
 *
 * Uso:
 *   node scripts/apply-potencial-eleitoral-liderancas.mjs --cidade "Cocal"            (simulação)
 *   node scripts/apply-potencial-eleitoral-liderancas.mjs --cidade "Cocal" --apply    (grava)
 *   node scripts/apply-potencial-eleitoral-liderancas.mjs --todas [--apply]
 *   --excluir "Cocal"               (opcional, pode repetir)
 *   --arquivo database/outro.xlsx   (opcional)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEFAULT_FILE = path.join(ROOT, 'database', 'potencial-eleitoral-2022-2026-2026-10-02.xlsx')

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const TODAS = args.includes('--todas')
const argValue = (flag) => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}
const cidadesArg = args.flatMap((a, i) => (args[i - 1] === '--cidade' ? [a] : []))
const excluirArg = args.flatMap((a, i) => (args[i - 1] === '--excluir' ? [a] : []))
const FILE = argValue('--arquivo') ? path.resolve(ROOT, argValue('--arquivo')) : DEFAULT_FILE

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    let value = m[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

const normalizeCity = (city) =>
  String(city || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Distribuição proporcional com maiores restos: a soma bate exatamente com o total. */
function distribuir(total, pesos) {
  if (pesos.length === 0) return []
  const somaPesos = pesos.reduce((s, p) => s + p, 0)
  const base = somaPesos > 0 ? pesos : pesos.map(() => 1)
  const somaBase = somaPesos > 0 ? somaPesos : pesos.length
  const brutos = base.map((p) => (total * p) / somaBase)
  const inteiros = brutos.map(Math.floor)
  let sobra = total - inteiros.reduce((s, v) => s + v, 0)
  const ordem = brutos
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((a, b) => b.resto - a.resto || base[b.i] - base[a.i])
  for (const { i } of ordem) {
    if (sobra <= 0) break
    inteiros[i] += 1
    sobra -= 1
  }
  return inteiros
}

function lerPlanilha() {
  const wb = XLSX.readFile(FILE)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null })
  const rows = rawRows.map((raw) =>
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.trim(), v])),
  )
  const mapa = new Map()
  for (const row of rows) {
    const municipio = String(row['Município'] || '').trim()
    if (!municipio) continue
    mapa.set(normalizeCity(municipio), {
      municipio,
      expectativa: toNumberOrNull(row['Expectativa 2026']),
      revisaoFinal: toNumberOrNull(row['Revisão Final']),
      liderancasPlanilha: toNumberOrNull(row['Lideranças']),
    })
  }
  return mapa
}

async function main() {
  if (!TODAS && cidadesArg.length === 0) {
    console.error('Informe --cidade "Nome" (pode repetir) ou --todas.')
    process.exit(1)
  }

  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes')
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const planilha = lerPlanilha()
  const excluidas = new Set(excluirArg.map((c) => normalizeCity(c)))
  const alvos = (TODAS ? Array.from(planilha.keys()) : cidadesArg.map((c) => normalizeCity(c))).filter(
    (c) => !excluidas.has(c),
  )

  const { error: colErr } = await supabase
    .from('territorio_liderancas')
    .select('previsto_2026')
    .limit(1)
  const temColunaRevisao = !colErr
  if (!temColunaRevisao) {
    console.warn(
      '⚠ Coluna previsto_2026 (Revisão Final) não existe. Rode database/add-territorio-liderancas-previsto.sql. ' +
        'Só a Expectativa será atualizada.',
    )
  }

  const selectCols = [
    'id',
    'municipio',
    'municipio_normalizado',
    'lideranca',
    'expectativa_votos_2026',
    ...(temColunaRevisao ? ['previsto_2026'] : []),
  ].join(', ')

  const updates = []
  const backup = []
  const semLiderancas = []
  const naoEncontradas = []

  for (const alvo of alvos) {
    const info = planilha.get(alvo)
    if (!info) {
      naoEncontradas.push(alvo)
      continue
    }
    const { data, error } = await supabase
      .from('territorio_liderancas')
      .select(selectCols)
      .eq('ativo', true)
      .eq('municipio_normalizado', alvo)
      .order('id')
    if (error) throw error
    const liderancas = data ?? []
    if (liderancas.length === 0) {
      semLiderancas.push(info.municipio)
      continue
    }

    const pesos = liderancas.map((l) => Math.max(0, Number(l.expectativa_votos_2026) || 0))
    const somaPesos = pesos.reduce((s, p) => s + p, 0)
    const novasExp = info.expectativa != null ? distribuir(info.expectativa, pesos) : null
    const novasRev =
      temColunaRevisao && info.revisaoFinal != null ? distribuir(info.revisaoFinal, pesos) : null

    if (!TODAS || alvos.length <= 3) {
      console.log(
        `\n=== ${info.municipio} — planilha: Expectativa ${info.expectativa ?? '—'} · Revisão Final ${
          info.revisaoFinal ?? '—'
        } · ${liderancas.length} lideranças no banco (${info.liderancasPlanilha ?? '?'} na planilha)`,
      )
      console.log(`    Expectativa atual somada: ${somaPesos}${somaPesos === 0 ? ' (divisão igualitária)' : ''}`)
    }

    const tabela = []
    liderancas.forEach((l, i) => {
      const patch = {}
      if (novasExp) patch.expectativa_votos_2026 = novasExp[i]
      if (novasRev) patch.previsto_2026 = novasRev[i]
      if (Object.keys(patch).length === 0) return
      backup.push({
        id: l.id,
        municipio: l.municipio,
        lideranca: l.lideranca,
        expectativa_votos_2026: l.expectativa_votos_2026,
        ...(temColunaRevisao ? { previsto_2026: l.previsto_2026 } : {}),
      })
      updates.push({ id: l.id, patch })
      tabela.push({
        liderança: l.lideranca,
        'peso %': somaPesos > 0 ? ((pesos[i] / somaPesos) * 100).toFixed(1) : '—',
        'expectativa atual': Number(l.expectativa_votos_2026) || 0,
        'nova expectativa': novasExp ? novasExp[i] : '(sem valor)',
        ...(temColunaRevisao
          ? {
              'revisão atual': Number(l.previsto_2026) || 0,
              'nova revisão final': novasRev ? novasRev[i] : '(sem valor)',
            }
          : {}),
      })
    })
    if (!TODAS || alvos.length <= 3) console.table(tabela)
  }

  console.log(`\nLinhas a atualizar: ${updates.length}`)
  if (semLiderancas.length) {
    console.log(`Cidades da planilha sem lideranças ativas no banco (${semLiderancas.length}): ${semLiderancas.join(', ')}`)
  }
  if (naoEncontradas.length) {
    console.log(`Cidades não encontradas na planilha: ${naoEncontradas.join(', ')}`)
  }

  if (!APPLY) {
    console.log('\nSimulação — nada foi gravado. Use --apply para gravar.')
    return
  }

  const backupDir = path.join(ROOT, 'database', 'backups')
  fs.mkdirSync(backupDir, { recursive: true })
  const backupFile = path.join(
    backupDir,
    `territorio-liderancas-antes-potencial-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2))
  console.log(`Backup salvo em ${path.relative(ROOT, backupFile)}`)

  const agora = new Date().toISOString()
  let ok = 0
  for (const { id, patch } of updates) {
    const { error } = await supabase
      .from('territorio_liderancas')
      .update({ ...patch, updated_at: agora })
      .eq('id', id)
    if (error) {
      console.error(`Erro ao atualizar id ${id}:`, error.message)
      continue
    }
    ok += 1
  }
  console.log(`Atualizadas: ${ok}/${updates.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
