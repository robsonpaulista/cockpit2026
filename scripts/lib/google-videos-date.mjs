/** Parse de datas do Google Vídeos — espelho de lib/google-videos-date.ts para scripts Node. */

export function isVideoDateSegment(raw) {
  const t = raw.trim()
  if (t.length < 2 || t.length > 48) return false
  if (/^(Instagram|Facebook|YouTube|TikTok|Twitter)$/i.test(t)) return false
  if (t.split(/\s+/).length > 7) return false
  if (/^(hoje|ontem)\s+\w{4,}/i.test(t)) return false

  return (
    /atrás|ago|\bhá\s+\d/i.test(t) ||
    /^(hoje|ontem|yesterday|today)$/i.test(t) ||
    /^\d+\s+(hora|horas|dia|dias|semana|semanas|mês|meses|ano|anos)/i.test(t) ||
    /^\d{1,2}\s+de\s+[a-zçãéíóú]/i.test(t) ||
    /^\d+\s+(week|weeks|day|days|hour|hours|month|months|year|years)/i.test(t)
  )
}

export function extractVideoDateHint(text) {
  if (!text?.trim()) return null

  const meta = text.match(
    /(?:Instagram|Facebook|YouTube|TikTok|Twitter)\s*·\s*[^·]+?\s*·\s*([^·]{2,40})/i
  )
  if (meta?.[1] && isVideoDateSegment(meta[1])) return meta[1].trim()

  for (const seg of text.split('·')) {
    const s = seg.trim()
    if (isVideoDateSegment(s)) return s
  }

  const patterns = [
    /\d+\s+(?:minuto|minutos|hora|horas|dia|dias|semana|semanas|mês|meses|ano|anos)\s+atrás/i,
    /\d{1,2}\s+de\s+[\wçãéíóú.]+\s+de\s+\d{4}/i,
    /\bhá\s+\d+\s+(?:minuto|minutos|hora|horas|dia|dias|semana|semanas)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[0] && isVideoDateSegment(match[0])) return match[0].trim()
  }

  return null
}

function parsePtMonth(monthStr) {
  const key = monthStr.toLowerCase().replace(/\./g, '').slice(0, 3)
  const map = {
    jan: 0,
    fev: 1,
    feb: 1,
    mar: 2,
    abr: 3,
    apr: 3,
    mai: 4,
    may: 4,
    jun: 5,
    jul: 6,
    ago: 7,
    aug: 7,
    set: 8,
    sep: 8,
    out: 9,
    oct: 9,
    nov: 10,
    dez: 11,
    dec: 11,
  }
  return map[key] ?? null
}

export function parseGoogleVideosDateHint(raw) {
  if (!raw?.trim() || !isVideoDateSegment(raw)) return null
  const text = raw.trim().toLowerCase()
  const now = Date.now()

  const absolute = text.match(/(\d{1,2})\s+de\s+(\w+\.?)\s+de\s+(\d{4})/i)
  if (absolute) {
    const month = parsePtMonth(absolute[2])
    if (month !== null) {
      const day = Number(absolute[1])
      const year = Number(absolute[3])
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0))
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
  }

  const rel = text.match(
    /(?:há\s+)?(\d+)\s*(hora|horas|dia|dias|semana|semanas|mês|meses|ano|anos)\s*(?:atrás)?/i
  )
  if (rel) {
    const n = Number(rel[1])
    const unit = rel[2]
    let ms = 0
    if (/hora/i.test(unit)) ms = n * 3_600_000
    else if (/dia/i.test(unit)) ms = n * 86_400_000
    else if (/semana/i.test(unit)) ms = n * 7 * 86_400_000
    else if (/mês|mes/i.test(unit)) ms = n * 30 * 86_400_000
    else if (/ano/i.test(unit)) ms = n * 365 * 86_400_000
    if (ms > 0) return new Date(now - ms).toISOString()
  }

  const enAgo = text.match(
    /(\d+)\s*(second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago/i
  )
  if (enAgo) {
    const n = Number(enAgo[1])
    const unit = enAgo[2]
    let ms = 0
    if (/second/i.test(unit)) ms = n * 1000
    else if (/minute/i.test(unit)) ms = n * 60_000
    else if (/hour/i.test(unit)) ms = n * 3_600_000
    else if (/day/i.test(unit)) ms = n * 86_400_000
    else if (/week/i.test(unit)) ms = n * 7 * 86_400_000
    else if (/month/i.test(unit)) ms = n * 30 * 86_400_000
    else if (/year/i.test(unit)) ms = n * 365 * 86_400_000
    if (ms > 0) return new Date(now - ms).toISOString()
  }

  if (/^(ontem|yesterday)$/i.test(text)) return new Date(now - 86_400_000).toISOString()
  if (/^(hoje|today)$/i.test(text)) return new Date(now).toISOString()

  return null
}

export function parseMetadataRow(blockText) {
  if (!blockText?.trim()) return { author: null, dateHint: null, platform: null }
  const m = blockText.match(
    /(Instagram|Facebook|YouTube|TikTok|Twitter)\s*·\s*([^·]+?)\s*·\s*([^·]{2,40})/i
  )
  if (!m) return { author: null, dateHint: extractVideoDateHint(blockText), platform: null }
  let author = m[2].trim()
  const dateHint = isVideoDateSegment(m[3]) ? m[3].trim() : null
  const platform = m[1].trim()
  if (author.toLowerCase() === platform.toLowerCase()) author = null
  return { author, dateHint, platform }
}
