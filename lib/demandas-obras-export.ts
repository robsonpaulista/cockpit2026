import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { applyPlugin, type UserOptions } from 'jspdf-autotable'
import {
  cidadeDaDemanda,
  liderancaDaDemanda,
  normalizarTextoDemanda,
  type CampoDemandaObraRow,
} from '@/lib/campo-demandas-obras'

export type DemandaObraExportFieldId =
  | 'cidade'
  | 'titulo'
  | 'descricao'
  | 'status'
  | 'lideranca'
  | 'tema'
  | 'data'

export type DemandaObraExportField = {
  id: DemandaObraExportFieldId
  label: string
  defaultSelected: boolean
}

export const DEMANDAS_OBRAS_EXPORT_FIELDS: DemandaObraExportField[] = [
  { id: 'cidade', label: 'Cidade', defaultSelected: true },
  { id: 'titulo', label: 'Obra / solicitação', defaultSelected: true },
  { id: 'descricao', label: 'Descrição', defaultSelected: false },
  { id: 'status', label: 'Status', defaultSelected: true },
  { id: 'lideranca', label: 'Liderança', defaultSelected: true },
  { id: 'tema', label: 'Tema', defaultSelected: true },
  { id: 'data', label: 'Data', defaultSelected: true },
]

export function defaultDemandaObraExportFieldIds(): DemandaObraExportFieldId[] {
  return DEMANDAS_OBRAS_EXPORT_FIELDS.filter((f) => f.defaultSelected).map((f) => f.id)
}

export type DemandaObraExportRow = Record<DemandaObraExportFieldId, string>

export type DemandaObraExportFormat = 'csv' | 'xlsx' | 'pdf'

