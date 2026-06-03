#!/usr/bin/env node
/**
 * Converte Processos_Dimensao_2026_Organizado.xlsx (aba Base Organizada) em JSON.
 * Mantém apenas processos em que Autor ou Requerido é a Dimensão.
 * Uso: node scripts/xlsx-to-json-processos-dimensao.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const XLSX_PATH = path.join(ROOT, 'Processos_Dimensao_2026_Organizado.xlsx')
const OUT_PATH = path.join(ROOT, 'data', 'processos-dimensao.json')
const SHEET_NAME = 'Base Organizada'

const DIMENSAO_PARTY = 'DIMENSÃO DISTRIBUIDORA DE MEDICAMENTOS EIRELI-ME'

function normParty(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

function isDimensaoParty(s) {
  const n = normParty(s)
  return n.includes('DIMENSAO') && n.includes('DISTRIBUIDORA') && n.includes('MEDICAMENTOS')
}

function parseData(val) {
  if (val === null || val === undefined || val === '') return null
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(val).trim()
  if (!s) return null
  const num = Number(val)
  if (!Number.isNaN(num) && num > 30000 && num < 60000) {
    try {
      const d = XLSX.SSF.parse_date_code(num)
      if (d?.y && d?.m && d?.d) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
      }
    } catch {
      /* ignore */
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

function parseMoeda(val) {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number' && Number.isFinite(val)) return val
  const s = String(val).trim()
  if (!s || s === 'R$ -' || s === '-') return null
  const cleaned = s.replace(/R\$\s?/gi, '').replace(/\s/g, '')
  if (cleaned.includes(',')) {
    const n = Number(cleaned.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function toNum(val) {
  if (val === null || val === undefined || val === '') return null
  const n = typeof val === 'number' ? val : Number(String(val).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function str(val) {
  const s = String(val ?? '').trim()
  return s || null
}

function mapRow(row) {
  const processo = str(row.Processo)
  if (!processo) return null

  return {
    id: processo,
    processo,
    acao: str(row['Ação']),
    area: str(row['Área']),
    autor: str(row.Autor),
    requerido: str(row.Requerido),
    orgaoJulgador: str(row['Órgão Julgador']),
    varaOrigem: str(row['Vara/Origem']),
    municipioOrigem: str(row['Município/Origem']),
    dataConsulta: parseData(row['Data Consulta']),
    ultimaMovimentacao: str(row['Última Movimentação']),
    status: str(row.Status),
    prioridade: str(row.Prioridade),
    observacoes: str(row.Observações),
    fonte: str(row.Fonte),
    responsavel: str(row.Responsável),
    proximaAcao: str(row['Próxima Ação']),
    prazoInterno: str(row['Prazo Interno']),
    valorRisco: parseMoeda(row['Valor/Risco']),
    linkPje: str(row['Link PJe/Consulta']),
    valorAtualizado: parseMoeda(row['Valor Atualizado']),
    riscoFinanceiro: str(row['Risco Financeiro']),
    riscoPatrimonial: str(row['Risco Patrimonial']),
    riscoJuridico: str(row['Risco Jurídico']),
    prioridadeEstrategica: str(row['Prioridade Estratégica']),
    rankingEstrategico: toNum(row['Ranking Estratégico']),
    tituloEstrategico: str(row['Título Estratégico']),
    porQueCritico: str(row['Por que Crítico']),
    acaoRecomendada: str(row['Ação Recomendada']),
    poloDimensao:
      isDimensaoParty(row.Autor) && isDimensaoParty(row.Requerido)
        ? 'autor_e_requerido'
        : isDimensaoParty(row.Autor)
          ? 'autor'
          : 'requerido',
  }
}

function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`Arquivo não encontrado: ${XLSX_PATH}`)
    process.exit(1)
  }

  const wb = XLSX.readFile(XLSX_PATH)
  if (!wb.SheetNames.includes(SHEET_NAME)) {
    console.error(`Aba "${SHEET_NAME}" não encontrada. Abas: ${wb.SheetNames.join(', ')}`)
    process.exit(1)
  }

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET_NAME], { defval: '' })
  const processos = []

  for (const row of rows) {
    if (!isDimensaoParty(row.Autor) && !isDimensaoParty(row.Requerido)) continue
    const mapped = mapRow(row)
    if (mapped) processos.push(mapped)
  }

  processos.sort((a, b) => {
    const ra = a.rankingEstrategico ?? 999
    const rb = b.rankingEstrategico ?? 999
    if (ra !== rb) return ra - rb
    return (a.processo ?? '').localeCompare(b.processo ?? '', 'pt-BR')
  })

  const payload = {
    geradoEm: new Date().toISOString(),
    parteFiltro: DIMENSAO_PARTY,
    total: processos.length,
    processos,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`OK: ${processos.length} processos → ${OUT_PATH}`)
}

main()
