/** Gera slug URL-safe a partir do nome do candidato. */
export function slugFromPoliticalName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function parseTermsInput(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  return [...new Set(parts)]
}
