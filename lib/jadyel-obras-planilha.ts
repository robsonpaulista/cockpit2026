import { createHash } from 'crypto'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import {
  isObraAsfalto,
  isObraLinhaTotalPlanilha,
  isObraMaquinarioAgricola,
  isObraParalelepipedo,
  isObraPassagensCisternas,
  isObraQuadrasEsportivas,
  type ObraMapaRow,
  type ObraMapaTema,
} from '@/lib/obras-mapa'

export type JadyelObraPeriodo = '2023-24' | '2025' | '2026'

export interface JadyelObraPlanilhaRow {
  id: string
  periodo: JadyelObraPeriodo
  municipio: string
  obra: string
  valor_total: number | null
  orgao: string | null
  sei: string | null
  cota: number | null
  obs: string | null
  tipo: ObraMapaTema
  status: string | null
}

export interface JadyelObraMapaRow extends Omit<ObraMapaRow, 'tipo'> {
  periodo: JadyelObraPeriodo
  cota: number | null
  obs: string | null
  sei: string | null
  tipo: ObraMapaTema
}

const MUNICIPIOS_PI = (municipiosPiaui as Array<{ nome: string }>)
  .map((m) => m.nome.trim())
  .sort((a, b) => b.length - a.length)

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeMunicipioName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  const norm = normalizeText(trimmed)
  if (!norm) return trimmed

  // Aliases / grafias incompletas da planilha
  const aliases: Record<string, string> = {
    valenca: 'Valença Do Piauí',
  }
  if (aliases[norm]) return aliases[norm]

  const exact = MUNICIPIOS_PI.find((m) => normalizeText(m) === norm)
  if (exact) return exact

  // Prefixo único: "Valença" → "Valença Do Piauí"
  const prefixMatches = MUNICIPIOS_PI.filter((m) => {
    const nm = normalizeText(m)
    return nm === norm || nm.startsWith(`${norm} `)
  })
  if (prefixMatches.length === 1) return prefixMatches[0]

  return trimmed
}

/** Resolve nome de município da planilha para o cadastro do PI (quando possível). */
export function resolveMunicipioObrasJadyel(value: string): string {
  return normalizeMunicipioName(value)
}

/** Município contável em KPIs de cobertura (exclui agregados genéricos). */
export function isMunicipioObrasContavel(value: string | null | undefined): boolean {
  const nome = String(value ?? '').trim()
  if (!nome) return false
  const norm = normalizeText(nome)
  if (/diversos\s+municipios/.test(norm)) return false
  if (/municipio nao informado/.test(norm)) return false
  return true
}

export function splitMunicipiosCell(value: string): string[] {
  return value
    .split(/[/,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalizeMunicipioName)
}

export function extractMunicipioFromObraText(obra: string): string | null {
  const trimmed = obra.trim()
  if (!trimmed) return null

  const normObra = normalizeText(trimmed)
  for (const municipio of MUNICIPIOS_PI) {
    const normMun = normalizeText(municipio)
    if (normObra.startsWith(normMun)) {
      return normalizeMunicipioName(municipio)
    }
  }
  return null
}

export function parsePlanilhaValor(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const s = String(value).trim()
  if (!s) return null
  const limpo = s.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()
  const n = Number.parseFloat(limpo)
  return Number.isFinite(n) ? n : null
}

export function parsePlanilhaText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s || null
}

export function inferTipoObra(obra: Pick<ObraMapaRow, 'obra' | 'tipo'>): ObraMapaTema {
  if (isObraParalelepipedo(obra)) return 'paralelepipedo'
  if (isObraAsfalto(obra)) return 'asfalto'
  if (isObraQuadrasEsportivas(obra)) return 'quadras-esportivas'
  if (isObraMaquinarioAgricola(obra)) return 'maquinario-agricola'
  if (isObraPassagensCisternas(obra)) return 'passagens-cisternas'
  return 'outros'
}

export function buildJadyelObraId(
  periodo: JadyelObraPeriodo,
  municipio: string,
  obra: string,
  sei: string | null,
  linha: number
): string {
  const hash = createHash('sha256')
    .update(`${periodo}|${municipio}|${obra}|${sei ?? ''}|${linha}`)
    .digest('hex')
    .slice(0, 16)
  return `jad-${periodo.replace(/\D/g, '')}-${hash}`
}

export function classificarTipoPlanilha(obra: string): ObraMapaTema {
  const row = { obra, tipo: null }
  const tipo = inferTipoObra(row)
  if (tipo !== 'outros') return tipo

  const nome = normalizeText(obra)
  if (/praca publica|praca/.test(nome)) return 'quadras-esportivas'
  if (/recuperacao de estrada|estrada vicinal|calç|calcamento/.test(nome)) return 'asfalto'
  return 'outros'
}

