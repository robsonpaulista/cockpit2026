import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePhotofinderAuth } from '@/lib/photofinder/auth-server'
import {
  applyPhotofinderUserScope,
  resolvePhotofinderUserIds,
} from '@/lib/photofinder/user-scope'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePhotofinderAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await context.params
    const body = (await request.json()) as {
      person?: string | null
      location?: string | null
      event_type?: string | null
    }

    const updates: Record<string, string | null> = {}
    if (body.person !== undefined) updates.person_tag = body.person
    if (body.location !== undefined) updates.location_name = body.location
    if (body.event_type !== undefined) updates.event_type = body.event_type

    const supabase = createAdminClient()
    const userIds = await resolvePhotofinderUserIds(supabase, request)
    if (!userIds?.length) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    const { data, error } = await applyPhotofinderUserScope(
      supabase.from('photos').update(updates).eq('id', id).select('*'),
      userIds,
    ).single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('photofinder photo update:', error)
    return NextResponse.json({ error: 'Falha ao atualizar foto' }, { status: 500 })
  }
}
