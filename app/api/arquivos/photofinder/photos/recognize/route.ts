import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePhotofinderAuth } from '@/lib/photofinder/auth-server'
import { recognizePhotoChunk } from '@/lib/photofinder-recognize'
import {
  parseEventFolderIdsParam,
} from '@/lib/photofinder/recognize-event-scope'
import { buildRecognizeScopeCountQuery } from '@/lib/photofinder/recognize-scope-query'
import {
  applyPhotofinderUserScope,
  resolvePhotofinderUserIds,
} from '@/lib/photofinder/user-scope'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePhotofinderAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      limit?: number
      onlyUntagged?: boolean
      overwrite?: boolean
      afterPhotoId?: string
      eventFolderIds?: string[]
    }

    const eventFolderIds =
      body.eventFolderIds !== undefined ? body.eventFolderIds : undefined

    const supabase = createAdminClient()
    const userIds = await resolvePhotofinderUserIds(supabase, request)
    if (!userIds?.length) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    const result = await recognizePhotoChunk(supabase, auth, userIds, {
      limit: body.limit ?? 5,
      onlyUntagged: body.onlyUntagged !== false,
      overwrite: body.overwrite === true,
      afterPhotoId: body.afterPhotoId,
      eventFolderIds,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('photofinder recognize chunk:', error)
    const message = error instanceof Error ? error.message : 'Falha ao reconhecer pessoas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePhotofinderAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const userIds = await resolvePhotofinderUserIds(supabase, request)
    if (!userIds?.length) {
      return NextResponse.json({ pending: 0, enrolledPersons: 0 })
    }

    const eventFolderIds = parseEventFolderIdsParam(
      request.nextUrl.searchParams.get('eventFolderIds'),
    )
    const overwrite = request.nextUrl.searchParams.get('overwrite') === 'true'

    const { count: pending, error: pendingError } = await buildRecognizeScopeCountQuery(
      supabase,
      userIds,
      eventFolderIds,
      { pendingOnly: !overwrite },
    )

    if (pendingError) throw pendingError

    let total: number | undefined
    if (overwrite) {
      const { count: totalCount, error: totalError } = await buildRecognizeScopeCountQuery(
        supabase,
        userIds,
        eventFolderIds,
      )
      if (totalError) throw totalError
      total = totalCount ?? 0
    }

    const { count: enrolledPersons } = await supabase
      .from('face_descriptors')
      .select('*', { count: 'exact', head: true })
      .is('photo_id', null)
      .not('person_id', 'is', null)

    return NextResponse.json({
      pending: pending ?? 0,
      total,
      enrolledPersons: enrolledPersons ?? 0,
    })
  } catch (error) {
    console.error('photofinder recognize status:', error)
    return NextResponse.json({ error: 'Falha ao consultar status' }, { status: 500 })
  }
}
