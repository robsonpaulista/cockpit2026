export type RequestGeo = {
  city: string | null
  region: string | null
  country: string | null
}

function decodeHeaderValue(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed === 'unknown') return null
  try {
    return decodeURIComponent(trimmed.replace(/\+/g, ' '))
  } catch {
    return trimmed
  }
}

/** Cidade/UF/país pelos headers da Vercel (aproximado pelo IP). */
export function geoFromRequest(request: Request): RequestGeo {
  return {
    city: decodeHeaderValue(request.headers.get('x-vercel-ip-city')),
    region: decodeHeaderValue(request.headers.get('x-vercel-ip-country-region')),
    country: decodeHeaderValue(request.headers.get('x-vercel-ip-country')),
  }
}

export function parseDeviceLabel(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? '').trim()
  if (!ua) return 'Desconhecido'

  let os = 'Outro'
  if (/iPhone|iPad|iPod/i.test(ua)) os = /iPad/i.test(ua) ? 'iPad' : 'iPhone'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Windows NT/i.test(ua)) os = 'Windows'
  else if (/Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Linux/i.test(ua)) os = 'Linux'

  let browser = 'Navegador'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera'
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome'
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'

  const kind = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'celular' : 'computador'
  return `${browser} · ${os} · ${kind}`
}

export function decodeJwtSessionId(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null
  const parts = accessToken.split('.')
  if (parts.length < 2) return null
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(json) as { session_id?: unknown }
    return typeof payload.session_id === 'string' && payload.session_id.length > 0
      ? payload.session_id
      : null
  } catch {
    return null
  }
}

export function formatLocation(opts: {
  city?: string | null
  region?: string | null
  country?: string | null
}): string {
  const city = opts.city?.trim() || ''
  const region = opts.region?.trim() || ''
  const country = opts.country?.trim() || ''
  const parts = [city, region, country].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Local não informado'
}
