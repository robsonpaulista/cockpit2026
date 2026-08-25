import { normalizeInstagramUsername } from '@/lib/instagram-radar-username'

const NAME_PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du'])
const MIN_HANDLE_LENGTH = 5

export type MetaAdsActorMatchInput = {
  name: string
  instagram_username?: string | null
  instagramUsername?: string | null
}

export type MetaAdsCreativeMatchInput = {
  page_name?: string | null
  payer_name?: string | null
  ad_body?: string | null
  pageName?: string | null
  payerName?: string | null
  adBody?: string | null
}

export function foldMetaAdsMatchText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/@/g, ' ')
    .replace(/[^a-z0-9._\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsFoldedPhrase(haystack: string, phrase: string): boolean {
  if (!phrase || !haystack) return false
  return ` ${haystack} `.includes(` ${phrase} `)
}

function containsHandle(haystack: string, handle: string): boolean {
  if (!handle || handle.length < MIN_HANDLE_LENGTH || !haystack) return false
  return new RegExp(`(^|[^a-z0-9._])${escapeRegExp(handle)}([^a-z0-9._]|$)`).test(haystack)
}

function nameTokens(name: string): string[] {
  return foldMetaAdsMatchText(name)
    .split(' ')
    .filter((token) => token.length >= 2 && !NAME_PARTICLES.has(token))
}

function adField(
  ad: MetaAdsCreativeMatchInput,
  snake: 'page_name' | 'payer_name' | 'ad_body',
  camel: 'pageName' | 'payerName' | 'adBody',
): string | null {
  return ad[snake] ?? ad[camel] ?? null
}

function haystackFromAd(ad: MetaAdsCreativeMatchInput): string {
  return foldMetaAdsMatchText(
    [
      adField(ad, 'page_name', 'pageName'),
      adField(ad, 'payer_name', 'payerName'),
      adField(ad, 'ad_body', 'adBody'),
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function pagePayerHaystack(ad: MetaAdsCreativeMatchInput): string {
  return foldMetaAdsMatchText(
    [adField(ad, 'page_name', 'pageName'), adField(ad, 'payer_name', 'payerName')]
      .filter(Boolean)
      .join(' '),
  )
}

function actorHandle(actor: MetaAdsActorMatchInput): string | null {
  return normalizeInstagramUsername(actor.instagram_username ?? actor.instagramUsername)
}

/**
 * Anúncio só entra no candidato se o criativo for dele (página/pagador/nome completo/@).
 * Evita falso positivo de busca unordered — ex.: "Pessoa" em qualquer texto.
 */
export function adBelongsToPoliticalActor(
  ad: MetaAdsCreativeMatchInput,
  actor: MetaAdsActorMatchInput,
): boolean {
  const fullName = foldMetaAdsMatchText(actor.name)
  if (!fullName) return false

  const haystack = haystackFromAd(ad)
  if (containsFoldedPhrase(haystack, fullName)) return true

  const handle = actorHandle(actor)
  if (handle && containsHandle(haystack, handle)) return true

  const tokens = nameTokens(actor.name)
  const page = pagePayerHaystack(ad)
  if (tokens.length < 2) {
    return tokens.length === 1 && containsFoldedPhrase(page, tokens[0] ?? '')
  }

  return tokens.every((token) => containsFoldedPhrase(page, token))
}

export function filterAdsBelongingToActor<T extends MetaAdsCreativeMatchInput>(
  ads: T[],
  actor: MetaAdsActorMatchInput,
): T[] {
  return ads.filter((ad) => adBelongsToPoliticalActor(ad, actor))
}
