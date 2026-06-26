export const UNCLASSIFIED_EVENT_ID = '__unclassified__'
export const UNCLASSIFIED_EVENT_LABEL = 'Sem classificação'

export interface PhotofinderEventFolder {
  id: string
  name: string
  count: number
}

export function isUnclassifiedFolderId(id: string | null | undefined): boolean {
  return id === UNCLASSIFIED_EVENT_ID
}

export function eventFolderToFilters(
  folderId: string,
): { eventType?: string; withoutEvent?: boolean } {
  if (isUnclassifiedFolderId(folderId)) {
    return { eventType: undefined, withoutEvent: true }
  }
  return { eventType: folderId, withoutEvent: undefined }
}

/** Atualiza contagens localmente após classificar/reclassificar fotos. */
export function adjustEventFolderCounts(
  folders: PhotofinderEventFolder[],
  options: {
    fromFolderId: string
    toEventType: string | null
    delta: number
  },
): PhotofinderEventFolder[] {
  const { fromFolderId, toEventType, delta } = options
  if (delta <= 0) return folders

  const map = new Map(folders.map((f) => [f.id, { ...f }]))

  const dec = (id: string) => {
    const folder = map.get(id)
    if (!folder) return
    folder.count = Math.max(0, folder.count - delta)
    if (folder.count === 0) map.delete(id)
    else map.set(id, folder)
  }

  const inc = (id: string, name: string) => {
    const folder = map.get(id)
    if (folder) {
      folder.count += delta
      map.set(id, folder)
    } else {
      map.set(id, { id, name, count: delta })
    }
  }

  dec(fromFolderId)

  if (toEventType === null) {
    inc(UNCLASSIFIED_EVENT_ID, UNCLASSIFIED_EVENT_LABEL)
  } else {
    inc(toEventType, toEventType)
  }

  return [...map.values()].sort((a, b) => {
    if (a.id === UNCLASSIFIED_EVENT_ID) return -1
    if (b.id === UNCLASSIFIED_EVENT_ID) return 1
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

export function patchEventFolderCount(
  folders: PhotofinderEventFolder[],
  folderId: string,
  count: number,
): PhotofinderEventFolder[] {
  if (count <= 0) {
    return folders.filter((f) => f.id !== folderId)
  }
  const exists = folders.some((f) => f.id === folderId)
  if (!exists) {
    const name = isUnclassifiedFolderId(folderId) ? UNCLASSIFIED_EVENT_LABEL : folderId
    return [...folders, { id: folderId, name, count }].sort((a, b) => {
      if (a.id === UNCLASSIFIED_EVENT_ID) return -1
      if (b.id === UNCLASSIFIED_EVENT_ID) return 1
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  }
  return folders.map((f) => (f.id === folderId ? { ...f, count } : f))
}
