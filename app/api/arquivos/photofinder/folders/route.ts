import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requirePhotofinderAuth, getPhotofinderDrive } from '@/lib/photofinder/auth-server'
import { buildFolderTree } from '@/lib/photofinder/folders'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePhotofinderAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const drive = getPhotofinderDrive(auth)
    const allFolders: Array<{ id: string; name: string; parents?: string[] }> = []
    let pageToken: string | undefined

    do {
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'nextPageToken, files(id, name, parents)',
        orderBy: 'name',
        pageSize: 200,
        pageToken,
      })

      for (const folder of response.data.files ?? []) {
        if (!folder.id || !folder.name) continue
        allFolders.push({
          id: folder.id,
          name: folder.name,
          parents: folder.parents ?? undefined,
        })
      }

      pageToken = response.data.nextPageToken ?? undefined
    } while (pageToken)

    const tree = buildFolderTree(allFolders)

    return NextResponse.json({
      folders: allFolders,
      tree,
      total: allFolders.length,
    })
  } catch (error) {
    console.error('photofinder folders:', error)
    return NextResponse.json({ error: 'Falha ao listar pastas do Drive' }, { status: 500 })
  }
}
