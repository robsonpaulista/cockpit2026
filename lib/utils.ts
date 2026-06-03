import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('pt-BR').format(num)
}

export function formatPercent(num: number): string {
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`
}

/** Interpreta YYYY-MM-DD no fuso local (evita voltar um dia/mês em UTC−3). */
export function parseDateOnlyLocal(date: Date | string): Date | null {
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date
  }
  const trimmed = String(date).trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateOrFallback(
  date: Date | string,
  options: Intl.DateTimeFormatOptions,
  fallback = '—'
): string {
  const dateObj = parseDateOnlyLocal(date)
  if (!dateObj) return fallback
  return new Intl.DateTimeFormat('pt-BR', options).format(dateObj)
}

/** Chave ano-mês (0-index) para agrupamento — ex.: 2026-5 = jun/2026. */
export function monthBucketKey(date: Date | string): string {
  const d = parseDateOnlyLocal(date)
  if (!d) return 'invalid'
  return `${d.getFullYear()}-${d.getMonth()}`
}

export function formatDate(date: Date | string): string {
  return formatDateOrFallback(date, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateShort(date: Date | string): string {
  return formatDateOrFallback(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

