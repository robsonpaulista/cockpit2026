import type {
  PhotofinderAuthStatus,
  PhotofinderPhoto,
  PhotofinderPhotoFilters,
  PhotofinderPhotosResponse,
  PhotofinderStartSyncOptions,
  PhotofinderSyncEvent,
  PhotofinderSyncProgress,
  PhotofinderDriveFolder,
} from '@/lib/photofinder/types'
import type { PhotofinderEventFolder } from '@/lib/photofinder/event-folders'

const BASE = '/api/arquivos/photofinder'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Erro ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const photofinderApi = {
  getAuthUrl(): Promise<{ authUrl: string }> {
    return requestJson('/auth/url')
  },

  getAuthStatus(): Promise<PhotofinderAuthStatus> {
    return requestJson('/auth/status')
  },

  logout(): Promise<void> {
    return requestJson('/auth/logout', { method: 'POST' })
  },

  getPhotos(filters: PhotofinderPhotoFilters = {}): Promise<PhotofinderPhotosResponse> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value))
      }
    })
    const qs = params.toString()
    return requestJson(`/photos${qs ? `?${qs}` : ''}`)
  },

  updatePhoto(id: string, updates: Partial<PhotofinderPhoto>): Promise<PhotofinderPhoto> {
    const mapped: Record<string, unknown> = {}
    if (updates.person_tag !== undefined) mapped.person = updates.person_tag
    if (updates.location_name !== undefined) mapped.location = updates.location_name
    if (updates.event_type !== undefined) mapped.event_type = updates.event_type
    return requestJson(`/photos/${id}`, { method: 'PUT', body: JSON.stringify(mapped) })
  },

  bulkUpdatePhotos(input: {
    ids: string[]
    event_type: string | null
  }): Promise<{ updated: number; requested: number; event_type: string | null }> {
    return requestJson('/photos/bulk-update', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getPhotoImageUrl(id: string): string {
    return `${BASE}/photos/${id}/image`
  },

  getPhotoDownloadUrl(id: string): string {
    return `${BASE}/photos/${id}/image?download=1`
  },

  getCities(): Promise<string[]> {
    return requestJson('/stats/cities')
  },

  getEventTypes(): Promise<string[]> {
    return requestJson('/stats/types')
  },

  getEventFolders(): Promise<{ folders: PhotofinderEventFolder[]; totalPhotos: number }> {
    return requestJson('/stats/event-folders')
  },

  getFolders(): Promise<{ tree: PhotofinderDriveFolder[]; total: number }> {
    return requestJson('/folders')
  },

  scanFolder(folderId: string): Promise<{
    totalPhotos: number
    folderIds: string[]
    subfolderCount: number
  }> {
    return requestJson('/sync/scan', { method: 'POST', body: JSON.stringify({ folderId }) })
  },

  getSyncStatus(): Promise<PhotofinderSyncEvent> {
    return requestJson('/sync/status')
  },

  startSync(options: PhotofinderStartSyncOptions): Promise<{ syncId: string }> {
    return requestJson('/sync/start', { method: 'POST', body: JSON.stringify(options) })
  },

  processSyncChunk(
    syncId: string,
    pageToken: string | null | undefined,
    options: PhotofinderStartSyncOptions,
  ): Promise<{
    done: boolean
    nextPageToken?: string | null
    totalStats?: { processed: number; added: number; updated: number }
  }> {
    return requestJson('/sync/process-chunk', {
      method: 'POST',
      body: JSON.stringify({ syncId, pageToken, ...options }),
    })
  },

  getRecognizeStatus(
    eventFolderIds?: string[],
    options?: { overwrite?: boolean },
  ): Promise<{ pending: number; total?: number; enrolledPersons: number }> {
    const params = new URLSearchParams()
    if (eventFolderIds !== undefined) {
      if (eventFolderIds.length === 0) {
        params.set('eventFolderIds', '__none__')
      } else {
        params.set('eventFolderIds', eventFolderIds.join(','))
      }
    }
    if (options?.overwrite) {
      params.set('overwrite', 'true')
    }
    const qs = params.toString()
    return requestJson(`/photos/recognize${qs ? `?${qs}` : ''}`)
  },

  recognizeChunk(options?: {
    limit?: number
    onlyUntagged?: boolean
    overwrite?: boolean
    afterPhotoId?: string
    eventFolderIds?: string[]
  }): Promise<{
    processed: number
    recognized: number
    noMatch: number
    noFace: number
    errors: number
    done: boolean
    remaining: number
    lastPhotoId: string | null
  }> {
    return requestJson('/photos/recognize', {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    })
  },
}
