#!/usr/bin/env node
/**
 * Importa a última movimentação da planilha (JSON) como registro inicial no Supabase.
 * Não duplica se já existir histórico para o processo.
 *
 * Requer: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Uso: node scripts/seed-juridico-movimentacoes-planilha.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const JSON_PATH = path.join(ROOT, 'data', 'processos-dimensao.json')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))
const processos = raw.processos ?? []

let inseridos = 0
let ignorados = 0
let semMov = 0

for (const p of processos) {
  const desc = String(p.ultimaMovimentacao ?? '').trim()
  if (!desc) {
    semMov++
    continue
  }

  const { count, error: countErr } = await supabase
    .from('juridico_processo_movimentacoes')
    .select('id', { count: 'exact', head: true })
    .eq('processo_id', p.id)

  if (countErr) {
    console.error(countErr.message)
    process.exit(1)
  }
  if ((count ?? 0) > 0) {
    ignorados++
    continue
  }

  const { error } = await supabase.from('juridico_processo_movimentacoes').insert({
    processo_id: p.id,
    descricao: desc,
    data_movimentacao: p.dataConsulta || null,
    status_processo: p.status || null,
    fonte: 'planilha',
    observacoes: p.fonte ? `Importado de ${p.fonte}` : 'Importado da planilha Dimensão',
  })

  if (error) {
    console.error(`Erro em ${p.id}:`, error.message)
    process.exit(1)
  }
  inseridos++
}

console.log(`Concluído: ${inseridos} inseridos, ${ignorados} já tinham histórico, ${semMov} sem movimentação na planilha.`)
