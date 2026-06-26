export type EmotionLikelihood =
  | 'VERY_LIKELY'
  | 'LIKELY'
  | 'POSSIBLE'
  | 'UNLIKELY'
  | 'VERY_UNLIKELY'
  | 'UNKNOWN'

export interface PhotofinderPhoto {
  id: string
  drive_id: string
  name: string
  mime_type: string
  width: number | null
  height: number | null
  size_bytes: number
  created_at: string
  modified_at: string
  gps_lat: number | null
  gps_lng: number | null
  location_name: string | null
  person_tag: string | null
  joy_likelihood: EmotionLikelihood | null
  sorrow_likelihood: EmotionLikelihood | null
  anger_likelihood: EmotionLikelihood | null
  surprise_likelihood: EmotionLikelihood | null
  faces_detected: number
  storage_url: string | null
  thumbnail_url: string | null
  analyzed: boolean
  user_id: string
  indexed_at: string
  updated_at: string
  event_year: number | null
  event_month: number | null
  event_city: string | null
  event_type: string | null
  folder_path: string | null
  role_tag: string | null
}

export interface PhotofinderPhotoFilters {
  search?: string
  person?: string
  withoutPerson?: boolean
  joy?: EmotionLikelihood
  city?: string
  dateFrom?: string
  dateTo?: string
  minFaces?: number
  maxFaces?: number
  eventType?: string
  withoutEvent?: boolean
  page?: number
  limit?: number
}

export interface PhotofinderPhotosResponse {
  photos: PhotofinderPhoto[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface PhotofinderDriveFolder {
  id: string
  name: string
  parents?: string[]
  children?: PhotofinderDriveFolder[]
}

export interface PhotofinderSyncTags {
  person?: string
  location?: string
  event?: string
}

export interface PhotofinderStartSyncOptions {
  folderId: string
  folderName?: string
  tags?: PhotofinderSyncTags
  folderIds?: string[]
}

export type PhotofinderSyncPhase = 'idle' | 'scanning' | 'syncing' | 'recognizing' | 'completed' | 'error'

export interface PhotofinderSyncProgress {
  phase: PhotofinderSyncPhase
  folderName: string
  message: string
  totalPhotos: number | null
  processed: number
  added: number
  updated: number
  recognized: number
  recognizeProcessed: number | null
  recognizeErrors: number | null
  recognizeRemaining: number | null
  recognizeOverwrite: boolean
  percent: number | null
  etaSeconds: number | null
  error: string | null
}

export interface PhotofinderSyncEvent {
  id: string
  user_id: string
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'never_synced'
  photos_processed: number
  photos_added: number
  photos_updated: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export interface PhotofinderUser {
  id: string
  email: string
  name: string | null
}

export interface PhotofinderAuthStatus {
  authenticated: boolean
  user?: PhotofinderUser
  photosCount?: number
}

export interface PhotofinderSessionData {
  userId: string
  googleId: string
  expires: string
}
