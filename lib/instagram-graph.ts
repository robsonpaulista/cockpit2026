export const GRAPH_VERSION = 'v18.0'
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export type ResolvedInstagramBusiness = {
  instagramBusinessId: string
  ownerUsername: string
  profilePictureUrl: string | null
}

/**
 * Resolve o ID da conta Instagram Business a partir do ID da Página do Facebook
 * (mesmo fluxo de /api/instagram).
 */
export async function resolveInstagramBusinessAccount(
  pageOrBusinessAccountId: string,
  accessToken: string
): Promise<ResolvedInstagramBusiness> {
  const res = await fetch(
    `${GRAPH_BASE}/${pageOrBusinessAccountId}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(accessToken)}`
  )
  const json = (await res.json()) as {
    instagram_business_account?: {
      id?: string
      username?: string
      profile_picture_url?: string
    }
    error?: { message?: string }
  }
  if (!res.ok) {
    throw new Error(json.error?.message || 'Erro ao resolver conta Instagram')
  }
  const ig = json.instagram_business_account
  if (!ig?.id) {
    throw new Error('Esta página não tem uma conta de Instagram Business associada')
  }
  return {
    instagramBusinessId: ig.id,
    ownerUsername: ig.username || '',
    profilePictureUrl: ig.profile_picture_url?.trim() || null,
  }
}