export type DemandaObraExportOptions = {
  rows: DemandaObraExportRow[]
  fieldIds: DemandaObraExportFieldId[]
  /** Ex.: termo de busca ativo. */
  filtrosResumo?: string[]
  cidadesCount?: number
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

function nomeArquivo(ext: DemandaObraExportFormat): string {
  const dia = new Date().toISOString().slice(0, 10)
  return `demandas-obras-${dia}.${ext}`
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

function formatDataCurta(value?: string | null): string {
  if (!value) return ''
  const iso = value.includes('T') ? value.slice(0, 10) : value
  const parts = iso.split('-')
  if (parts.length >= 3 && /^\d{4}$/.test(parts[0] ?? '')) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

function labelCampo(id: DemandaObraExportFieldId): string {
  return DEMANDAS_OBRAS_EXPORT_FIELDS.find((f) => f.id === id)?.label ?? id
}

/**
 * Prioridade para agrupar obras por status no export.
 * Ordem: Obra Concluída → Finalizada → Obra em Andamento → Aguardando.
 */
export function rankStatusDemanda(status: string | null | undefined): number {
  const n = normalizarTextoDemanda(status || '')
  if (!n) return 90
  if (n.includes('conclu') || n.includes('resolvid')) return 10
  if (n.includes('finaliz')) return 20
  if (n.includes('andamento') || n.includes('progresso')) return 30
  if (n.includes('aguard') || n.includes('pendente')) return 40
  return 50
}

function compareStatusThenCidade(
  a: DemandaObraExportRow,
  b: DemandaObraExportRow,
): number {
  const ra = rankStatusDemanda(a.status)
  const rb = rankStatusDemanda(b.status)
  if (ra !== rb) return ra - rb
  const byStatus = a.status.localeCompare(b.status, 'pt-BR', { sensitivity: 'base' })
  if (byStatus !== 0) return byStatus
  const byCidade = a.cidade.localeCompare(b.cidade, 'pt-BR', { sensitivity: 'base' })
  if (byCidade !== 0) return byCidade
  return a.titulo.localeCompare(b.titulo, 'pt-BR', { sensitivity: 'base' })
}

/** Monta linhas a partir do filtro atual e ordena por status. */
export function buildDemandaObraExportRows(
  rows: CampoDemandaObraRow[],
): DemandaObraExportRow[] {
  return rows
    .map((row) => {
      const lideranca = liderancaDaDemanda(row)
      return {
        cidade: cidadeDaDemanda(row),
        titulo: (row.title || '').trim(),
        descricao: (row.description || '').trim(),
        status: (row.status || '').trim(),
        lideranca: lideranca === '—' ? '' : lideranca,
        tema: (row.theme || '').trim(),
        data: formatDataCurta(row.data_demanda || row.created_at),
      }
    })
    .sort(compareStatusThenCidade)
}

function resolveFieldIds(
  fieldIds: DemandaObraExportFieldId[],
): DemandaObraExportFieldId[] {
  const allowed = new Set(DEMANDAS_OBRAS_EXPORT_FIELDS.map((f) => f.id))
  const ordered = DEMANDAS_OBRAS_EXPORT_FIELDS.map((f) => f.id).filter(
    (id) => fieldIds.includes(id) && allowed.has(id),
  )
  if (ordered.length === 0) {
    throw new Error('Selecione ao menos uma coluna para exportar.')
  }
  return ordered
}

function headersFor(fieldIds: DemandaObraExportFieldId[]): string[] {
  return fieldIds.map(labelCampo)
}

function cellRow(
  row: DemandaObraExportRow,
  fieldIds: DemandaObraExportFieldId[],
): string[] {
  return fieldIds.map((id) => row[id] ?? '')
}

function metaLinhas(opts: DemandaObraExportOptions): string[] {
  const lines = [
    `Registros: ${opts.rows.length}`,
    opts.cidadesCount != null ? `Cidades: ${opts.cidadesCount}` : null,
    `Colunas: ${opts.fieldIds.map(labelCampo).join(', ')}`,
    'Organização: por status',
    `Exportado em: ${new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })}`,
    ...(opts.filtrosResumo ?? []),
  ]
  return lines.filter((v): v is string => Boolean(v))
}

export function exportarDemandasObrasCsv(opts: DemandaObraExportOptions): void {
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

export function exportarDemandasObrasExcel(opts: DemandaObraExportOptions): void {
  const fieldIds = resolveFieldIds(opts.fieldIds)
  const headers = headersFor(fieldIds)
  const aoa: (string | number)[][] = [
    headers,
    ...opts.rows.map((row) => cellRow(row, fieldIds)),
  ]
  if (aoa.length === 1) {
    aoa.push(['Nenhuma demanda na seleção filtrada atual', ...fieldIds.slice(1).map(() => '')])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = fieldIds.map((id) => {
    if (id === 'titulo' || id === 'descricao') return { wch: 40 }
    if (id === 'lideranca') return { wch: 22 }
    if (id === 'cidade') return { wch: 18 }
    if (id === 'status') return { wch: 14 }
    if (id === 'tema') return { wch: 16 }
    return { wch: 12 }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Demandas')

  const meta = metaLinhas({ ...opts, fieldIds }).map((line) => {
    const [campo, ...rest] = line.split(': ')
    return { Campo: campo ?? line, Valor: rest.join(': ') || '' }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Filtros')

  XLSX.writeFile(wb, nomeArquivo('xlsx'))
}

export function exportarDemandasObrasPdf(opts: DemandaObraExportOptions): void {
  const fieldIds = resolveFieldIds(opts.fieldIds)
  const headers = headersFor(fieldIds)

  ensureJspdfAutotable()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pdf = doc as JsPdfWithAutoTable

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Base Eleitoral · Demandas / Obras', 14, 14)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.text(metaLinhas({ ...opts, fieldIds }).join(' · '), 14, 20)

  const usableWidth = 277
  const weight: Record<DemandaObraExportFieldId, number> = {
    cidade: 1.2,
    titulo: 2.4,
    descricao: 2.2,
    status: 1,
    lideranca: 1.5,
    tema: 1.1,
    data: 0.9,
  }
  const totalWeight = fieldIds.reduce((sum, id) => sum + weight[id], 0)
  const columnStyles: UserOptions['columnStyles'] = {}
  fieldIds.forEach((id, index) => {
    columnStyles[index] = {
      cellWidth: Math.max(18, (usableWidth * weight[id]) / totalWeight),
    }
  })

  pdf.autoTable({
    startY: 24,
    head: [headers],
    body: opts.rows.map((row) => cellRow(row, fieldIds)),
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

export function exportarDemandasObras(
  formato: DemandaObraExportFormat,
  opts: DemandaObraExportOptions,
): void {
  if (formato === 'csv') exportarDemandasObrasCsv(opts)
  else if (formato === 'xlsx') exportarDemandasObrasExcel(opts)
  else exportarDemandasObrasPdf(opts)
}
