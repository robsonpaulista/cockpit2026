import {
  inferTipoObra,
  resolveMunicipioObrasJadyel,
} from '@/lib/jadyel-obras-planilha'
import type { ObraMapaRow } from '@/lib/obras-mapa'

/** Linha crua da API `/api/campo/demands` (Sheets). */
export type CampoDemandaObraRow = {
  id?: string
  title: string
  description?: string | null
  status?: string | null
  theme?: string | null
  priority?: string | null
  lideranca?: string | null
  data_demanda?: string | null
  created_at?: string | null
  from_sheets?: boolean
  sheets_data?: {
    cidade?: string | null
    [key: string]: unknown
  }
}

/** Termos excluídos (Demandas + Mapa de Obras). */
export const DEMANDAS_TERMOS_EXCLUIDOS = [
  'espaco',
  'recurso',
  'transferencia especial',
  'transferencias especiais',
  'transf. especiais',
  'transf especiais',
  'transf. especial',
  'transf especial',
] as const

export function normalizarTextoDemanda(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

function getSheetsField(
  row: CampoDemandaObraRow,
  patterns: RegExp[],
): string | null {
  const raw = row.sheets_data
  if (!raw || typeof raw !== 'object') return null
  const match = Object.entries(raw).find(([key]) =>
    patterns.some((pattern) => pattern.test(key)),
  )
  if (!match) return null
  const text = String(match[1] ?? '').trim()
  return text || null
}

export function liderancaDaDemanda(row: CampoDemandaObraRow): string {
  if (row.lideranca && String(row.lideranca).trim()) {
    return String(row.lideranca).trim()
  }
  return (
    getSheetsField(row, [
      /lideran[cç]a/i,
      /solicitante/i,
      /nome\s*do\s*solicitante/i,
    ]) || '—'
  )
}

export function cidadeDaDemanda(row: CampoDemandaObraRow): string {
  const fromSheets = row.sheets_data?.cidade
  if (fromSheets != null && String(fromSheets).trim()) {
    return String(fromSheets).trim()
  }
  return 'Município não informado'
}

function textoDemandaParaFiltro(row: CampoDemandaObraRow): string {
  return normalizarTextoDemanda(
    [
      row.title,
      row.description,
      row.theme,
      row.status,
      liderancaDaDemanda(row),
      ...Object.values(row.sheets_data ?? {}).map((v) =>
        v == null ? '' : String(v),
      ),
    ].join(' '),
  )
}

export function demandaExcluidaPorTermo(row: CampoDemandaObraRow): boolean {
  const texto = textoDemandaParaFiltro(row)
  return DEMANDAS_TERMOS_EXCLUIDOS.some((termo) => texto.includes(termo))
}

function parseValorSheets(row: CampoDemandaObraRow): number | null {
  const raw =
    getSheetsField(row, [/^valor$/i, /valor\s*\(?.*r\$.*\)?/i, /custo|or[çc]amento/i]) ??
    getSheetsField(row, [/^cota$/i, /cota\s*parlamentar/i])
  if (!raw) return null
  let cleaned = raw.replace(/[^\d.,]/g, '')
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts.length === 2 && parts[1]!.length <= 2) {
      cleaned = cleaned.replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  }
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Filtra linhas da planilha Demandas (Sheets) com as mesmas regras da guia Demandas.
 */
export function filtrarDemandasObrasSheets(
  rows: CampoDemandaObraRow[],
): CampoDemandaObraRow[] {
  return rows.filter(
    (row) => row.from_sheets === true && !demandaExcluidaPorTermo(row),
  )
}

/**
 * Converte demanda do Sheets em linha do Mapa de Obras.
 * Município resolvido para bater com `municipios-piaui.json` (coords).
 */
export function demandaToObraMapaRow(row: CampoDemandaObraRow): ObraMapaRow | null {
  const cidadeRaw = cidadeDaDemanda(row)
  if (!cidadeRaw || /municipio nao informado/i.test(normalizarTextoDemanda(cidadeRaw))) {
    return null
  }

  const municipio = resolveMunicipioObrasJadyel(cidadeRaw)
  const obra = (row.title || '').trim() || 'Sem título'
  const theme = (row.theme || '').trim() || null
  const valor = parseValorSheets(row)
  const tipo = inferTipoObra({ obra, tipo: theme })

  return {
    id: row.id || `demanda-${municipio}-${obra}`,
    municipio,
    obra,
    status: row.status?.trim() || null,
    tipo,
    orgao: theme,
    valor_total: valor,
    cota: valor,
    imagem_url: null,
  }
}

export function demandasToObrasMapa(rows: CampoDemandaObraRow[]): ObraMapaRow[] {
  const out: ObraMapaRow[] = []
  for (const row of filtrarDemandasObrasSheets(rows)) {
    const mapped = demandaToObraMapaRow(row)
    if (mapped) out.push(mapped)
  }
  return out
}
