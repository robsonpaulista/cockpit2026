import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePhotofinderAuth } from '@/lib/photofinder/auth-server'
import { normalizeWhitespaceEventTypes } from '@/lib/photofinder/normalize-event-types'
import {
  applyPhotofinderUserScope,
  resolvePhotofinderUserIds,
} from '@/lib/photofinder/user-scope'

export const dynamic = 'force-dynamic'

const MAX_BULK = 200

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePhotofinderAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as {
      ids?: string[]
      event_type?: string | null
    }

    const ids = [...new Set(body.ids?.filter(Boolean) ?? [])]
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Selecione ao menos uma foto' }, { status: 400 })
    }
    if (ids.length > MAX_BULK) {
      return NextResponse.json({ error: `Máximo de ${MAX_BULK} fotos por operação` }, { status: 400 })
    }
    if (body.event_type === undefined) {
      return NextResponse.json({ error: 'Informe o evento' }, { status: 400 })
    }

    const eventType =
      body.event_type === null || body.event_type.trim() === ''
        ? null
        : body.event_type.trim()

    const supabase = createAdminClient()
    const userIds = await resolvePhotofinderUserIds(supabase, request)
    if (!userIds?.length) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    await normalizeWhitespaceEventTypes(supabase, userIds)

    const { data, error } = await applyPhotofinderUserScope(
      supabase
        .from('photos')
        .update({ event_type: eventType, updated_at: new Date().toISOString() })
        .in('id', ids)
        .select('id, event_type'),
      userIds,
    )

    if (error) {
      console.error('photofinder bulk-update supabase:', error)
      throw error
    }

    const updated = data?.length ?? 0
    if (updated === 0) {
      return NextResponse.json(
        {
          error:
            'Nenhuma foto foi atualizada. Verifique se as fotos pertencem à sua conta do Drive.',
          updated: 0,
          requested: ids.length,
        },
        { status: 409 },
      )
    }

    if (updated < ids.length) {
      console.warn(`photofinder bulk-update parcial: ${updated}/${ids.length}`)
    }

    return NextResponse.json({
      updated,
      requested: ids.length,
      event_type: eventType,
    })
  } catch (error) {
    console.error('photofinder photos bulk-update:', error)
    return NextResponse.json({ error: 'Falha ao atualizar fotos' }, { status: 500 })
  }
}
