import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requirePhotofinderAuth, getPhotofinderDrive } from '@/lib/photofinder/auth-server'
import { countPhotosInFolder, resolveFolderScope } from '@/lib/photofinder/folders'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePhotofinderAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as { folderId?: string }
    if (!body.folderId) {
      return NextResponse.json({ error: 'folderId é obrigatório' }, { status: 400 })
    }

    const drive = getPhotofinderDrive(auth)
    const folderIds = await resolveFolderScope(drive, body.folderId)
    const totalPhotos = await countPhotosInFolder(drive, folderIds)

    return NextResponse.json({
      totalPhotos,
      folderIds,
      subfolderCount: folderIds.length - 1,
    })
  } catch (error) {
    console.error('photofinder sync scan:', error)
    return NextResponse.json({ error: 'Falha ao analisar pasta no Drive' }, { status: 500 })
  }
}
