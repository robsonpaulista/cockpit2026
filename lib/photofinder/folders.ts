import type { drive_v3 } from 'googleapis'

import type { PhotofinderDriveFolder } from '@/lib/photofinder/types'

export type { PhotofinderDriveFolder }

export function buildFolderTree(
  folders: Array<{ id?: string | null; name?: string | null; parents?: string[] | null }>,
): PhotofinderDriveFolder[] {
  const folderMap = new Map<string, PhotofinderDriveFolder>()
  const tree: PhotofinderDriveFolder[] = []

  for (const folder of folders) {
    if (!folder.id || !folder.name) continue
    folderMap.set(folder.id, {
      id: folder.id,
      name: folder.name,
      parents: folder.parents ?? [],
      children: [],
    })
  }

  for (const folder of folders) {
    if (!folder.id) continue
    const node = folderMap.get(folder.id)
    if (!node) continue

    const parentId = node.parents?.[0]
    if (parentId) {
      const parent = folderMap.get(parentId)
      if (parent) parent.children!.push(node)
      else tree.push(node)
    } else {
      tree.push(node)
    }
  }

  return tree
}

export async function getAllSubfolderIds(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<string[]> {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    pageSize: 100,
  })

  const subfolders = response.data.files ?? []
  const ids: string[] = []

  for (const subfolder of subfolders) {
    if (!subfolder.id) continue
    ids.push(subfolder.id)
    const nested = await getAllSubfolderIds(drive, subfolder.id)
    ids.push(...nested)
  }

  return ids
}

export async function resolveFolderScope(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<string[]> {
  const subfolderIds = await getAllSubfolderIds(drive, folderId)
  subfolderIds.push(folderId)
  return subfolderIds
}

function buildPhotosQuery(folderIds: string[]): string {
  const folderQuery = folderIds.map((id) => `'${id}' in parents`).join(' or ')
  return `mimeType contains 'image/' and trashed=false and (${folderQuery})`
}

export async function countPhotosInFolder(
  drive: drive_v3.Drive,
  folderIds: string[],
): Promise<number> {
  const query = buildPhotosQuery(folderIds)
  let count = 0
  let pageToken: string | undefined

  do {
    const response = await drive.files.list({
      q: query,
      fields: 'nextPageToken, files(id)',
      pageSize: 1000,
      pageToken,
    })
    count += response.data.files?.length ?? 0
    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return count
}

export async function listPhotosInFolder(
  drive: drive_v3.Drive,
  folderId: string,
  pageSize: number,
  pageToken?: string | null,
  cachedFolderIds?: string[],
) {
  const folderIds =
    cachedFolderIds && cachedFolderIds.length > 0
      ? cachedFolderIds
      : await resolveFolderScope(drive, folderId)

  const response = await drive.files.list({
    pageSize,
    pageToken: pageToken || undefined,
    q: buildPhotosQuery(folderIds),
    fields:
      'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, imageMediaMetadata, thumbnailLink, parents)',
    orderBy: 'createdTime desc',
  })

  return {
    files: response.data.files ?? [],
    nextPageToken: response.data.nextPageToken ?? null,
    folderIds,
  }
}
