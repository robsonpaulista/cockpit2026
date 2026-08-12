import {
  isObraMamografia,
  isObraMaquinarioAgricola,
  valorExibidoMapaObra,
  type ObraMapaRow,
} from '@/lib/obras-mapa'
import { rankStatusMapaObraLista } from '@/lib/mapa-obras-lista-export'

const TIPO_SEM = '__sem_tipo__'
const TIPO_INFRA = 'infraestrutura'
const TIPO_MAQUINARIO = 'maquinario-agricola'
const TIPO_SAUDE = 'saude'
const TIPO_OUTROS = 'outros'

const TIPO_LABEL: Record<string, string> = {
  asfalto: 'Asfalto',
  paralelepipedo: 'Paralelepípedo',
  'quadras-esportivas': 'Quadras e areninhas',
  [TIPO_MAQUINARIO]: 'Maquinário agrícola',
  'passagens-cisternas': 'Passagens e cisternas',
  [TIPO_INFRA]: 'Infraestrutura',
  [TIPO_SAUDE]: 'Saúde',
  [TIPO_OUTROS]: 'Outros',
}

function normalizeTipoSlug(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}

function textoTemConstrucaoOuReforma(raw: string): boolean {
  const n = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return /\bconstruc(ao|oes)\b|\breforma(s)?\b|\brevitalizac(ao|oes)\b/.test(n)
}

function textoTemVicinal(raw: string): boolean {
  const n = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return /\bvicinal(is|ais)?\b/.test(n)
}

/** Mesma classificação da guia Obras (lista por tipo). */
export function tipoKeyOf(obra: Pick<ObraMapaRow, 'tipo' | 'obra'>): string {
  const nome = obra.obra ?? ''
  const nomeNorm = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (/\bubs\b|\bunidade basica de saude\b/.test(nomeNorm)) {
    return TIPO_SAUDE
  }
  if (isObraMamografia(obra)) {
    return TIPO_OUTROS
  }
  if (textoTemConstrucaoOuReforma(nome) || textoTemVicinal(nome)) {
    return TIPO_INFRA
  }
  if (isObraMaquinarioAgricola(obra)) {
    return TIPO_MAQUINARIO
  }
  const t = (obra.tipo ?? '').trim()
  if (!t) return TIPO_SEM
  const slug = normalizeTipoSlug(t)
  if (slug === 'ubs' || slug === 'saude' || slug === TIPO_SAUDE) {
    return TIPO_SAUDE
  }
  if (
    slug === 'construcao' ||
    slug === 'reforma' ||
    slug === 'revitalizacao' ||
    slug === 'vicinal' ||
    slug === 'vicinais' ||
    slug === 'estrada-vicinal' ||
    slug === 'estradas-vicinais' ||
    slug === TIPO_INFRA
  ) {
    return TIPO_INFRA
  }
  if (slug === 'carreta' || slug === 'carreta-agricola' || slug === TIPO_MAQUINARIO) {
    return TIPO_MAQUINARIO
  }
  if (textoTemVicinal(t)) return TIPO_INFRA
  return t
}

export function tipoLabelOf(key: string): string {
  if (key === TIPO_SEM) return 'Sem tipo'
  return TIPO_LABEL[key] ?? key
}

export function compareTipoKeys(a: string, b: string): number {
  const ordem = Object.keys(TIPO_LABEL)
  const ia = ordem.indexOf(a)
  const ib = ordem.indexOf(b)
  if (ia >= 0 && ib >= 0) return ia - ib
  if (ia >= 0) return -1
  if (ib >= 0) return 1
  if (a === TIPO_SEM) return 1
  if (b === TIPO_SEM) return -1
  return tipoLabelOf(a).localeCompare(tipoLabelOf(b), 'pt-BR')
}

function compareStatusObras(a: ObraMapaRow, b: ObraMapaRow): number {
  const sa = (a.status ?? '').trim()
  const sb = (b.status ?? '').trim()
  const ra = rankStatusMapaObraLista(sa)
  const rb = rankStatusMapaObraLista(sb)
  if (ra !== rb) return ra - rb
  if (!sa && sb) return 1
  if (sa && !sb) return -1
  const byStatus = sa.localeCompare(sb, 'pt-BR', { sensitivity: 'base' })
  if (byStatus !== 0) return byStatus
  const va = valorExibidoMapaObra(a) ?? 0
  const vb = valorExibidoMapaObra(b) ?? 0
  if (vb !== va) return vb - va
  return (a.obra ?? '').localeCompare(b.obra ?? '', 'pt-BR')
}

export type BlocoObrasPorTipo = {
  tipoKey: string
  tipoLabel: string
  obras: ObraMapaRow[]
}

/** Agrupa por tipo (ordem da guia Obras) e ordena linhas por status. */
export function groupObrasByTipoSortedByStatus(
  obras: ObraMapaRow[],
): BlocoObrasPorTipo[] {
  const byTipo = new Map<string, ObraMapaRow[]>()
  for (const obra of obras) {
    const key = tipoKeyOf(obra)
    const list = byTipo.get(key)
    if (list) list.push(obra)
    else byTipo.set(key, [obra])
  }
  return [...byTipo.keys()].sort(compareTipoKeys).map((tipoKey) => ({
    tipoKey,
    tipoLabel: tipoLabelOf(tipoKey),
    obras: [...(byTipo.get(tipoKey) ?? [])].sort(compareStatusObras),
  }))
}

/** Ano a partir de `data_demanda` (BR, ISO ou serial Excel). */
export function anoFromDataDemanda(raw?: string | null): string {
  if (!raw?.trim()) return '—'
  const t = raw.trim()
  const br = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (br) {
    let y = br[3]!
    if (y.length === 2) y = `20${y}`
    return y
  }
  const parsed = new Date(t)
  if (!Number.isNaN(parsed.getTime())) {
    return String(parsed.getFullYear())
  }
  const serial = Number(t)
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const ms = excelEpoch + Math.round(serial) * 86400000
    return String(new Date(ms).getUTCFullYear())
  }
  return '—'
}
