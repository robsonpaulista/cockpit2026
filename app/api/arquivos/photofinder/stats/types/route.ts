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
      supabase.from('photos').select('event_type').not('event_type', 'is', null),
      userIds,
    )

    if (error) throw error

    const types = new Set<string>()
    for (const row of data ?? []) {
      if (row.event_type) types.add(row.event_type)
    }

    return NextResponse.json([...types].sort())
  } catch (error) {
    console.error('photofinder stats types:', error)
    return NextResponse.json({ error: 'Falha ao carregar tipos' }, { status: 500 })
  }
}