export interface PlanilhaRawRow {
  municipio?: unknown
  obra?: unknown
  valor?: unknown
  orgao?: unknown
  sei?: unknown
  cota?: unknown
  obs?: unknown
}

export function parsePlanilhaRows(
  periodo: JadyelObraPeriodo,
  rows: PlanilhaRawRow[]
): JadyelObraPlanilhaRow[] {
  const parsed: JadyelObraPlanilhaRow[] = []
  let contextMunicipios: string[] = []
  let contextOrgao: string | null = null
  let contextSei: string | null = null
  let contextCota: number | null = null
  let contextObs: string | null = null

  rows.forEach((row, index) => {
    const obra = parsePlanilhaText(row.obra)
    if (!obra) return

    const municipioCell = parsePlanilhaText(row.municipio)
    if (municipioCell) {
      contextMunicipios = splitMunicipiosCell(municipioCell)
    }

    const orgao = parsePlanilhaText(row.orgao) ?? contextOrgao
    const sei = parsePlanilhaText(row.sei) ?? contextSei
    const cota = parsePlanilhaValor(row.cota) ?? contextCota
    const obs = parsePlanilhaText(row.obs) ?? contextObs
    const valor_total = parsePlanilhaValor(row.valor)

    if (parsePlanilhaText(row.orgao)) contextOrgao = parsePlanilhaText(row.orgao)
    if (parsePlanilhaText(row.sei)) contextSei = parsePlanilhaText(row.sei)
    if (parsePlanilhaValor(row.cota) != null) contextCota = parsePlanilhaValor(row.cota)
    if (parsePlanilhaText(row.obs)) contextObs = parsePlanilhaText(row.obs)

    const municipioExtraido = extractMunicipioFromObraText(obra)
    let municipio =
      municipioExtraido ??
      (contextMunicipios.length === 1 ? contextMunicipios[0] : null) ??
      contextMunicipios[0] ??
      'Município não informado'

    if (!municipioExtraido && contextMunicipios.length > 1) {
      const normObra = normalizeText(obra)
      const match = contextMunicipios.find((m) => normObra.includes(normalizeText(m)))
      if (match) municipio = match
    }

    municipio = normalizeMunicipioName(municipio)
    const tipo = classificarTipoPlanilha(obra)

    parsed.push({
      id: buildJadyelObraId(periodo, municipio, obra, sei, index + 2),
      periodo,
      municipio,
      obra,
      valor_total,
      orgao,
      sei,
      cota,
      obs,
      tipo,
      status: null,
    })
  })

  return parsed
}

export function toObraMapaRow(obra: JadyelObraPlanilhaRow): JadyelObraMapaRow {
  return {
    id: obra.id,
    municipio: resolveMunicipioObrasJadyel(obra.municipio),
    obra: obra.obra,
    orgao: obra.orgao,
    sei: obra.sei,
    status: obra.status,
    valor_total: obra.valor_total,
    imagem_url: null,
    periodo: obra.periodo,
    cota: obra.cota,
    obs: obra.obs,
    tipo: obra.tipo,
  }
}

/** OBS da planilha marca registro duplicado (não entra no mapa/KPIs). */
export function isObraObsDuplicado(obs: string | null | undefined): boolean {
  if (!obs) return false
  return /\bduplicado\b/i.test(obs)
}

/**
 * Linha de total/subtotal da planilha (ex.: obra === "Total").
 * Não é entrega — só agrega valores e infla KPIs/listas.
 */
export { isObraLinhaTotalPlanilha }

export function filtrarObrasSemDuplicadasObs<T extends { obs?: string | null }>(obras: T[]): T[] {
  return obras.filter((obra) => !isObraObsDuplicado(obra.obs))
}

export function filtrarObrasSemTotaisPlanilha<T extends { obra?: string | null }>(obras: T[]): T[] {
  return obras.filter((obra) => !isObraLinhaTotalPlanilha(obra))
}

/** Remove duplicados e linhas de total da planilha. */
export function filtrarObrasPlanilhaValidas<
  T extends { obra?: string | null; obs?: string | null },
>(obras: T[]): T[] {
  return obras.filter(
    (obra) => !isObraObsDuplicado(obra.obs) && !isObraLinhaTotalPlanilha(obra)
  )
}

export function filtrarObrasMapaTemas(obras: JadyelObraMapaRow[]): JadyelObraMapaRow[] {
  return obras.filter((obra) => obra.tipo !== 'outros')
}
