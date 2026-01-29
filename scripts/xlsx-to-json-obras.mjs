#!/usr/bin/env node
/**
 * Converte geralobras.xlsx (na pasta raiz do projeto) em JSON e insere no banco de dados.
 * Uso: node scripts/xlsx-to-json-obras.mjs
 * Requer: geralobras.xlsx na raiz do projeto
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const XLSX_PATH = path.join(ROOT, 'geralobras.xlsx')
const JSON_OUTPUT = path.join(ROOT, 'data', 'obras.json')

// Carregar .env.local se existir
const envPath = path.join(ROOT, '.env.local')
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8')
  env.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  })
}

const COLUNAS_ESPERADAS = [
  'Municipio', 'Obra', 'Orgão', 'SEI', 'SEI MEDIÇÃO', 'Status',
  'PUBLICAÇÃO DA OS', 'Solicitação Medição', 'Data Medição', 'Status Medição', 'Valor Total'
]

function normalizarValor (val) {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  const s = String(val).trim()
  if (s === '') return null
  return s
}

function parseData (val) {
  if (val === null || val === undefined || val === '') return null
  if (val instanceof Date) {
    const d = val
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const s = String(val).trim()
  if (!s) return null
  const num = Number(val)
  if (!Number.isNaN(num)) {
    try {
      if (XLSX.SSF && XLSX.SSF.is_date(XLSX.SSF.parse_date_code(num))) {
        const d = XLSX.SSF.parse_date_code(num)
        const year = d.y
        const month = String(d.m).padStart(2, '0')
        const day = String(d.D).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
    } catch (_) {}
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

/** Converte "R$ 1.461.860,68" ou "R$ -" em número ou null */
function parseMoeda (val) {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (!s || s === 'R$' || s === 'R$ -' || s === '-') return null
  const limpo = s.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim()
  const n = parseFloat(limpo)
  return Number.isNaN(n) ? null : n
}

function mapRowToObra (headers, row) {
  const headerLower = headers.map(h => (h && String(h).trim().toLowerCase()) || '')
  const get = (names) => {
    for (const name of names) {
      const n = name.toLowerCase().trim().replace(/\s+/g, ' ')
      for (let idx = 0; idx < headerLower.length; idx++) {
        const h = (headerLower[idx] || '').replace(/\s+/g, ' ')
        if (!h) continue
        const exato = h === n
        const parcial = (h.includes(n) || n.includes(h)) && (n.length > 5 || h.length <= 6)
        if (exato || parcial) {
          const val = row[idx]
          if (val !== undefined && val !== null && String(val).trim() !== '') return val
          return null
        }
      }
    }
    return null
  }
  const obra = normalizarValor(get(['Obra', 'obra']))
  if (!obra) return null

  const valorTotalRaw = get(['Valor Total', 'valor total'])
  const valor_total = parseMoeda(valorTotalRaw) ?? (typeof valorTotalRaw === 'number' && !Number.isNaN(valorTotalRaw) ? valorTotalRaw : null)

  return {
    municipio: normalizarValor(get(['Municipio', 'Município', 'municipio'])),
    obra: String(obra),
    orgao: normalizarValor(get(['Orgão', 'Orgao', 'orgao'])),
    sei: normalizarValor(get(['SEI', 'sei'])),
    sei_medicao: normalizarValor(get(['SEI MEDIÇÃO', 'SEI MEDICAO', 'sei medição', 'sei medicao'])),
    status: normalizarValor(get(['Status', 'status'])),
    publicacao_os: parseData(get(['PUBLICAÇÃO DA OS', 'Publicação da OS', 'publicação da os'])),
    solicitacao_medicao: parseData(get(['Solicitação Medição', 'Solicitacao Medicao', 'solicitação medição'])),
    data_medicao: parseData(get(['Data Medição', 'Data Medicao', 'data medição', 'data medicao'])),
    status_medicao: normalizarValor(get(['Status Medição', 'Status Medicao', 'status medição', 'status medicao'])),
    valor_total
  }
}

async function main () {
  if (!fs.existsSync(XLSX_PATH)) {
    console.error('Arquivo não encontrado:', XLSX_PATH)
    console.error('Coloque geralobras.xlsx na pasta raiz do projeto.')
    process.exit(1)
  }

  console.log('Lendo', XLSX_PATH, '...')
  const buf = fs.readFileSync(XLSX_PATH)
  const workbook = XLSX.read(buf, { type: 'array', cellDates: true })

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    console.error('Planilha sem abas.')
    process.exit(1)
  }

  // Usar aba "ASFALTOS" (única aba do arquivo geralobras.xlsx)
  const asfaltosIndex = workbook.SheetNames.findIndex(s => String(s).toLowerCase().trim() === 'asfaltos')
  const sheetName = asfaltosIndex >= 0 ? workbook.SheetNames[asfaltosIndex] : workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  console.log('Abas no arquivo:', workbook.SheetNames.join(', '))
  console.log('Usando aba:', sheetName)

  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (!raw || raw.length === 0) {
    console.error('Aba vazia.')
    process.exit(1)
  }

  // Encontrar a linha que tem os cabeçalhos: Municipio, Obra, Orgão, SEI, etc.
  // Estrutura informada: não há linhas antes do cabeçalho — primeira linha da aba é o cabeçalho
  const headerRowIndex = 0

  const headers = (raw[headerRowIndex] || []).map(c => (c != null && c !== '') ? String(c).trim() : '')
  console.log('Cabeçalho (linha', headerRowIndex + 1 + '):', headers.filter(Boolean).join(', ') || '(vazio)')

  const obras = []
  for (let r = headerRowIndex + 1; r < raw.length; r++) {
    const row = raw[r] || []
    const padded = [...row]
    while (padded.length < headers.length) padded.push(null)
    const obra = mapRowToObra(headers, padded)
    if (obra) obras.push(obra)
  }

  console.log('Linhas convertidas:', obras.length)

  if (obras.length === 0) {
    console.error('Nenhuma obra válida encontrada. Verifique os cabeçalhos e a coluna "Obra".')
    process.exit(1)
  }

  // Salvar JSON
  const dataDir = path.dirname(JSON_OUTPUT)
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(obras, null, 2), 'utf8')
  console.log('JSON salvo em:', JSON_OUTPUT)

  // Inserir no banco
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const key = serviceKey || anonKey

  if (!url || !key) {
    console.warn('Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou ANON_KEY) não definidas. Apenas JSON gerado.')
    return
  }

  const supabase = createClient(url, key)
  console.log('Inserindo no banco...')

  const BATCH = 50
  let inserted = 0
  for (let i = 0; i < obras.length; i += BATCH) {
    const chunk = obras.slice(i, i + BATCH)
    const { data, error } = await supabase.from('obras').insert(chunk).select('id')
    if (error) {
      console.error('Erro ao inserir lote', Math.floor(i / BATCH) + 1, error.message)
      if (error.code === '23505') console.error('Possível duplicata. Use SUPABASE_SERVICE_ROLE_KEY para bypass RLS.')
    } else {
      inserted += (data && data.length) || 0
    }
  }

  console.log('Concluído. Inseridas', inserted, 'obras no banco.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
