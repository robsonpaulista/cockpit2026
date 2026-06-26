import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePhotofinderAuth } from '@/lib/photofinder/auth-server'
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

    const { data, error } = await applyPhotofinderUserScope(
      supabase.from('photos').select('event_city, location_name'),
      userIds,
    )

    if (error) throw error

    const cities = new Set<string>()
    for (const row of data ?? []) {
      if (row.event_city) cities.add(row.event_city)
      if (row.location_name) cities.add(row.location_name)
    }

    return NextResponse.json([...cities].sort())
  } catch (error) {
    console.error('photofinder stats cities:', error)
    return NextResponse.json({ error: 'Falha ao carregar cidades' }, { status: 500 })
  }
}
