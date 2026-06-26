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

    const { data: syncEvent, error } = await applyPhotofinderUserScope(
      supabase.from('sync_events').select('*').order('started_at', { ascending: false }).limit(1),
      userIds,
    ).maybeSingle()

    if (error) throw error
    if (!syncEvent) {
      return NextResponse.json({ status: 'never_synced' })
    }

    return NextResponse.json(syncEvent)
  } catch (error) {
    console.error('photofinder sync status:', error)
    return NextResponse.json({ error: 'Falha ao obter status' }, { status: 500 })
  }
}
