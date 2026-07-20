import * as XLSX from 'xlsx'
import { TERRITORIO_BASE_HEADERS } from '@/lib/territorio-base-records'

export type TerritorioBaseExportFieldId = (typeof TERRITORIO_BASE_HEADERS)[number]

export type TerritorioBaseExportField = {
  id: TerritorioBaseExportFieldId
  label: string
  /** Marcado por padrão no modal. */
  defaultSelected: boolean
}

/** Campos disponíveis na exportação da aba Base (espelha o catálogo canônico). */
export const TERRITORIO_BASE_EXPORT_FIELDS: TerritorioBaseExportField[] = [
  { id: 'id', label: 'ID', defaultSelected: false },
  { id: 'CIDADE', label: 'Cidade', defaultSelected: true },
  { id: 'LIDERANÇA', label: 'Liderança', defaultSelected: true },
  { id: 'CARGO 2024', label: 'Cargo 2024', defaultSelected: true },
  { id: 'DEP. ESTADUAL', label: 'Dep. estadual', defaultSelected: true },
  { id: 'LIDERANÇA ATUAL', label: 'Liderança atual', defaultSelected: true },
  {
    id: 'EXPECTATIVA DE VOTOS 2026',
    label: 'Expectativa de votos 2026',
    defaultSelected: true,
  },
  {
    id: 'EXPECTATIVA JADYEL 2026',
    label: 'Expectativa Jadyel 2026',
    defaultSelected: false,
  },
  {
    id: 'PROMESSA LIDERANÇA 2026',
    label: 'Promessa liderança 2026',
    defaultSelected: false,
  },
  {
    id: 'VOTAÇÃO FINAL 2022',
    label: 'Votação final 2022',
    defaultSelected: false,
  },
]

export function defaultTerritorioBaseExportFieldIds(): TerritorioBaseExportFieldId[] {
  return TERRITORIO_BASE_EXPORT_FIELDS.filter((f) => f.defaultSelected).map((f) => f.id)
}

export type TerritorioBaseExportOptions = {
  records: Array<Record<string, unknown>>
  fieldIds: TerritorioBaseExportFieldId[]
  /** Rótulos amigáveis dos filtros ativos (aba “Filtros”). */
  filtrosResumo?: Array<{ Campo: string; Valor: string }>
}

function labelCampo(id: TerritorioBaseExportFieldId): string {
  return TERRITORIO_BASE_EXPORT_FIELDS.find((f) => f.id === id)?.label ?? id
}

function nomeArquivoBaseExport(): string {
  const dia = new Date().toISOString().slice(0, 10)
  return `base-liderancas-${dia}.xlsx`
}

function cellValue(record: Record<string, unknown>, fieldId: TerritorioBaseExportFieldId): string | number {
  const raw = record[fieldId]
  if (raw == null || raw === '') return ''
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const n = Number(raw)
  if (
    typeof raw === 'string' &&
    raw.trim() !== '' &&
    Number.isFinite(n) &&
    /votos|expectativa|promessa|id/i.test(fieldId)
  ) {
    // Mantém números quando a origem já é numérica; id pode ser number.
    if (fieldId === 'id' || !Number.isNaN(n)) {
      if (fieldId === 'id') return n
      if (String(raw).trim() === String(n)) return n
    }
  }
  return String(raw).trim()
}

/** Monta linhas só com os campos escolhidos (ordem = seleção). */
export function buildTerritorioBaseExportRows(
  records: Array<Record<string, unknown>>,
  fieldIds: TerritorioBaseExportFieldId[]
): Array<Record<string, string | number>> {
  const cols = fieldIds.filter((id) =>
    TERRITORIO_BASE_EXPORT_FIELDS.some((f) => f.id === id)
  )
  if (cols.length === 0) return []

  return records.map((record) => {
    const row: Record<string, string | number> = {}
    for (const id of cols) {
      row[labelCampo(id)] = cellValue(record, id)
    }
    return row
  })
}

/** Exporta Excel (.xlsx) das lideranças filtradas, com campos escolhidos. */
export function exportarTerritorioBaseExcel(options: TerritorioBaseExportOptions): void {
  const { records, fieldIds, filtrosResumo } = options
  const cols = fieldIds.filter((id) =>
    TERRITORIO_BASE_EXPORT_FIELDS.some((f) => f.id === id)
  )
  if (cols.length === 0) {
    throw new Error('Selecione ao menos um campo para exportar.')
  }

  const rows = buildTerritorioBaseExportRows(records, cols)
  const wsDados = XLSX.utils.json_to_sheet(
    rows.length
      ? rows
      : [{ Aviso: 'Nenhuma liderança na seleção filtrada atual' }]
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsDados, 'Lideranças')

  const meta = [
    { Campo: 'Registros exportados', Valor: records.length },
    { Campo: 'Campos', Valor: cols.map(labelCampo).join(', ') },
    {
      Campo: 'Exportado em',
      Valor: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    },
    ...(filtrosResumo ?? []),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Filtros')

  XLSX.writeFile(wb, nomeArquivoBaseExport())
}
