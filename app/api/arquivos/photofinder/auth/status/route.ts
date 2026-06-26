import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPhotofinderSession } from '@/lib/photofinder/session'
import {
  applyPhotofinderUserScope,
  resolvePhotofinderUserIds,
} from '@/lib/photofinder/user-scope'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getPhotofinderSession()
    if (!session?.userId) {
      return NextResponse.json({ authenticated: false })
    }

    const supabase = createAdminClient()
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', session.userId)
      .single()

    if (error || !user) {
      return NextResponse.json({ authenticated: false })
    }

    const userIds = await resolvePhotofinderUserIds(supabase, request)
    let photosCount = 0
    if (userIds?.length) {
      const { count } = await applyPhotofinderUserScope(
        supabase.from('photos').select('*', { count: 'exact', head: true }),
        userIds,
      )
      photosCount = count ?? 0
    }

    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email, name: user.name },
      photosCount,
    })
  } catch (error) {
    console.error('photofinder auth/status:', error)
    return NextResponse.json({ error: 'Falha ao verificar autenticação' }, { status: 500 })
  }
}
