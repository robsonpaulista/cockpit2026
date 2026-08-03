import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { applyPlugin, type UserOptions } from 'jspdf-autotable'
import {
  classificarObraFase,
  OBRA_FASE_LABEL,
  valorExibidoMapaObra,
  type ObraMapaRow,
} from '@/lib/obras-mapa'
import {
  planoDriveTemArquivo,
  planoDriveTemNota,
  type ObraPlanoDriveLink,
} from '@/lib/obras-mapa-plano-drive'

export type MapaObraListaExportFieldId =
  | 'municipio'
  | 'obra'
  | 'tipo'
  | 'valor'
  | 'tema'
  | 'status'
  | 'fase'
  | 'plano_drive'

export type MapaObraListaExportField = {
  id: MapaObraListaExportFieldId
  label: string
  defaultSelected: boolean
}

export const MAPA_OBRAS_LISTA_EXPORT_FIELDS: MapaObraListaExportField[] = [
  { id: 'municipio', label: 'Município', defaultSelected: true },
  { id: 'obra', label: 'Obra', defaultSelected: true },
  { id: 'tipo', label: 'Tipo', defaultSelected: true },
  { id: 'valor', label: 'Valor', defaultSelected: true },
  { id: 'tema', label: 'Tema / órgão', defaultSelected: false },
  { id: 'status', label: 'Status', defaultSelected: true },
  { id: 'fase', label: 'Fase no mapa', defaultSelected: false },
  { id: 'plano_drive', label: 'Plano Drive', defaultSelected: true },
]

export function defaultMapaObraListaExportFieldIds(): MapaObraListaExportFieldId[] {
  return MAPA_OBRAS_LISTA_EXPORT_FIELDS.filter((f) => f.defaultSelected).map((f) => f.id)
}

export type MapaObraListaExportRow = Record<MapaObraListaExportFieldId, string>

export type MapaObraListaExportFormat = 'csv' | 'xlsx' | 'pdf'

export type MapaObraListaExportOptions = {
  rows: MapaObraListaExportRow[]
  fieldIds: MapaObraListaExportFieldId[]
  filtrosResumo?: string[]
  municipiosCount?: number
  valorTotal?: number | null
}

const TIPO_LABEL: Record<string, string> = {
  asfalto: 'Asfalto',
  paralelepipedo: 'Paralelepípedo',
  'quadras-esportivas': 'Quadras e areninhas',
  'maquinario-agricola': 'Maquinário agrícola',
  'passagens-cisternas': 'Passagens e cisternas',
  outros: 'Outros',
}

let jspdfAutotableApplied = false

function ensureJspdfAutotable(): void {
  if (!jspdfAutotableApplied) {
    applyPlugin(jsPDF)
    jspdfAutotableApplied = true
  }
}

type JsPdfWithAutoTable = InstanceType<typeof jsPDF> & {
  autoTable: (options: UserOptions) => InstanceType<typeof jsPDF>
}

function nomeArquivo(ext: MapaObraListaExportFormat): string {
  const dia = new Date().toISOString().slice(0, 10)
  return `mapa-obras-lista-${dia}.${ext}`
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function formatCurrency(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 20,
  }).format(value)
}

function labelCampo(id: MapaObraListaExportFieldId): string {
  return MAPA_OBRAS_LISTA_EXPORT_FIELDS.find((f) => f.id === id)?.label ?? id
}

function labelTipo(tipo?: string | null): string {
  const t = (tipo ?? '').trim()
  if (!t) return ''
  return TIPO_LABEL[t] ?? t
}

function textoPlanoDrive(link: ObraPlanoDriveLink | null | undefined): string {
  if (!link) return ''
  if (planoDriveTemArquivo(link)) {
    return link.drive_file_name?.trim() || link.drive_file_id || 'Arquivo vinculado'
  }
  if (planoDriveTemNota(link)) return link.nota_texto?.trim() || ''
  return ''
}

