import type { SupabaseClient } from '@supabase/supabase-js'
import { isUnclassifiedEventType } from '@/lib/photofinder/event-query'
import { applyPhotofinderUserScope } from '@/lib/photofinder/user-scope'

/** Converte event_type só com espaços em NULL (alinha contagem e listagem). */
export async function normalizeWhitespaceEventTypes(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<number> {
  const { data, error } = await applyPhotofinderUserScope(
    supabase
      .from('photos')
      .select('id, event_type')
      .not('event_type', 'is', null)
      .neq('event_type', ''),
    userIds,
  )

  if (error) throw error

  const ids = (data ?? [])
    .filter((row) => isUnclassifiedEventType(row.event_type as string | null))
    .map((row) => row.id as string)

  if (ids.length === 0) return 0

  const { data: updated, error: updateError } = await applyPhotofinderUserScope(
    supabase.from('photos').update({ event_type: null }).in('id', ids).select('id'),
    userIds,
  )

  if (updateError) throw updateError
  return updated?.length ?? 0
}
