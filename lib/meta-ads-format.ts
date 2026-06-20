export function formatSpendBrl(min: number | null, max: number | null, fallbackText?: string | null): string {
  if (min !== null && max !== null) {
    if (min === max) return formatCurrencyBrl(min)
    return `${formatCurrencyBrl(min)} – ${formatCurrencyBrl(max)}`
  }
  if (min !== null) return formatCurrencyBrl(min)
  if (max !== null) return formatCurrencyBrl(max)
  return fallbackText?.trim() || '—'
}

export function formatCurrencyBrl(value: number): string {
  if (value >= 1_000_000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function normalizeMetricText(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

export function parseMetricCountToken(token: string | null | undefined): number | null {
  if (!token) return null
  let t = normalizeMetricText(token)
    .replace(/^R\$\s*/i, '')
    .replace(/^[<>≥≤]\s*/, '')
  const m = t.match(/^([\d.,]+)\s*(mil|mi|k|milhão|milhões)?$/i)
  if (!m) return null
  let n = Number(m[1].replace(/\./g, '').replace(',', '.'))
  if (Number.isNaN(n)) n = Number(m[1].replace(',', '.'))
  if (Number.isNaN(n)) return null
  const unit = (m[2] || '').toLowerCase()
  if (unit === 'mil' || unit === 'k') n *= 1_000
  if (unit === 'mi' || unit.startsWith('milh')) n *= 1_000_000
  return n
}

export function parseMetricRange(text: string | null | undefined): {
  min: number | null
  max: number | null
} {
  if (!text?.trim()) return { min: null, max: null }
  const normalized = normalizeMetricText(text)
  const rangeMatch = normalized.match(
    /([\d.,]+\s*(?:mil|mi|k|milhão|milhões)?)\s*(?:a|to|-)\s*([\d.,]+\s*(?:mil|mi|k|milhão|milhões)?)/i
  )
  if (rangeMatch) {
    return {
      min: parseMetricCountToken(rangeMatch[1]),
      max: parseMetricCountToken(rangeMatch[2]),
    }
  }
  const single = parseMetricCountToken(normalized)
  return { min: single, max: single }
}

export function formatCompactCount(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatMetricCount(min: number, max: number, fallbackText?: string | null): string {
  if (min > 0 || max > 0) {
    if (min === max) return formatCompactCount(min)
    return `${formatCompactCount(min)} – ${formatCompactCount(max)}`
  }
  return fallbackText?.trim() || '—'
}

export function sumSpendRange(ads: Array<{ spend_min_brl: number | null; spend_max_brl: number | null }>): {
  min: number
  max: number
} {
  let min = 0
  let max = 0
  let hasValue = false
  for (const ad of ads) {
    const lo = ad.spend_min_brl ?? ad.spend_max_brl
    const hi = ad.spend_max_brl ?? ad.spend_min_brl
    if (lo === null && hi === null) continue
    min += lo ?? hi ?? 0
    max += hi ?? lo ?? 0
    hasValue = true
  }
  return hasValue ? { min, max } : { min: 0, max: 0 }
}

export function sumMetricRange(
  ads: Array<{ impressions_text?: string | null; audience_size_text?: string | null }>,
  field: 'impressions_text' | 'audience_size_text'
): { min: number; max: number; hasValue: boolean } {
  let min = 0
  let max = 0
  let hasValue = false
  for (const ad of ads) {
    const parsed = parseMetricRange(ad[field])
    const lo = parsed.min ?? parsed.max
    const hi = parsed.max ?? parsed.min
    if (lo === null && hi === null) continue
    min += lo ?? hi ?? 0
    max += hi ?? lo ?? 0
    hasValue = true
  }
  return { min, max, hasValue }
}
