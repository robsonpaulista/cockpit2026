import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePhotofinderAuth, getPhotofinderDrive } from '@/lib/photofinder/auth-server'
import {
  applyPhotofinderUserScope,
  resolvePhotofinderUserIds,
} from '@/lib/photofinder/user-scope'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePhotofinderAuth(request)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 })
    }

    const { id } = await context.params
    const supabase = createAdminClient()
    const userIds = await resolvePhotofinderUserIds(supabase, request)
    if (!userIds?.length) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401 })
    }

    const { data: photo, error } = await applyPhotofinderUserScope(
      supabase.from('photos').select('drive_id, mime_type, name, thumbnail_url').eq('id', id),
      userIds,
    ).single()

    if (error || !photo) {
      return new Response(JSON.stringify({ error: 'Foto não encontrada' }), { status: 404 })
    }

    const drive = getPhotofinderDrive(auth)
    const response = await drive.files.get(
      { fileId: photo.drive_id, alt: 'media' },
      { responseType: 'arraybuffer' },
    )

    const buffer = Buffer.from(response.data as ArrayBuffer)
    const download = request.nextUrl.searchParams.get('download') === '1'
    const filename = photo.name || 'foto.jpg'
    return new Response(buffer, {
      headers: {
        'Content-Type': photo.mime_type || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': download
          ? `attachment; filename="${encodeURIComponent(filename)}"`
          : `inline; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error) {
    console.error('photofinder photo image:', error)
    return new Response(JSON.stringify({ error: 'Falha ao carregar imagem' }), { status: 500 })
  }
}
