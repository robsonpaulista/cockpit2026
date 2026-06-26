import { isUnclassifiedFolderId } from '@/lib/photofinder/event-folders'
import { applyUnclassifiedEventFilter } from '@/lib/photofinder/event-query'

/** undefined = todas as pastas; [] = nenhuma */
export type RecognizeEventFolderScope = string[] | undefined

const IMPOSSIBLE_ID = '00000000-0000-0000-0000-000000000000'

function escapePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyRecognizeEventFolderFilter(query: any, eventFolderIds?: RecognizeEventFolderScope): any {
  if (eventFolderIds === undefined) return query
  if (eventFolderIds.length === 0) return query.eq('id', IMPOSSIBLE_ID)

  const named = eventFolderIds.filter((id) => !isUnclassifiedFolderId(id))
  const includeUnclassified = eventFolderIds.some(isUnclassifiedFolderId)

  if (includeUnclassified && named.length === 0) {
    return applyUnclassifiedEventFilter(query)
  }

  if (!includeUnclassified && named.length > 0) {
    return query.in('event_type', named)
  }

  const parts = ['event_type.is.null', 'event_type.eq.""']
  for (const name of named) {
    parts.push(`event_type.eq.${escapePostgrestValue(name)}`)
  }
  return query.or(parts.join(','))
}

export function parseEventFolderIdsParam(raw: string | null): RecognizeEventFolderScope | undefined {
  if (raw === null || raw === '') return undefined
  if (raw === '__none__') return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export function serializeEventFolderIds(ids: RecognizeEventFolderScope): string | undefined {
  if (ids === undefined) return undefined
  if (ids.length === 0) return '__none__'
  return ids.join(',')
}
