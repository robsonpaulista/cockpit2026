import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePhotofinderAuth } from '@/lib/photofinder/auth-server'
import {
  UNCLASSIFIED_EVENT_ID,
  UNCLASSIFIED_EVENT_LABEL,
  type PhotofinderEventFolder,
} from '@/lib/photofinder/event-folders'
import { applyUnclassifiedEventFilter, isUnclassifiedEventType } from '@/lib/photofinder/event-query'
import { normalizeWhitespaceEventTypes } from '@/lib/photofinder/normalize-event-types'
import {
  applyPhotofinderPhotoListFilters,
  hasActiveBrowseFilters,
  parseBrowseFiltersFromSearchParams,
} from '@/lib/photofinder/photo-query-filters'
import {
  applyPhotofinderUserScope,
  resolvePhotofinderUserIds,
} from '@/lib/photofinder/user-scope'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePhotofinderAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const browseFilters = parseBrowseFiltersFromSearchParams(request.nextUrl.searchParams)
    const filtered = hasActiveBrowseFilters(browseFilters)

    const supabase = createAdminClient()
    const userIds = await resolvePhotofinderUserIds(supabase, request)
    if (!userIds?.length) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    await normalizeWhitespaceEventTypes(supabase, userIds)

    let unclassifiedQuery = applyUnclassifiedEventFilter(
      applyPhotofinderUserScope(
        supabase.from('photos').select('*', { count: 'exact', head: true }),
        userIds,
      ),
    )
    unclassifiedQuery = applyPhotofinderPhotoListFilters(unclassifiedQuery, browseFilters)

    const { count: unclassifiedCount, error: unclassifiedError } = await unclassifiedQuery
    if (unclassifiedError) throw unclassifiedError

    let classifiedQuery = applyPhotofinderUserScope(
      supabase
        .from('photos')
        .select('event_type')
        .not('event_type', 'is', null)
        .neq('event_type', ''),
      userIds,
    )
    classifiedQuery = applyPhotofinderPhotoListFilters(classifiedQuery, browseFilters)

    const { data: classifiedRows, error: classifiedError } = await classifiedQuery
    if (classifiedError) throw classifiedError

    const counts = new Map<string, number>()
    for (const row of classifiedRows ?? []) {
      const name = String(row.event_type ?? '').trim()
      if (isUnclassifiedEventType(name)) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }

    const folders: PhotofinderEventFolder[] = []

    if ((unclassifiedCount ?? 0) > 0) {
      folders.push({
        id: UNCLASSIFIED_EVENT_ID,
        name: UNCLASSIFIED_EVENT_LABEL,
        count: unclassifiedCount ?? 0,
      })
    }

    for (const [name, count] of [...counts.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], 'pt-BR'),
    )) {
      folders.push({ id: name, name, count })
    }

    const totalPhotos = folders.reduce((sum, folder) => sum + folder.count, 0)

    return NextResponse.json({
      folders,
      totalPhotos,
      filtered,
    })
  } catch (error) {
    console.error('photofinder stats event-folders:', error)
    return NextResponse.json({ error: 'Falha ao carregar pastas' }, { status: 500 })
  }
}
