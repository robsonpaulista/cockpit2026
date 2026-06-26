import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePhotofinderAuth, getPhotofinderDrive } from '@/lib/photofinder/auth-server'
import { extractImageMetadata } from '@/lib/photofinder/google'
import { listPhotosInFolder } from '@/lib/photofinder/folders'
import { normalizePhotofinderUserId } from '@/lib/photofinder/user-scope'
import type { PhotofinderSyncTags } from '@/lib/photofinder/types'

export const dynamic = 'force-dynamic'
const CHUNK_SIZE = 10

function applyTags(
  photoData: Record<string, unknown>,
  tags?: PhotofinderSyncTags,
  folderName?: string,
) {
  if (tags?.person) photoData.person_tag = tags.person
  if (tags?.location) photoData.location_name = tags.location
  if (tags?.event) photoData.event_type = tags.event
  if (folderName) photoData.folder_path = folderName
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePhotofinderAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as {
      syncId?: string
      pageToken?: string | null
      folderId?: string
      folderName?: string
      folderIds?: string[]
      tags?: PhotofinderSyncTags
    }
    const { syncId, pageToken, folderId, folderName, folderIds, tags } = body

    if (!syncId) {
      return NextResponse.json({ error: 'syncId é obrigatório' }, { status: 400 })
    }

    if (!folderId) {
      return NextResponse.json({ error: 'folderId é obrigatório — selecione uma pasta' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const userId = normalizePhotofinderUserId(auth.userId)
    const { data: syncEvent, error: syncError } = await supabase
      .from('sync_events')
      .select('*')
      .eq('id', syncId)
      .eq('user_id', userId)
      .single()

    if (syncError || !syncEvent) {
      return NextResponse.json({ error: 'Sincronização não encontrada' }, { status: 404 })
    }

    if (syncEvent.status === 'completed' || syncEvent.status === 'failed') {
      return NextResponse.json({
        done: true,
        totalStats: {
          processed: syncEvent.photos_processed,
          added: syncEvent.photos_added,
          updated: syncEvent.photos_updated,
        },
      })
    }

    const drive = getPhotofinderDrive(auth)
    const { files, nextPageToken } = await listPhotosInFolder(
      drive,
      folderId,
      CHUNK_SIZE,
      pageToken,
      folderIds,
    )

    if (files.length === 0) {
      await supabase
        .from('sync_events')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', syncId)

      return NextResponse.json({
        done: true,
        totalStats: {
          processed: syncEvent.photos_processed,
          added: syncEvent.photos_added,
          updated: syncEvent.photos_updated,
        },
      })
    }

    let added = 0
    let updated = 0

    for (const file of files) {
      if (!file.id || !file.name || !file.mimeType) continue

      const metadata = extractImageMetadata(file.imageMediaMetadata ?? null)
      const photoData: Record<string, unknown> = {
        drive_id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        width: metadata.width,
        height: metadata.height,
        size_bytes: parseInt(file.size ?? '0', 10) || 0,
        created_at: file.createdTime ?? new Date().toISOString(),
        modified_at: file.modifiedTime ?? new Date().toISOString(),
        gps_lat: metadata.location?.latitude ?? null,
        gps_lng: metadata.location?.longitude ?? null,
        thumbnail_url: file.thumbnailLink ?? null,
        user_id: userId,
        analyzed: false,
      }

      applyTags(photoData, tags, folderName)

      const { data: existing, error: existingError } = await supabase
        .from('photos')
        .select('id')
        .eq('drive_id', file.id)
        .maybeSingle()

      if (existingError) {
        console.error('photofinder sync lookup:', existingError)
        continue
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from('photos')
          .update(photoData)
          .eq('id', existing.id)
        if (updateError) {
          console.error('photofinder sync update:', updateError)
          continue
        }
        updated++
      } else {
        const { error: insertError } = await supabase.from('photos').insert(photoData)
        if (insertError) {
          console.error('photofinder sync insert:', insertError)
          continue
        }
        added++
      }
    }

    const newProcessed = syncEvent.photos_processed + files.length
    const newAdded = syncEvent.photos_added + added
    const newUpdated = syncEvent.photos_updated + updated

    await supabase
      .from('sync_events')
      .update({
        status: nextPageToken ? 'in_progress' : 'completed',
        photos_processed: newProcessed,
        photos_added: newAdded,
        photos_updated: newUpdated,
        completed_at: nextPageToken ? null : new Date().toISOString(),
      })
      .eq('id', syncId)

    return NextResponse.json({
      done: !nextPageToken,
      nextPageToken,
      totalStats: { processed: newProcessed, added: newAdded, updated: newUpdated },
    })
  } catch (error) {
    console.error('photofinder sync chunk:', error)
    return NextResponse.json({ error: 'Falha ao processar sincronização' }, { status: 500 })
  }
}
