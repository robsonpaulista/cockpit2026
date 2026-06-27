import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePhotofinderAuth } from '@/lib/photofinder/auth-server'
import {
  applyPhotofinderUserScope,
  resolvePhotofinderUserIds,
} from '@/lib/photofinder/user-scope'
import { applyUnclassifiedEventFilter } from '@/lib/photofinder/event-query'
import { normalizeWhitespaceEventTypes } from '@/lib/photofinder/normalize-event-types'
import {
  applyPhotofinderPhotoListFilters,
  parseBrowseFiltersFromSearchParams,
} from '@/lib/photofinder/photo-query-filters'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePhotofinderAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado no Google Drive' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const browseFilters = parseBrowseFiltersFromSearchParams(searchParams)
    const eventType = searchParams.get('eventType')
    const withoutEvent = searchParams.get('withoutEvent')

    const supabase = createAdminClient()
    const userIds = await resolvePhotofinderUserIds(supabase, request)
    if (!userIds?.length) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    if (withoutEvent === 'true') {
      await normalizeWhitespaceEventTypes(supabase, userIds)
    }

    let query = applyPhotofinderUserScope(
      supabase.from('photos').select('*', { count: 'exact' }),
      userIds,
    ).order('created_at', { ascending: false })

    query = applyPhotofinderPhotoListFilters(query, browseFilters)
    if (withoutEvent === 'true') {
      query = applyUnclassifiedEventFilter(query)
    } else if (eventType) {
      query = query.eq('event_type', eventType)
    }

    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({
      photos: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    })
  } catch (error) {
    console.error('photofinder photos list:', error)
    return NextResponse.json({ error: 'Falha ao listar fotos' }, { status: 500 })
  }
}
