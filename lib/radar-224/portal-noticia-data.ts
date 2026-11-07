/**
 * Interpreta datas de listagens regionais e filtra janela recente (30 dias).
 */

export const PORTAL_NOTICIAS_JANELA_DIAS = 30
const MS_DIA = 24 * 60 * 60 * 1000

const MESES_PT: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  março: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Converte label relativo ("Há 2 dias") em timestamp aproximado. */
export function parsePublishedLabelRelativo(
  label: string | null | undefined,
  agora = Date.now(),
): number | null {
  if (!label) return null
  const t = normalize(label)
  const m = t.match(
    /^ha\s+(\d+)\s*(hora|horas|minuto|minutos|dia|dias|semana|semanas|mes|meses|ano|anos)\b/,
  )
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 0) return null
  const unidade = m[2]
  let ms = 0
  if (unidade.startsWith('minuto')) ms = n * 60_000
  else if (unidade.startsWith('hora')) ms = n * 3_600_000
  else if (unidade.startsWith('dia')) ms = n * MS_DIA
  else if (unidade.startsWith('semana')) ms = n * 7 * MS_DIA
  // “Há 1 mês” fica fora da janela de 30 dias (usa 31d por unidade).
  else if (unidade.startsWith('mes')) ms = n * 31 * MS_DIA
  else if (unidade.startsWith('ano')) ms = n * 365 * MS_DIA
  else return null
  return agora - ms
}

/** "31 de outubro de 2026" → timestamp. */
export function parsePublishedLabelAbsolutoPt(
  label: string | null | undefined,
): number | null {
  if (!label) return null
  const t = normalize(label)
  const m = t.match(/^(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})$/)
  if (!m) return null
  const dia = Number(m[1])
  const mes = MESES_PT[m[2]]
  const ano = Number(m[3])
  if (mes == null || !Number.isFinite(dia) || !Number.isFinite(ano)) return null
  const d = new Date(ano, mes, dia, 12, 0, 0, 0)
  const ts = d.getTime()
  return Number.isFinite(ts) ? ts : null
}

/** "05 / 11 / 2026" ou "05/11/2026" → timestamp. */
export function parsePublishedLabelSlash(
  label: string | null | undefined,
): number | null {
  if (!label) return null
  const m = label.trim().match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/)
  if (!m) return null
  const dia = Number(m[1])
  const mes = Number(m[2]) - 1
  const ano = Number(m[3])
  if (!Number.isFinite(dia) || mes < 0 || mes > 11 || !Number.isFinite(ano)) return null
  const d = new Date(ano, mes, dia, 12, 0, 0, 0)
  const ts = d.getTime()
  return Number.isFinite(ts) ? ts : null
}

/** Extrai data do path WordPress `/2026/10/slug/`. */
export function parsePublishedFromUrl(url: string | null | undefined): number | null {
  if (!url) return null
  const m = url.match(/\/(20\d{2})\/(0[1-9]|1[0-2])(?:\/(0[1-9]|[12]\d|3[01]))?\//)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2]) - 1
  const dia = m[3] ? Number(m[3]) : 15
  const d = new Date(ano, mes, dia, 12, 0, 0, 0)
  const ts = d.getTime()
  return Number.isFinite(ts) ? ts : null
}

export function resolvePublishedAtMs(opts: {
  publishedAt?: string | null
  publishedLabel?: string | null
  url?: string | null
  agora?: number
}): number | null {
  const agora = opts.agora ?? Date.now()
  if (opts.publishedAt) {
    const t = Date.parse(opts.publishedAt)
    if (Number.isFinite(t)) return t
  }
  const relativo = parsePublishedLabelRelativo(opts.publishedLabel, agora)
  if (relativo != null) return relativo
  const absoluto = parsePublishedLabelAbsolutoPt(opts.publishedLabel)
  if (absoluto != null) return absoluto
  const slash = parsePublishedLabelSlash(opts.publishedLabel)
  if (slash != null) return slash
  return parsePublishedFromUrl(opts.url)
}

export function publicadoNaJanelaPortal(
  publishedAtMs: number | null | undefined,
  opts?: { dias?: number; agora?: number },
): boolean {
  if (publishedAtMs == null || !Number.isFinite(publishedAtMs)) return false
  const agora = opts?.agora ?? Date.now()
  const dias = opts?.dias ?? PORTAL_NOTICIAS_JANELA_DIAS
  if (publishedAtMs > agora + MS_DIA) return false
  return publishedAtMs >= agora - dias * MS_DIA
}
