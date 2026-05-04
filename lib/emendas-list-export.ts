import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { applyPlugin, type UserOptions } from 'jspdf-autotable'
import { formatDateShort } from '@/lib/utils'

/**
 * Todas as colunas disponíveis (tabela emendas + metadados), na ordem do menu
 * "Colunas" e na exportação.
 */
export const EMENDAS_LIST_COLUMN_KEYS = [
  'id',
  'bloco',
  'exercicio',
  'emenda',
  'municipio_beneficiario',
  'funcional',
  'gnd',
  'valor_indicado',
  'valor_empenhado',
  'valor_a_empenhar',
  'valor_pago',
  'valor_a_ser_pago',
  'empenho',
  'data_empenho',
  'portaria_convenio',
  'numero_proposta',
  'data_pagamento',
  'liderancas',
  'alteracao',
  'objeto',
  'created_at',
  'updated_at',
] as const

export type EmendaListColumnKey = (typeof EMENDAS_LIST_COLUMN_KEYS)[number]

/** Colunas visíveis por padrão na tabela (mesmo conjunto anterior). */
export const EMENDAS_DEFAULT_VISIBLE_COLUMN_KEYS: readonly EmendaListColumnKey[] = [
  'exercicio',
  'emenda',
  'municipio_beneficiario',
  'valor_indicado',
  'valor_empenhado',
  'valor_pago',
]

export function emendasDefaultVisibleColumnsRecord(): Record<EmendaListColumnKey, boolean> {
  const vis = new Set<string>(EMENDAS_DEFAULT_VISIBLE_COLUMN_KEYS)
  return Object.fromEntries(EMENDAS_LIST_COLUMN_KEYS.map((k) => [k, vis.has(k)])) as Record<
    EmendaListColumnKey,
    boolean
  >
}

export const EMENDAS_LIST_COLUMN_LABELS: Record<EmendaListColumnKey, string> = {
  id: 'ID',
  bloco: 'Bloco',
  exercicio: 'Exercício',
  emenda: 'Emenda',
  municipio_beneficiario: 'Município / Beneficiário',
  funcional: 'Funcional',
  gnd: 'GND',
  valor_indicado: 'Valor Indicado',
  valor_empenhado: 'Valor Empenhado',
  valor_a_empenhar: 'Valor a empenhar',
  valor_pago: 'Valor Pago',
  valor_a_ser_pago: 'Valor a ser pago',
  empenho: 'Empenho',
  data_empenho: 'Data do empenho',
  portaria_convenio: 'Portaria / Convênio',
  numero_proposta: 'Nº da proposta',
  data_pagamento: 'Data do pagamento',
  liderancas: 'Lideranças',
  alteracao: 'Alteração',
  objeto: 'Objeto',
  created_at: 'Criado em',
  updated_at: 'Atualizado em',
}

/** Linha completa para listagem e exportação. */
export type EmendaListExportRow = {
  id: string
  bloco: string | null
  exercicio: number | null
  emenda: string
  municipio_beneficiario: string | null
  funcional: string | null
  gnd: string | null
  valor_indicado: number | null
  valor_empenhado: number | null
  valor_a_empenhar: number | null
  valor_pago: number | null
  valor_a_ser_pago: number | null
  empenho: string | null
  data_empenho: string | null
  portaria_convenio: string | null
  numero_proposta: string | null
  data_pagamento: string | null
  liderancas: string | null
  alteracao: string | null
  objeto: string | null
  created_at?: string
  updated_at?: string
}

const COL_WIDTH_MM: Record<EmendaListColumnKey, number> = {
  id: 36,
  bloco: 22,
  exercicio: 16,
  emenda: 44,
  municipio_beneficiario: 40,
  funcional: 26,
  gnd: 14,
  valor_indicado: 28,
  valor_empenhado: 28,
  valor_a_empenhar: 28,
  valor_pago: 26,
  valor_a_ser_pago: 28,
  empenho: 28,
  data_empenho: 22,
  portaria_convenio: 32,
  numero_proposta: 24,
  data_pagamento: 22,
  liderancas: 32,
  alteracao: 36,
  objeto: 40,
  created_at: 28,
  updated_at: 28,
}

function isValorKey(k: EmendaListColumnKey): boolean {
  return k.startsWith('valor_')
}

function isDateKey(k: EmendaListColumnKey): boolean {
  return (
    k === 'data_empenho' ||
    k === 'data_pagamento' ||
    k === 'created_at' ||
    k === 'updated_at'
  )
}

function normalizeColumns(cols: EmendaListColumnKey[]): EmendaListColumnKey[] {
  const set = new Set(cols)
  const ordered = EMENDAS_LIST_COLUMN_KEYS.filter((k) => set.has(k))
  return ordered.length > 0 ? ordered : [...EMENDAS_DEFAULT_VISIBLE_COLUMN_KEYS]
}

let autotableApplied = false

