import ExcelJS from 'exceljs'
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

function totalByColumn(rows: EmendaListExportRow[], k: EmendaListColumnKey): number {
  return rows.reduce((sum, row) => {
    const value = row[k]
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric) ? sum + numeric : sum
  }, 0)
}

function buildPdfTotalRow(
  rows: EmendaListExportRow[],
  cols: EmendaListColumnKey[],
): string[] | null {
  if (rows.length === 0 || !cols.some(isValorKey)) return null

  return cols.map((k, index) => {
    if (index === 0) return 'TOTAL'
    if (!isValorKey(k)) return ''
    return formatBrl(totalByColumn(rows, k))
  })
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

/**
 * Textos institucionais usados como cabeçalho dos relatórios de Emendas
 * (PDF e Excel). Mantido em um único lugar para facilitar a edição quando
 * o gabinete ou o nome do relatório mudar.
 *
 * `leftImagePath` e `rightImagePath` apontam para arquivos servidos a partir
 * de `public/` — se o arquivo não existir, o slot do logo é silenciosamente
 * suprimido (sem placeholder no PDF).
 */
export interface EmendasReportHeader {
  topInstitution: string
  gabinet: string
  reportName: string
  leftImagePath?: string
  rightImagePath?: string
}

export const EMENDAS_REPORT_HEADER: EmendasReportHeader = {
  topInstitution: 'CÂMARA DOS DEPUTADOS',
  gabinet: 'GABINETE DO DEPUTADO JADYEL ALENCAR (Republicanos-PI)',
  reportName: 'RECURSOS PARLAMENTAR',
  leftImagePath: '/relatorios/brasaobr.png',
  rightImagePath: '/relatorios/logo-republicanos.png',
}

/** Formata a data como "DD.MM.AA" para a linha "Atualizada ...". */
function formatHeaderUpdatedDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${yy}`
}

interface LoadedImage {
  dataUrl: string
  width: number
  height: number
  format: 'PNG' | 'JPEG'
}

/**
 * Tenta carregar uma imagem (PNG/JPG) servida a partir de `public/` e
 * convertê-la em data URL para uso no jsPDF.
 *
 * Retorna `null` quando a imagem não existir, falhar o carregamento ou
 * o ambiente não for o navegador. Garante que a exportação continue
 * funcionando mesmo sem os logos institucionais.
 */
async function tryLoadImageAsDataUrl(path: string | undefined): Promise<LoadedImage | null> {
  if (!path || typeof window === 'undefined' || typeof fetch === 'undefined') return null
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('reader'))
      reader.readAsDataURL(blob)
    })
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 })
      img.onerror = () => resolve({ w: 0, h: 0 })
      img.src = dataUrl
    })
    if (dims.w === 0 || dims.h === 0) return null
    const format: 'PNG' | 'JPEG' = blob.type.includes('jpeg') ? 'JPEG' : 'PNG'
    return { dataUrl, width: dims.w, height: dims.h, format }
  } catch {
    return null
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function applyExcelHeaderCellStyle(cell: ExcelJS.Cell, fontSize: number): void {
  cell.font = { bold: true, size: fontSize, name: 'Arial' }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
}

export async function exportEmendasListToXlsx(
  rows: EmendaListExportRow[],
  filtrado: boolean,
  activeColumns: EmendaListColumnKey[],
): Promise<void> {
  const cols = normalizeColumns(activeColumns)
  const labels = cols.map((k) => EMENDAS_LIST_COLUMN_LABELS[k])
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Cockpit 2026'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheet = workbook.addWorksheet('Emendas', {
    properties: {
      defaultRowHeight: 18,
    },
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.45,
        bottom: 0.45,
        header: 0.2,
        footer: 0.2,
      },
    },
  })

  const colCount = Math.max(labels.length, 6)
  const centerStartCol = 2
  const centerEndCol = Math.max(5, colCount - 1)
  const rightLogoCol = Math.max(6, colCount)

  sheet.mergeCells(1, centerStartCol, 1, centerEndCol)
  sheet.mergeCells(2, centerStartCol, 2, centerEndCol)
  sheet.mergeCells(3, centerStartCol, 3, centerEndCol)
  sheet.mergeCells(4, centerStartCol, 4, centerEndCol)

  sheet.getRow(1).height = 22
  sheet.getRow(2).height = 20
  sheet.getRow(3).height = 20
  sheet.getRow(4).height = 16

  const titleCell = sheet.getCell(1, centerStartCol)
  titleCell.value = EMENDAS_REPORT_HEADER.topInstitution
  applyExcelHeaderCellStyle(titleCell, 16)

  const gabinetCell = sheet.getCell(2, centerStartCol)
  gabinetCell.value = EMENDAS_REPORT_HEADER.gabinet
  applyExcelHeaderCellStyle(gabinetCell, 12)

  const reportCell = sheet.getCell(3, centerStartCol)
  reportCell.value = EMENDAS_REPORT_HEADER.reportName
  applyExcelHeaderCellStyle(reportCell, 12)

  const dateCell = sheet.getCell(4, centerStartCol)
  dateCell.value = `Atualizada ${formatHeaderUpdatedDate()}`
  dateCell.font = { bold: true, size: 9, name: 'Arial' }
  dateCell.alignment = { horizontal: 'right', vertical: 'middle' }

  const [leftImage, rightImage] = await Promise.all([
    tryLoadImageAsDataUrl(EMENDAS_REPORT_HEADER.leftImagePath),
    tryLoadImageAsDataUrl(EMENDAS_REPORT_HEADER.rightImagePath),
  ])

  if (leftImage) {
    const imageId = workbook.addImage({
      base64: leftImage.dataUrl,
      extension: leftImage.format === 'JPEG' ? 'jpeg' : 'png',
    })
    sheet.addImage(imageId, {
      tl: { col: 0.15, row: 0.25 },
      ext: { width: 72, height: 72 },
    })
  }

  if (rightImage) {
    const imageId = workbook.addImage({
      base64: rightImage.dataUrl,
      extension: rightImage.format === 'JPEG' ? 'jpeg' : 'png',
    })
    sheet.addImage(imageId, {
      tl: { col: Math.max(0, rightLogoCol - 1.4), row: 0.35 },
      ext: { width: 92, height: 48 },
    })
  }

  const headerRowIndex = 6
  const headerRow = sheet.getRow(headerRowIndex)
  labels.forEach((label, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = label
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Arial' }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163F66' } }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB7C1CC' } },
      left: { style: 'thin', color: { argb: 'FFB7C1CC' } },
      bottom: { style: 'thin', color: { argb: 'FFB7C1CC' } },
      right: { style: 'thin', color: { argb: 'FFB7C1CC' } },
    }
  })
  headerRow.height = 24

  const dataRows: (string | number)[][] =
    rows.length > 0
      ? rows.map((r) => cols.map((k) => excelValue(r, k)))
      : [cols.map((_, i) => (i === 0 ? 'Nenhum registro para os filtros atuais' : ''))]

  dataRows.forEach((values, rowIdx) => {
    const row = sheet.getRow(headerRowIndex + 1 + rowIdx)
    values.forEach((value, colIdx) => {
      const key = cols[colIdx]
      const cell = row.getCell(colIdx + 1)
      cell.value = value
      cell.font = { size: 9, name: 'Arial', color: { argb: 'FF111827' } }
      cell.alignment = {
        vertical: 'middle',
        horizontal: key && isValorKey(key) ? 'right' : 'left',
        wrapText: true,
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      }
      if (key && isValorKey(key) && typeof value === 'number') {
        cell.numFmt = '"R$" #,##0.00'
      }
    })
  })

  cols.forEach((key, idx) => {
    const widthMm = COL_WIDTH_MM[key]
    sheet.getColumn(idx + 1).width = Math.max(10, Math.min(42, Math.round(widthMm * 0.72)))
  })
  sheet.getColumn(1).width = Math.max(sheet.getColumn(1).width || 0, 14)

  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }]

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    nomeArquivoEmendasExport(filtrado, 'xlsx'),
  )
}

/**
 * Renderiza o cabeçalho institucional no topo da página atual do PDF
 * (brasão da Câmara à esquerda, textos institucionais ao centro e o
 * logo do partido + data "Atualizada DD.MM.AA" à direita). Devolve a
 * coordenada Y a partir da qual o conteúdo seguinte deve começar.
 */
async function renderEmendasReportHeader(
  doc: JsPdfWithAutoTable,
  header: EmendasReportHeader,
  margin: number,
): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth()
  const topY = 8
  const headerHeight = 26
  const logoMaxHeight = 22
  const updatedAt = formatHeaderUpdatedDate()

  const [leftImage, rightImage] = await Promise.all([
    tryLoadImageAsDataUrl(header.leftImagePath),
    tryLoadImageAsDataUrl(header.rightImagePath),
  ])

  let textLeft = margin
  let textRight = pageW - margin

  if (leftImage) {
    const ratio = leftImage.width / leftImage.height
    const h = Math.min(logoMaxHeight, headerHeight)
    const w = h * ratio
    doc.addImage(leftImage.dataUrl, leftImage.format, margin, topY, w, h)
    textLeft = margin + w + 4
  }

  if (rightImage) {
    const ratio = rightImage.width / rightImage.height
    const h = Math.min(logoMaxHeight - 4, headerHeight - 4)
    const w = h * ratio
    const x = pageW - margin - w
    doc.addImage(rightImage.dataUrl, rightImage.format, x, topY, w, h)
    textRight = x - 4
  }

  const centerX = (textLeft + textRight) / 2

  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(header.topInstitution, centerX, topY + 6, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(header.gabinet, centerX, topY + 12, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(header.reportName, centerX, topY + 18, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(70, 70, 70)
  doc.text(`Atualizada ${updatedAt}`, pageW - margin, topY + 24, { align: 'right' })

  // Linha divisória sutil abaixo do cabeçalho.
  doc.setDrawColor(200, 205, 212)
  doc.setLineWidth(0.3)
  doc.line(margin, topY + headerHeight, pageW - margin, topY + headerHeight)

  doc.setTextColor(33, 37, 41)
  doc.setFont('helvetica', 'normal')

  return topY + headerHeight + 4
}

export async function exportEmendasListToPdf(
  rows: EmendaListExportRow[],
  filtrado: boolean,
  linhaFiltros: string,
  activeColumns: EmendaListColumnKey[],
): Promise<void> {
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

  const headerBottomY = await renderEmendasReportHeader(doc, EMENDAS_REPORT_HEADER, margin)

  // Bloco de metadados (filtros + colunas) abaixo do cabeçalho institucional.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Emendas', margin, headerBottomY)

  const subLinhas = doc.splitTextToSize(
    `${linhaFiltros}\nColunas: ${headers.join(' · ')}`,
    innerW,
  )
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(80, 88, 100)
  doc.text(subLinhas, margin, headerBottomY + 4)
  doc.setTextColor(33, 37, 41)

  const metaBlockHeight = 4 + subLinhas.length * 3.1
  const startTabela = headerBottomY + metaBlockHeight + 3

  const body: string[][] =
    rows.length > 0
      ? rows.map((r) => cols.map((k) => pdfCell(r, k)))
      : [cols.map((_, i) => (i === 0 ? 'Nenhum registro' : '—'))]
  const totalRow = buildPdfTotalRow(rows, cols)

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
    foot: totalRow ? [totalRow] : undefined,
    styles: { fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { fillColor: brand, textColor: 255 },
    footStyles: {
      fillColor: [238, 242, 247],
      textColor: [17, 24, 39],
      fontStyle: 'bold',
    },
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
