const NAME_PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du'])
const MIN_HANDLE_LENGTH = 5

export function foldMetaAdsMatchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/@/g, ' ')
    .replace(/[^a-z0-9._\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsFoldedPhrase(haystack, phrase) {
  if (!phrase || !haystack) return false
  return ` ${haystack} `.includes(` ${phrase} `)
}

function containsHandle(haystack, handle) {
  if (!handle || handle.length < MIN_HANDLE_LENGTH || !haystack) return false
  return new RegExp(`(^|[^a-z0-9._])${escapeRegExp(handle)}([^a-z0-9._]|$)`).test(haystack)
}

export function normalizeInstagramUsername(raw) {
  if (!raw || !String(raw).trim()) return null
  let h = String(raw).trim()
  if (h.startsWith('@')) h = h.slice(1)
  if (h.includes('instagram.com/')) {
    try {
      const url = h.startsWith('http') ? h : `https://${h}`
      const path = new URL(url).pathname.replace(/^\/+|\/+$/g, '')
      h = path.split('/')[0] ?? h
    } catch {
      /* keep */
    }
  }
  h = (h.split('?')[0]?.split('/')[0] ?? h).toLowerCase().replace(/[^a-z0-9._]/g, '')
  return h.length >= 1 ? h : null
}

function nameTokens(name) {
  return foldMetaAdsMatchText(name)
    .split(' ')
    .filter((token) => token.length >= 2 && !NAME_PARTICLES.has(token))
}

function adField(ad, snake, camel) {
  return ad?.[snake] ?? ad?.[camel] ?? null
}

function haystackFromAd(ad) {
  return foldMetaAdsMatchText(
    [adField(ad, 'page_name', 'pageName'), adField(ad, 'payer_name', 'payerName'), adField(ad, 'ad_body', 'adBody')]
      .filter(Boolean)
      .join(' ')
  )
}

function pagePayerHaystack(ad) {
  return foldMetaAdsMatchText(
    [adField(ad, 'page_name', 'pageName'), adField(ad, 'payer_name', 'payerName')].filter(Boolean).join(' ')
  )
}

export function actorInstagramHandle(actor) {
  return normalizeInstagramUsername(actor?.instagramUsername ?? actor?.instagram_username)
}

export function adBelongsToPoliticalActor(ad, actor) {
  const fullName = foldMetaAdsMatchText(actor?.name)
  if (!fullName) return false

  const haystack = haystackFromAd(ad)
  if (containsFoldedPhrase(haystack, fullName)) return true

  const handle = actorInstagramHandle(actor)
  if (handle && containsHandle(haystack, handle)) return true

  const tokens = nameTokens(actor.name)
  const page = pagePayerHaystack(ad)
  if (tokens.length < 2) {
    return tokens.length === 1 && containsFoldedPhrase(page, tokens[0] ?? '')
  }

  return tokens.every((token) => containsFoldedPhrase(page, token))
}

export function filterAdsBelongingToActor(ads, actor) {
  return ads.filter((ad) => adBelongsToPoliticalActor(ad, actor))
}
