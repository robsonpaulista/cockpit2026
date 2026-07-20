#!/usr/bin/env node
/**
 * Aplica database/add-agendas-fluxo-digital.sql via PostgREST não é possível (DDL).
 * Este script só verifica se a coluna já existe.
 *
 * Para criar a coluna, rode o SQL no Supabase → SQL Editor:
 *   database/add-agendas-fluxo-digital.sql
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.local')
if (!existsSync(envPath)) {
  console.error('.env.local não encontrado')
  process.exit(1)
}
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
  process.exit(1)
}
const sb = createClient(url, key)
const { error } = await sb.from('agendas').select('incluir_fluxo_digital').limit(1)
if (error?.message?.includes('incluir_fluxo_digital')) {
  console.log('PENDENTE: coluna incluir_fluxo_digital não existe.')
  console.log('Abra o SQL Editor do Supabase e execute: database/add-agendas-fluxo-digital.sql')
  process.exit(2)
}
if (error) {
  console.error(error.message)
  process.exit(1)
}
console.log('OK: coluna agendas.incluir_fluxo_digital já existe.')
