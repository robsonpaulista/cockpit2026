import { isNaoSabeOuNaoOpinaNome } from '@/lib/espontanea-normalize'

const GRAY_RAMP = ['#888780', '#A8A29E', '#78716C', '#6B7280'] as const

function normName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const SEMANTIC_COLOR_RULES: ReadonlyArray<{ test: (normalized: string) => boolean; color: string }> = [
  { test: (n) => /georgiano/.test(n), color: '#1D9E75' },
  { test: (n) => /warton|lacerda/.test(n), color: '#BA7517' },
  { test: (n) => /flavio/.test(n) && /nogueira/.test(n), color: '#D85A30' },
  { test: (n) => (/ze/.test(n) || /\bjose\b/.test(n)) && /santana/.test(n), color: '#7F77DD' },
  { test: (n) => /castro/.test(n) && /neto/.test(n), color: '#888780' },
  { test: (n) => /daniel/.test(n) && /marinha/.test(n), color: '#B4B2A9' },
]

export type TendenciaDatasetStyle = {
  borderWidth: number
  pointRadius: number
  borderDash?: number[]
  order: number
}

export function parseSerieValue(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const normalized =
      trimmed.includes(',') && trimmed.includes('.')
        ? trimmed.replace(/\./g, '').replace(',', '.')
        : trimmed.includes(',')
          ? trimmed.replace(',', '.')
          : trimmed
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function serieKeyForCandidate(nome: string): string {
  return `intencao_${nome.replace(/\s+/g, '_')}`
}

export function lastSerieValue(
  data: ReadonlyArray<Record<string, string | number | undefined>>,
  nome: string
): number | null {
  const key = serieKeyForCandidate(nome)
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const value = parseSerieValue(data[i][key])
    if (value !== null) return value
  }
  return null
}

export function firstSerieValue(
  data: ReadonlyArray<Record<string, string | number | undefined>>,
  nome: string
): number | null {
  const key = serieKeyForCandidate(nome)
  for (let i = 0; i < data.length; i += 1) {
    const value = parseSerieValue(data[i][key])
    if (value !== null) return value
  }
  return null
}

export function getCandidateLineColor(
  nome: string,
  candidatoPadrao: string,
  usedColors: Set<string>
): string {
  if (isNaoSabeOuNaoOpinaNome(nome)) return '#B4B2A9'
  if (nome === candidatoPadrao || normName(nome) === normName(candidatoPadrao)) {
    return '#185FA5'
  }

  const normalized = normName(nome)
  for (const rule of SEMANTIC_COLOR_RULES) {
    if (rule.test(normalized) && !usedColors.has(rule.color)) {
      usedColors.add(rule.color)
      return rule.color
    }
  }

  for (const gray of GRAY_RAMP) {
    if (!usedColors.has(gray)) {
      usedColors.add(gray)
      return gray
    }
  }

  return '#888780'
}

export function getTopActiveCandidates(
  candidatos: readonly string[],
  data: ReadonlyArray<Record<string, string | number | undefined>>,
  limit = 5
): Set<string> {
  const ranked = candidatos
    .filter((nome) => !isNaoSabeOuNaoOpinaNome(nome))
    .map((nome) => ({ nome, value: lastSerieValue(data, nome) ?? -1 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((item) => item.nome)

  return new Set(ranked)
}

export function getDatasetStyle(
  nome: string,
  candidatoPadrao: string,
  latestValue: number | null,
  topActiveCandidates: Set<string>
): TendenciaDatasetStyle {
  if (isNaoSabeOuNaoOpinaNome(nome)) {
    return { borderWidth: 1.5, pointRadius: 3, borderDash: [4, 4], order: 1000 }
  }

  if (nome === candidatoPadrao) {
    return { borderWidth: 2.5, pointRadius: 5, order: 0 }
  }

  if (latestValue !== null && latestValue < 5) {
    return { borderWidth: 1, pointRadius: 3, order: 12 }
  }

  if (topActiveCandidates.has(nome)) {
    return { borderWidth: 2, pointRadius: 4, order: 4 }
  }

  return { borderWidth: 1, pointRadius: 3, order: 12 }
}

export function formatChartDateLabel(dataLabel: string): string {
  const parts = dataLabel.split('/')
  if (parts.length !== 3) return dataLabel

  const day = parts[0].padStart(2, '0')
  const monthIndex = Number(parts[1]) - 1
  const monthLabels = [
    'jan.',
    'fev.',
    'mar.',
    'abr.',
    'mai.',
    'jun.',
    'jul.',
    'ago.',
    'set.',
    'out.',
    'nov.',
    'dez.',
  ]

  const month = monthLabels[monthIndex] ?? parts[1]
  return `${day} ${month}`
}

/** Institutos distintos registrados na mesma data (campos instituto_* da linha). */
export function extractInstitutosFromRow(
  row: Readonly<Record<string, string | number | undefined>>
): string[] {
  const institutos = new Set<string>()
  for (const key of Object.keys(row)) {
    if (!key.startsWith('instituto_')) continue
    const value = row[key]
    if (value == null) continue
    const trimmed = String(value).trim()
    if (trimmed) institutos.add(trimmed)
  }
  return [...institutos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Rótulo do eixo X: data curta + instituto(s) na linha seguinte. */
export function formatChartAxisLabel(
  dataLabel: string,
  row: Readonly<Record<string, string | number | undefined>>
): string {
  const datePart = formatChartDateLabel(dataLabel)
  const institutos = extractInstitutosFromRow(row)
  if (institutos.length === 0) return datePart
  const instPart = institutos.length === 1 ? institutos[0] : institutos.join(', ')
  return `${datePart}\n${instPart}`
}

export function computeYAxisMax(values: readonly number[]): number {
  if (values.length === 0) return 65
  const maxValue = Math.max(...values)
  const dynamicMax = Math.ceil((maxValue + 10) / 5) * 5
  return dynamicMax > 65 ? dynamicMax : 65
}

export function fmtPctPtBR(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

export function formatDeltaLegendText(
  firstValue: number | null,
  lastValue: number | null,
  singleReading: boolean
): { text: string; tone: 'up' | 'down' | 'stable' | 'single' } {
  if (firstValue === null || lastValue === null || singleReading) {
    return { text: 'Única leitura', tone: 'single' }
  }

  const delta = lastValue - firstValue
  const abs = Math.abs(delta).toFixed(1).replace('.', ',')

  if (Math.abs(delta) < 0.05) {
    return { text: 'Estável 0,0 p.p.', tone: 'stable' }
  }

  if (delta > 0) {
    return {
      text: `${fmtPctPtBR(firstValue)}% → ${fmtPctPtBR(lastValue)}% · Alta +${abs} p.p.`,
      tone: 'up',
    }
  }

  return {
    text: `${fmtPctPtBR(firstValue)}% → ${fmtPctPtBR(lastValue)}% · Queda -${abs} p.p.`,
    tone: 'down',
  }
}

export function isNsoCandidate(nome: string): boolean {
  return isNaoSabeOuNaoOpinaNome(nome)
}

export function legendDisplayName(nome: string): string {
  return isNaoSabeOuNaoOpinaNome(nome) ? 'Referência — indecisão' : nome
}
