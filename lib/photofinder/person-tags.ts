export const PHOTOFINDER_PERSON_TAG_SEPARATOR = ' · '

const DOT_SEPARATORS = /[\u00b7\u2022\u2219\u30fb•·]/g
const FALLBACK_SEPARATORS = /\s*(?:[\u00b7\u2022\u2219\u30fb•·]|[;,|/])\s*/g

/** Normaliza qualquer variante de separador para o formato canônico. */
export function normalizePersonTagValue(value: string): string {
  return value
    .trim()
    .replace(FALLBACK_SEPARATORS, PHOTOFINDER_PERSON_TAG_SEPARATOR)
    .replace(new RegExp(`${PHOTOFINDER_PERSON_TAG_SEPARATOR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}+`, 'g'), PHOTOFINDER_PERSON_TAG_SEPARATOR)
    .trim()
}

export function joinPersonTags(names: string[]): string {
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .join(PHOTOFINDER_PERSON_TAG_SEPARATOR)
}

export function splitPersonTags(value: string | null | undefined): string[] {
  if (!value?.trim()) return []

  const normalized = normalizePersonTagValue(value)
  const names = normalized
    .split(PHOTOFINDER_PERSON_TAG_SEPARATOR)
    .map((name) => name.trim())
    .filter(Boolean)

  if (names.length > 1) return names

  // Fallback: separador exótico no valor bruto
  if (DOT_SEPARATORS.test(value)) {
    return value
      .trim()
      .split(FALLBACK_SEPARATORS)
      .map((name) => name.trim())
      .filter(Boolean)
  }

  return names
}

export function formatPersonTagsSummary(value: string | null | undefined): string {
  const names = splitPersonTags(value)
  if (names.length === 0) return ''
  return joinPersonTags(names)
}

export function hasMultiplePersonTags(value: string | null | undefined): boolean {
  return splitPersonTags(value).length > 1
}
