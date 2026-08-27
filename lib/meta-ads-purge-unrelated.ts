import type { SupabaseClient } from '@supabase/supabase-js'
import { adBelongsToPoliticalActor } from '@/lib/meta-ads-actor-match'

type MentionPurgeRow = {
  id: string
  page_name: string | null
  payer_name: string | null
  ad_body: string | null
  political_actors: {
    name: string
    instagram_username?: string | null
  } | null
}

const DELETE_CHUNK = 100

/**
 * Remove menções Meta Ads que não pertencem ao candidato (falso positivo da busca).
 */
export async function purgeUnrelatedMetaAdsMentions(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('meta_ads_mentions')
    .select(
      'id, page_name, payer_name, ad_body, political_actors!inner ( name, instagram_username )',
    )

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') return 0
    throw new Error(error.message)
  }

  type QueryRow = {
    id: string
    page_name: string | null
    payer_name: string | null
    ad_body: string | null
    political_actors:
      | MentionPurgeRow['political_actors']
      | NonNullable<MentionPurgeRow['political_actors']>[]
      | null
  }

  const unrelatedIds = ((data ?? []) as unknown as QueryRow[])
    .filter((row) => {
      const raw = row.political_actors
      const actor = Array.isArray(raw) ? (raw[0] ?? null) : raw
      if (!actor) return true
      return !adBelongsToPoliticalActor(
        {
          page_name: row.page_name,
          payer_name: row.payer_name,
          ad_body: row.ad_body,
        },
        {
          name: actor.name,
          instagram_username: actor.instagram_username,
        },
      )
    })
    .map((row) => row.id)

  for (let i = 0; i < unrelatedIds.length; i += DELETE_CHUNK) {
    const chunk = unrelatedIds.slice(i, i + DELETE_CHUNK)
    const { error: delError } = await supabase.from('meta_ads_mentions').delete().in('id', chunk)
    if (delError) throw new Error(delError.message)
  }

  return unrelatedIds.length
}