function ensureAutoTable(): void {
  if (!autotableApplied) {
    applyPlugin(jsPDF)
    autotableApplied = true
  }
}

type JsPdfWithAutoTable = InstanceType<typeof jsPDF> & {
  autoTable: (options: UserOptions) => InstanceType<typeof jsPDF>
  lastAutoTable?: false | { finalY: number }
}

function formatBrl(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateCell(v: string | null | undefined): string {
  if (v == null || v === '') return '—'
  try {
    return formatDateShort(v)
  } catch {
    return String(v)
  }
}

export function excelValue(r: EmendaListExportRow, k: EmendaListColumnKey): string | number {
  if (isValorKey(k)) {
    const n = r[k] as number | null | undefined
    return n ?? ''
  }
  if (isDateKey(k)) {
    const s = r[k] as string | null | undefined
    return s ? formatDateShort(s) : ''
  }
  const v = r[k]
  if (v === null || v === undefined) return ''
  return String(v)
}

export function pdfCell(r: EmendaListExportRow, k: EmendaListColumnKey): string {
  if (isValorKey(k)) {
    return formatBrl(r[k] as number | null | undefined)
  }
  if (isDateKey(k)) {
    return formatDateCell(r[k] as string | null | undefined)
  }
  const v = r[k]
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

function stampArquivo(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

export function nomeArquivoEmendasExport(filtrado: boolean, ext: 'xlsx' | 'pdf'): string {
  const base = filtrado ? 'emendas-filtradas' : 'emendas'
  return `${base}-${stampArquivo()}.${ext}`
}

export function exportEmendasListToXlsx(
  rows: EmendaListExportRow[],
  filtrado: boolean,
  activeColumns: EmendaListColumnKey[],
): void {
  const cols = normalizeColumns(activeColumns)

  const data =
    rows.length > 0
      ? rows.map((r) => {
          const row: Record<string, string | number> = {}
          cols.forEach((k) => {
            row[EMENDAS_LIST_COLUMN_LABELS[k]] = excelValue(r, k)
          })
          return row
        })
      : [{ Observação: 'Nenhum registro para os filtros atuais' }]

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Emendas')
  XLSX.writeFile(wb, nomeArquivoEmendasExport(filtrado, 'xlsx'))
}

export function exportEmendasListToPdf(
  rows: EmendaListExportRow[],
  filtrado: boolean,
  linhaFiltros: string,
  activeColumns: EmendaListColumnKey[],
): void {
  const cols = normalizeColumns(activeColumns)
  const headers = cols.map((k) => EMENDAS_LIST_COLUMN_LABELS[k])

  ensureAutoTable()
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as JsPdfWithAutoTable

  const pageW = doc.internal.pageSize.getWidth()
  const margin = 12
  const brand: [number, number, number] = [22, 63, 102]
  const innerW = pageW - margin * 2

  const linhaCompleta = `${linhaFiltros}\nColunas: ${headers.join(' · ')}`

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const subLinhas = doc.splitTextToSize(linhaCompleta, pageW - margin * 2 - 4)
  const faixaH = Math.min(48, 12 + subLinhas.length * 3.1)

  doc.setFillColor(brand[0], brand[1], brand[2])
  doc.rect(0, 0, pageW, faixaH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Emendas', margin, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(subLinhas, margin, 15)
  doc.setTextColor(33, 37, 41)
  const startTabela = faixaH + 3

  const body: string[][] =
    rows.length > 0
      ? rows.map((r) => cols.map((k) => pdfCell(r, k)))
      : [cols.map((_, i) => (i === 0 ? 'Nenhum registro' : '—'))]

  const rawSum = cols.reduce((s, k) => s + COL_WIDTH_MM[k], 0)
  const scale = rawSum > innerW ? innerW / rawSum : 1
  const columnStyles: Record<number, { cellWidth: number; halign?: 'left' | 'right' | 'center' }> = {}
  cols.forEach((k, i) => {
    columnStyles[i] = {
      cellWidth: COL_WIDTH_MM[k] * scale,
      halign: isValorKey(k) ? 'right' : 'left',
    }
  })

  doc.autoTable({
    startY: startTabela,
    head: [headers],
    body,
    styles: { fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { fillColor: brand, textColor: 255 },
    columnStyles,
    margin: { left: margin, right: margin },
  })

  const d = doc as JsPdfWithAutoTable
  const lat = d.lastAutoTable
  const finalY = lat && typeof lat === 'object' && typeof lat.finalY === 'number' ? lat.finalY : 22
  let yNote = finalY + 5
  const pageH = doc.internal.pageSize.getHeight()
  if (yNote > pageH - 10) {
    doc.addPage()
    yNote = 14
  }
  doc.setFontSize(7.5)
  doc.setTextColor(110, 118, 128)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · ${rows.length} registro(s)`, margin, yNote)
  doc.setTextColor(33, 37, 41)

  doc.save(nomeArquivoEmendasExport(filtrado, 'pdf'))
}
