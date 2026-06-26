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
    const search = searchParams.get('search')
    const person = searchParams.get('person')
    const withoutPerson = searchParams.get('withoutPerson')
    const city = searchParams.get('city')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const minFaces = searchParams.get('minFaces')
    const maxFaces = searchParams.get('maxFaces')
    const joy = searchParams.get('joy')
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

    if (search) query = query.ilike('name', `%${search}%`)
    if (withoutPerson === 'true') query = query.is('person_tag', null)
    else if (person) query = query.ilike('person_tag', `%${person}%`)
    if (joy) query = query.eq('joy_likelihood', joy)
    if (city) query = query.or(`event_city.ilike.*${city}*,location_name.ilike.*${city}*`)
    if (withoutEvent === 'true') {
      query = applyUnclassifiedEventFilter(query)
    } else if (eventType) {
      query = query.eq('event_type', eventType)
    }
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)
    if (minFaces) query = query.gte('faces_detected', parseInt(minFaces, 10))
    if (maxFaces) query = query.lte('faces_detected', parseInt(maxFaces, 10))

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
