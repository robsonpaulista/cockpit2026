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

    const supabase = createAdminClient()
    const userIds = await resolvePhotofinderUserIds(supabase, request)
    if (!userIds?.length) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    await normalizeWhitespaceEventTypes(supabase, userIds)

    const { count: unclassifiedCount, error: unclassifiedError } = await applyUnclassifiedEventFilter(
      applyPhotofinderUserScope(
        supabase.from('photos').select('*', { count: 'exact', head: true }),
        userIds,
      ),
    )

    if (unclassifiedError) throw unclassifiedError

    const { data: classifiedRows, error: classifiedError } = await applyPhotofinderUserScope(
      supabase
        .from('photos')
        .select('event_type')
        .not('event_type', 'is', null)
        .neq('event_type', ''),
      userIds,
    )

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

    const totalPhotos = (unclassifiedCount ?? 0) + [...counts.values()].reduce((a, b) => a + b, 0)

    return NextResponse.json({ folders, totalPhotos })
  } catch (error) {
    console.error('photofinder stats event-folders:', error)
    return NextResponse.json({ error: 'Falha ao carregar pastas' }, { status: 500 })
  }
}
