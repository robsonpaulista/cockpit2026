import {
  cidadeDaDemanda,
  demandaToObraMapaRow,
  filtrarDemandasObrasSheets,
  type CampoDemandaObraRow,
} from '@/lib/campo-demandas-obras'
import { emendaMunicipioCorresponde, type EmendaRegistro } from '@/lib/emendas-filtro'
import { normalizeIptMunicipio, type IptMunicipio } from '@/lib/ipt'
import { resolveMunicipioObrasJadyel } from '@/lib/jadyel-obras-planilha'
import { valorExibidoMapaObra } from '@/lib/obras-mapa'
import { statusEmendaRelatorio } from '@/lib/war-room/relatorio-executivo-municipio'

type IptMeta = {
  municipio: string
  expectativaVotos: number
}

type UnifiedCsvRow = {
  expectativa: number
  cidade: string
  tipo: 'emenda' | 'demanda'
  descricao: string
  cells: string[]
}

const HEADERS = [
  'Cidade',
  'Descrição',
  'Valor',
  'Valor empenhado',
  'Valor Pago',
  'Status',
] as const

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
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

function diaIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatNum(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return ''
  return String(value)
}

function labelStatusEmenda(status: ReturnType<typeof statusEmendaRelatorio>): string {
  if (status === 'PAGO') return 'Pago'
  if (status === 'EMPENHADO') return 'Empenhado'
  return 'Indicado'
}

function descricaoEmenda(e: EmendaRegistro): string {
  const emenda = e.emenda?.trim() ?? ''
  const objeto = e.objeto?.trim() ?? ''
  if (emenda && objeto) return `${emenda} — ${objeto}`
  return emenda || objeto
}

function buildIptByKey(municipios: IptMunicipio[]): Map<string, IptMeta> {
  const map = new Map<string, IptMeta>()
  for (const m of municipios) {
    const key = normalizeIptMunicipio(m.municipio)
    if (!key) continue
    map.set(key, {
      municipio: m.municipio,
      expectativaVotos: m.expectativaVotos,
    })
  }
  return map
}

function resolveIptMetaForEmenda(
  municipioBeneficiario: string | null | undefined,
  municipios: IptMunicipio[],
  byKey: Map<string, IptMeta>,
): IptMeta | null {
  if (!municipioBeneficiario?.trim()) return null
  const direct = byKey.get(normalizeIptMunicipio(municipioBeneficiario))
  if (direct) return direct
  for (const m of municipios) {
    if (emendaMunicipioCorresponde(municipioBeneficiario, m.municipio)) {
      return {
        municipio: m.municipio,
        expectativaVotos: m.expectativaVotos,
      }
    }
  }
  return null
}

function resolveIptMetaForCidade(
  cidadeRaw: string,
  byKey: Map<string, IptMeta>,
): IptMeta | null {
  const raw = cidadeRaw.trim()
  if (!raw) return null
  const resolved = resolveMunicipioObrasJadyel(raw)
  return (
    byKey.get(normalizeIptMunicipio(resolved)) ??
    byKey.get(normalizeIptMunicipio(raw)) ??
    null
  )
}

function compareUnified(a: UnifiedCsvRow, b: UnifiedCsvRow): number {
  if (b.expectativa !== a.expectativa) return b.expectativa - a.expectativa
  const byCidade = a.cidade.localeCompare(b.cidade, 'pt-BR')
  if (byCidade !== 0) return byCidade
  if (a.tipo !== b.tipo) return a.tipo === 'emenda' ? -1 : 1
  return a.descricao.localeCompare(b.descricao, 'pt-BR')
}

/** Monta linhas unificadas (emendas + demandas) ordenadas por expectativa. */
export function buildRelatorioUnificadoCsvRows(
  emendas: EmendaRegistro[],
  demandas: CampoDemandaObraRow[],
  municipios: IptMunicipio[],
): string[][] {
  const byKey = buildIptByKey(municipios)
  const rows: UnifiedCsvRow[] = []

  for (const e of emendas) {
    const meta = resolveIptMetaForEmenda(e.municipio_beneficiario, municipios, byKey)
    const cidade = meta?.municipio ?? (e.municipio_beneficiario?.trim() || '')
    const descricao = descricaoEmenda(e)
    rows.push({
      expectativa: meta?.expectativaVotos ?? 0,
      cidade,
      tipo: 'emenda',
      descricao,
      cells: [
        cidade,
        descricao,
        formatNum(e.valor_indicado),
        formatNum(e.valor_empenhado),
        formatNum(e.valor_pago),
        labelStatusEmenda(statusEmendaRelatorio(e)),
      ],
    })
  }

  for (const row of filtrarDemandasObrasSheets(demandas)) {
    const cidadeRaw = cidadeDaDemanda(row)
    const meta = resolveIptMetaForCidade(cidadeRaw, byKey)
    const mapped = demandaToObraMapaRow(row)
    const cidade = meta?.municipio ?? (mapped?.municipio || cidadeRaw)
    const descricao = (row.title || '').trim()
    const valor = mapped ? valorExibidoMapaObra(mapped) : null
    rows.push({
      expectativa: meta?.expectativaVotos ?? 0,
      cidade,
      tipo: 'demanda',
      descricao,
      cells: [
        cidade,
        descricao,
        formatNum(valor),
        '',
        '',
        (row.status || '').trim(),
      ],
    })
  }

  rows.sort(compareUnified)

  return [[...HEADERS], ...rows.map((r) => r.cells)]
}

/** Baixa um CSV único com emendas e demandas, ordenado por expectativa de votos. */
export function exportRelatorioEmendasDemandasCsv(opts: {
  emendas: EmendaRegistro[]
  demandas: CampoDemandaObraRow[]
  municipios: IptMunicipio[]
}): void {
  const dia = diaIso()
  const table = buildRelatorioUnificadoCsvRows(
    opts.emendas,
    opts.demandas,
    opts.municipios,
  )
  const lines = table.map((row) => row.map((cell) => csvEscape(String(cell))).join(','))
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  downloadBlob(blob, `relatorio-emendas-demandas-por-expectativa-${dia}.csv`)
}
