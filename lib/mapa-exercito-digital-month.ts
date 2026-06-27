/** Utilitários de mês calendário para o placar Eng. líderes (YYYY-MM). */

export type MonthRef = { year: number; month: number }

const fmtMonthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short' })

export function getCurrentReferenceMonth(now = new Date()): string {
  return formatReferenceMonth(now.getFullYear(), now.getMonth())
}

export function formatReferenceMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export function parseReferenceMonth(value: string): MonthRef {
  const [y, m] = value.split('-').map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  }
  return { year: y, month: m - 1 }
}

export function addMonths(ref: MonthRef, delta: number): MonthRef {
  const d = new Date(ref.year, ref.month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function startOfMonthMs(ref: MonthRef): number {
  return new Date(ref.year, ref.month, 1, 0, 0, 0, 0).getTime()
}

export function endOfMonthMs(ref: MonthRef): number {
  return new Date(ref.year, ref.month + 1, 0, 23, 59, 59, 999).getTime()
}

export function formatMonthLabel(ref: MonthRef): string {
  const label = fmtMonthShort.format(new Date(ref.year, ref.month, 1))
  const yearSuffix = String(ref.year).slice(-2)
  return `${label.replace('.', '')}/${yearSuffix}`
}

export function formatMonthLabelLong(ref: MonthRef): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(ref.year, ref.month, 1)
  )
}

/** Janela de `count` meses terminando em `referenceMonth` (índice final = mês de referência). */
export function getMonthWindow(referenceMonth: string, count = 5): Array<MonthRef & { label: string }> {
  const end = parseReferenceMonth(referenceMonth)
  const items: Array<MonthRef & { label: string }> = []
  for (let i = count - 1; i >= 0; i--) {
    const ref = addMonths(end, -i)
    items.push({ ...ref, label: formatMonthLabel(ref) })
  }
  return items
}

/** Opções para seletor: mês atual + 11 anteriores. */
export function getReferenceMonthOptions(count = 12, now = new Date()): Array<{ value: string; label: string }> {
  const start = { year: now.getFullYear(), month: now.getMonth() }
  const options: Array<{ value: string; label: string }> = []
  for (let i = 0; i < count; i++) {
    const ref = addMonths(start, -i)
    const value = formatReferenceMonth(ref.year, ref.month)
    options.push({ value, label: formatMonthLabelLong(ref) })
  }
  return options
}

export function isTimestampInMonth(ts: number, ref: MonthRef): boolean {
  if (ts <= 0) return false
  return ts >= startOfMonthMs(ref) && ts <= endOfMonthMs(ref)
}

/** Rótulos dos 4 meses anteriores ao de referência (heatmap). */
export function getHeatmapMonthLabels(referenceMonth: string): string[] {
  return getMonthWindow(referenceMonth, 5)
    .slice(0, 4)
    .map((m) => m.label)
}
