import type { SupabaseClient } from '@supabase/supabase-js'
import { applyRecognizeEventFolderFilter, type RecognizeEventFolderScope } from '@/lib/photofinder/recognize-event-scope'
import { applyPendingRecognitionFilter } from '@/lib/photofinder/recognize-pending-filter'
import { applyPhotofinderUserScope } from '@/lib/photofinder/user-scope'

const PHOTO_SELECT =
  'id, drive_id, mime_type, name, thumbnail_url, person_tag'

export function buildRecognizePhotoIdsCountQuery(
  supabase: SupabaseClient,
  userIds: string[],
  photoIds: string[],
  options: { pendingOnly?: boolean } = {},
) {
  let query = applyPhotofinderUserScope(
    supabase.from('photos').select('*', { count: 'exact', head: true }).in('id', photoIds),
    userIds,
  )

  if (options.pendingOnly) {
    query = applyPendingRecognitionFilter(query)
  }

  return query
}

export async function fetchRecognizePhotosByIds(
  supabase: SupabaseClient,
  userIds: string[],
  photoIds: string[],
): Promise<
  Array<{
    id: string
    drive_id: string
    mime_type: string
    name: string
    thumbnail_url: string | null
    person_tag: string | null
  }>
> {
  if (photoIds.length === 0) return []

  const { data, error } = await applyPhotofinderUserScope(
    supabase.from('photos').select(PHOTO_SELECT).in('id', photoIds),
    userIds,
  )
  if (error) throw error

  const byId = new Map((data ?? []).map((row) => [row.id, row]))
  return photoIds
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row != null)
}

export function buildRecognizeScopeCountQuery(
  supabase: SupabaseClient,
  userIds: string[],
  eventFolderIds?: RecognizeEventFolderScope,
  options: { pendingOnly?: boolean } = {},
) {
  let query = applyRecognizeEventFolderFilter(
    applyPhotofinderUserScope(
      supabase.from('photos').select('*', { count: 'exact', head: true }),
      userIds,
    ),
    eventFolderIds,
  )

  if (options.pendingOnly) {
    query = applyPendingRecognitionFilter(query)
  }

  return query
}

export function buildRecognizePhotosQuery(
  supabase: SupabaseClient,
  userIds: string[],
  eventFolderIds: RecognizeEventFolderScope | undefined,
  options: { overwrite?: boolean; afterPhotoId?: string },
) {
  let query = applyRecognizeEventFolderFilter(
    applyPhotofinderUserScope(supabase.from('photos').select(PHOTO_SELECT), userIds),
    eventFolderIds,
  )

  if (options.overwrite) {
    query = query.order('id', { ascending: true })
    if (options.afterPhotoId) {
      query = query.gt('id', options.afterPhotoId)
    }
    return query
  }

  return applyPendingRecognitionFilter(query).order('created_at', { ascending: false })
}

export function buildRecognizeRemainingCountQuery(
  supabase: SupabaseClient,
  userIds: string[],
  eventFolderIds: RecognizeEventFolderScope | undefined,
  options: { overwrite?: boolean; afterPhotoId?: string },
) {
  if (options.overwrite) {
    let query = buildRecognizeScopeCountQuery(supabase, userIds, eventFolderIds)
    if (options.afterPhotoId) {
      query = query.gt('id', options.afterPhotoId)
    }
    return query
  }

  return buildRecognizeScopeCountQuery(supabase, userIds, eventFolderIds, { pendingOnly: true })
}
