import type { PrioridadeCampoMapaRow } from '@/components/mapa-presenca'

/** Faixa exclusiva de cobertura territorial — alinhada aos filtros e ao painel lateral. */
export type FaixaCobertura = 'sem-cobertura' | 'atencao' | 'bem-cobertas' | 'baixa-densidade'

export type FiltroCobertura = FaixaCobertura | 'todos'

export type ExpectativaVisitasMunicipio = {
  cidade: string
  expectativa: number
  /** Peso da cidade sobre a expectativa total de votos (0–100). */
  pctPesoExpectativa: number
  visitas: number
  coberturaPct: number
  faixa: FaixaCobertura
  gapScore: number
}

export type CoberturaTerritorialFaixa = {
  id: FaixaCobertura
  label: string
  description: string
  count: number
  percentual: number
  tone: 'green' | 'amber' | 'red' | 'gray'
}

export type ExpectativaVisitasPanelModel = {
  municipios: ExpectativaVisitasMunicipio[]
  totalExpectativa: number
  faixaCounts: Record<FaixaCobertura, number>
  coberturaTerritorial: CoberturaTerritorialFaixa[]
}

/** Expectativa ≤ este valor → faixa Baixa densidade. */
const BAIXA_DENSIDADE_LIMIAR = 400
const COBERTURA_BOA_LIMIAR = 55

function mediana(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function medianaRobustaExpectativa(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const p90Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))
  return mediana(sorted.slice(0, p90Index + 1))
}

function buildMetaVisitasRatio(municipios: Array<{ expectativa: number; visitas: number }>): number {
  const ratios = municipios
    .filter((m) => m.expectativa > 0 && m.visitas > 0)
    .map((m) => m.visitas / (m.expectativa / 1000))
  if (ratios.length === 0) return 0.85
  return Math.max(0.35, mediana(ratios))
}

export function calcCoberturaVisitasPct(
  expectativa: number,
  visitas: number,
  metaPorMilVotos: number
): number {
  if (expectativa <= 0) return 0
  const meta = Math.max(1, (expectativa / 1000) * metaPorMilVotos)
  return Math.min(130, Math.round((visitas / meta) * 100))
}

/**
 * Classificação exclusiva:
 * - Baixa densidade: expectativa ≤ 400 votos
 * - Sem cobertura: expectativa > 400 e zero visitas
 * - Bem cobertas: alta expectativa (≥ mediana) e cobertura ≥ 55%
 * - Atenção: demais municípios visitados com cobertura insuficiente
 */
function classificarFaixa(
  expectativa: number,
  visitas: number,
  coberturaPct: number,
  medianaExpectativa: number
): FaixaCobertura {
  if (expectativa <= BAIXA_DENSIDADE_LIMIAR) return 'baixa-densidade'

  if (visitas === 0) return 'sem-cobertura'

  const altaExpectativa = expectativa >= medianaExpectativa
  if (altaExpectativa && coberturaPct >= COBERTURA_BOA_LIMIAR) return 'bem-cobertas'

  return 'atencao'
}

export function buildExpectativaVisitasPanelModel(
  lista: PrioridadeCampoMapaRow[]
): ExpectativaVisitasPanelModel {
  const base = lista
    .filter((row) => row.expectativaVotos > 0 && !row.semExpectativa)
    .map((row) => ({
      cidade: row.cidade,
      expectativa: row.expectativaVotos,
      visitas: row.visitas,
    }))

  const medianaExpectativa = medianaRobustaExpectativa(base.map((m) => m.expectativa))
  const metaPorMil = buildMetaVisitasRatio(base)
  const totalExpectativa = base.reduce((sum, m) => sum + m.expectativa, 0)

  const municipios: ExpectativaVisitasMunicipio[] = base
    .map((m) => {
      const coberturaPct = calcCoberturaVisitasPct(m.expectativa, m.visitas, metaPorMil)
      const faixa = classificarFaixa(m.expectativa, m.visitas, coberturaPct, medianaExpectativa)
      return {
        ...m,
        pctPesoExpectativa: calcPesoExpectativaPct(m.expectativa, totalExpectativa),
        coberturaPct,
        faixa,
        gapScore: m.expectativa * (100 - coberturaPct),
      }
    })
    .sort((a, b) => b.expectativa - a.expectativa)

  const total = municipios.length
  const semCoberturaLista = municipios.filter((m) => m.faixa === 'sem-cobertura')

  const faixaCounts: Record<FaixaCobertura, number> = {
    'sem-cobertura': semCoberturaLista.length,
    atencao: municipios.filter((m) => m.faixa === 'atencao').length,
    'bem-cobertas': municipios.filter((m) => m.faixa === 'bem-cobertas').length,
    'baixa-densidade': municipios.filter((m) => m.faixa === 'baixa-densidade').length,
  }

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  const coberturaTerritorial: CoberturaTerritorialFaixa[] = [
    {
      id: 'bem-cobertas',
      label: 'Bem cobertas',
      description: 'Alta expectativa e boa cobertura (≥55%)',
      count: faixaCounts['bem-cobertas'],
      percentual: pct(faixaCounts['bem-cobertas']),
      tone: 'green',
    },
    {
      id: 'atencao',
      label: 'Atenção',
      description: 'Potencial significativo, visitado, cobertura baixa',
      count: faixaCounts.atencao,
      percentual: pct(faixaCounts.atencao),
      tone: 'amber',
    },
    {
      id: 'sem-cobertura',
      label: 'Sem cobertura',
      description: 'Alto potencial e nenhuma visita registrada',
      count: faixaCounts['sem-cobertura'],
      percentual: pct(faixaCounts['sem-cobertura']),
      tone: 'red',
    },
    {
      id: 'baixa-densidade',
      label: 'Baixa densidade',
      description: 'Expectativa ≤ 400 votos',
      count: faixaCounts['baixa-densidade'],
      percentual: pct(faixaCounts['baixa-densidade']),
      tone: 'gray',
    },
  ]

  return {
    municipios,
    totalExpectativa,
    faixaCounts,
    coberturaTerritorial,
  }
}

export function calcPesoExpectativaPct(expectativa: number, totalExpectativa: number): number {
  if (totalExpectativa <= 0) return 0
  return Math.round((expectativa / totalExpectativa) * 1000) / 10
}

export function formatPesoExpectativaPct(value: number): string {
  const rounded = Math.round(value * 10) / 10
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function formatExpectativaCompact(value: number): string {
  if (value >= 1000) return value.toLocaleString('pt-BR')
  return String(Math.round(value))
}

export const FAIXA_COBERTURA_STYLES: Record<
  FaixaCobertura,
  { label: string; badge: string; bar: string }
> = {
  'sem-cobertura': {
    label: 'Sem cobertura',
    badge: 'bg-red-100 text-red-800',
    bar: 'bg-red-500',
  },
  atencao: {
    label: 'Atenção',
    badge: 'bg-amber-100 text-amber-900',
    bar: 'bg-amber-500',
  },
  'bem-cobertas': {
    label: 'Bem coberta',
    badge: 'bg-emerald-100 text-emerald-800',
    bar: 'bg-emerald-500',
  },
  'baixa-densidade': {
    label: 'Baixa densidade',
    badge: 'bg-gray-100 text-gray-700',
    bar: 'bg-gray-400',
  },
}

/** Faixas exibidas nos chips de filtro (ordem de prioridade). */
export const FAIXAS_FILTRO: FaixaCobertura[] = [
  'sem-cobertura',
  'atencao',
  'bem-cobertas',
  'baixa-densidade',
]