function normalizeStatusTexto(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Ordem do PDF: Obra Concluída → Equipamento Entregue → Obra em Andamento → Aguardando.
 */
export function rankStatusMapaObraLista(status: string | null | undefined): number {
  const n = normalizeStatusTexto(status || '')
  if (!n) return 90
  if (n.includes('conclu') || n.includes('resolvid')) return 10
  if (n.includes('equipamento') && n.includes('entreg')) return 20
  if (n.includes('entregue') && !n.includes('aguard')) return 20
  if (n.includes('andamento') || n.includes('progresso')) return 30
  if (n.includes('aguard') || n.includes('pendente')) return 40
  return 50
}

function compareStatusThenMunicipio(
  a: MapaObraListaExportRow,
  b: MapaObraListaExportRow,
): number {
  const ra = rankStatusMapaObraLista(a.status)
  const rb = rankStatusMapaObraLista(b.status)
  if (ra !== rb) return ra - rb
  const byStatus = a.status.localeCompare(b.status, 'pt-BR', { sensitivity: 'base' })
  if (byStatus !== 0) return byStatus
  const byMun = a.municipio.localeCompare(b.municipio, 'pt-BR', { sensitivity: 'base' })
  if (byMun !== 0) return byMun
  return a.obra.localeCompare(b.obra, 'pt-BR', { sensitivity: 'base' })
}

function rowsParaPdf(rows: MapaObraListaExportRow[]): MapaObraListaExportRow[] {
  return [...rows].sort(compareStatusThenMunicipio)
}

/** Monta linhas a partir da lista filtrada (mantém a ordem da tela). */
export function buildMapaObraListaExportRows(
  obras: ObraMapaRow[],
  linksByObra: Record<string, ObraPlanoDriveLink>,
): MapaObraListaExportRow[] {
  return obras.map((obra) => {
    const fase = classificarObraFase(obra.status)
    return {
      municipio: (obra.municipio || '').trim(),
      obra: (obra.obra || '').trim(),
      tipo: labelTipo(obra.tipo),
      valor: formatCurrency(valorExibidoMapaObra(obra)),
      tema: (obra.orgao || '').trim(),
      status: (obra.status || '').trim(),
      fase: OBRA_FASE_LABEL[fase],
      plano_drive: textoPlanoDrive(linksByObra[obra.id]),
    }
  })
}

function resolveFieldIds(
  fieldIds: MapaObraListaExportFieldId[],
): MapaObraListaExportFieldId[] {
  const allowed = new Set(MAPA_OBRAS_LISTA_EXPORT_FIELDS.map((f) => f.id))
  const ordered = MAPA_OBRAS_LISTA_EXPORT_FIELDS.map((f) => f.id).filter(
    (id) => fieldIds.includes(id) && allowed.has(id),
  )
  if (ordered.length === 0) {
    throw new Error('Selecione ao menos uma coluna para exportar.')
  }
  return ordered
}

function headersFor(fieldIds: MapaObraListaExportFieldId[]): string[] {
  return fieldIds.map(labelCampo)
}

function cellRow(
  row: MapaObraListaExportRow,
  fieldIds: MapaObraListaExportFieldId[],
): string[] {
  return fieldIds.map((id) => row[id] ?? '')
}

function metaLinhas(opts: MapaObraListaExportOptions & { organizacao?: string }): string[] {
  const lines = [
    `Registros: ${opts.rows.length}`,
    opts.municipiosCount != null ? `Municípios: ${opts.municipiosCount}` : null,
    opts.valorTotal != null && Number.isFinite(opts.valorTotal)
      ? `Valor total: ${formatCurrency(opts.valorTotal)}`
      : null,
    `Colunas: ${opts.fieldIds.map(labelCampo).join(', ')}`,
    opts.organizacao ?? null,
    `Exportado em: ${new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })}`,
    ...(opts.filtrosResumo ?? []),
  ]
  return lines.filter((v): v is string => Boolean(v))
}

export function exportarMapaObrasListaCsv(opts: MapaObraListaExportOptions): void {
  const fieldIds = resolveFieldIds(opts.fieldIds)
  const headers = headersFor(fieldIds)
  const lines = [
    headers.join(','),
    ...opts.rows.map((row) => cellRow(row, fieldIds).map(csvEscape).join(',')),
  ]
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  downloadBlob(blob, nomeArquivo('csv'))
}

export function exportarMapaObrasListaExcel(opts: MapaObraListaExportOptions): void {
  const fieldIds = resolveFieldIds(opts.fieldIds)
  const headers = headersFor(fieldIds)
  const aoa: (string | number)[][] = [
    headers,
    ...opts.rows.map((row) => cellRow(row, fieldIds)),
  ]
  if (aoa.length === 1) {
    aoa.push(['Nenhuma obra na seleção filtrada atual', ...fieldIds.slice(1).map(() => '')])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = fieldIds.map((id) => {
    if (id === 'obra' || id === 'plano_drive') return { wch: 40 }
    if (id === 'municipio') return { wch: 18 }
    if (id === 'tema') return { wch: 18 }
    if (id === 'status' || id === 'fase') return { wch: 16 }
    if (id === 'valor') return { wch: 14 }
    return { wch: 14 }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Obras')

  const meta = metaLinhas({ ...opts, fieldIds }).map((line) => {
    const [campo, ...rest] = line.split(': ')
    return { Campo: campo ?? line, Valor: rest.join(': ') || '' }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Filtros')

  XLSX.writeFile(wb, nomeArquivo('xlsx'))
}

export function exportarMapaObrasListaPdf(opts: MapaObraListaExportOptions): void {
  const fieldIds = resolveFieldIds(opts.fieldIds)
  const headers = headersFor(fieldIds)
  const rows = rowsParaPdf(opts.rows)

  ensureJspdfAutotable()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pdf = doc as JsPdfWithAutoTable

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Base Eleitoral · Mapa de Obras · Lista', 14, 14)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.text(
    metaLinhas({
      ...opts,
      fieldIds,
      rows,
      organizacao:
        'Ordem: Obra Concluída → Equipamento Entregue → Obra em Andamento → Aguardando',
    }).join(' · '),
    14,
    20,
  )

  const usableWidth = 277
  const weight: Record<MapaObraListaExportFieldId, number> = {
    municipio: 1.2,
    obra: 2.4,
    tipo: 1.1,
    valor: 1,
    tema: 1.2,
    status: 1.1,
    fase: 1,
    plano_drive: 1.8,
  }
  const totalWeight = fieldIds.reduce((sum, id) => sum + weight[id], 0)
  const columnStyles: UserOptions['columnStyles'] = {}
  fieldIds.forEach((id, index) => {
    columnStyles[index] = {
      cellWidth: Math.max(16, (usableWidth * weight[id]) / totalWeight),
    }
  })

  pdf.autoTable({
    startY: 24,
    head: [headers],
    body: rows.map((row) => cellRow(row, fieldIds)),
    styles: {
      fontSize: 7,
      cellPadding: 1.4,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 246],
    },
    columnStyles,
    margin: { left: 10, right: 10 },
  })

  pdf.save(nomeArquivo('pdf'))
}

export function exportarMapaObrasLista(
  formato: MapaObraListaExportFormat,
  opts: MapaObraListaExportOptions,
): void {
  if (formato === 'csv') exportarMapaObrasListaCsv(opts)
  else if (formato === 'xlsx') exportarMapaObrasListaExcel(opts)
  else exportarMapaObrasListaPdf(opts)
}
