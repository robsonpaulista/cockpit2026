import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePhotofinderAuth } from '@/lib/photofinder/auth-server'
import { normalizePhotofinderUserId } from '@/lib/photofinder/user-scope'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePhotofinderAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const { data: syncEvent, error } = await supabase
      .from('sync_events')
      .insert({
        user_id: normalizePhotofinderUserId(auth.userId),
        status: 'started',
        started_at: new Date().toISOString(),
        photos_processed: 0,
        photos_added: 0,
        photos_updated: 0,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ syncId: syncEvent.id, message: 'Sincronização iniciada' })
  } catch (error) {
    console.error('photofinder sync start:', error)
    return NextResponse.json({ error: 'Falha ao iniciar sincronização' }, { status: 500 })
  }
}
