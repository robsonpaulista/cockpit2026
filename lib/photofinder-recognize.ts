import type { SupabaseClient } from '@supabase/supabase-js'
import type { PhotofinderAuthContext } from '@/lib/photofinder/auth-server'
import { getPhotofinderDrive } from '@/lib/photofinder/auth-server'
import { matchAllFacesFromBuffer, recfaceEngineAvailable } from '@/lib/recface-engine'
import { joinPersonTags } from '@/lib/photofinder/person-tags'
import type { RecognizeEventFolderScope } from '@/lib/photofinder/recognize-event-scope'
import {
  buildRecognizePhotosQuery,
  buildRecognizeRemainingCountQuery,
  buildRecognizePhotoIdsCountQuery,
  fetchRecognizePhotosByIds,
} from '@/lib/photofinder/recognize-scope-query'

export interface KnownPersonEmbedding {
  personId: string
  name: string
  roleTag: string | null
  vector: number[]
}

export interface RecognizePhotoResult {
  photoId: string
  status: 'recognized' | 'no_face' | 'no_match' | 'skipped' | 'error'
  personName?: string
  personNames?: string[]
  confidence?: number
  error?: string
}

export interface RecognizeChunkResult {
  processed: number
  recognized: number
  noMatch: number
  noFace: number
  errors: number
  done: boolean
  remaining: number
  lastPhotoId: string | null
  results: RecognizePhotoResult[]
}

const CHUNK_DEFAULT = 5

export async function loadKnownPersonEmbeddings(
  supabase: SupabaseClient,
): Promise<KnownPersonEmbedding[]> {
  const { data, error } = await supabase
    .from('face_descriptors')
    .select('person_id, face_vector, persons!inner(id, name, role_tag)')
    .is('photo_id', null)
    .not('person_id', 'is', null)

  if (error) throw error

  const out: KnownPersonEmbedding[] = []
  for (const row of data ?? []) {
    const vector = row.face_vector as number[] | null
    const rawPerson = row.persons as
      | { id: string; name: string; role_tag: string | null }
      | { id: string; name: string; role_tag: string | null }[]
      | null
    const persons = Array.isArray(rawPerson) ? rawPerson[0] : rawPerson
    if (!vector?.length || !persons?.name || !row.person_id) continue
    out.push({
      personId: String(row.person_id),
      name: persons.name,
      roleTag: persons.role_tag,
      vector,
    })
  }
  return out
}

async function markPhotoAnalyzed(
  supabase: SupabaseClient,
  photoId: string,
  facesDetected: number,
): Promise<void> {
  await supabase
    .from('photos')
    .update({ analyzed: true, faces_detected: facesDetected })
    .eq('id', photoId)
}

async function clearPhotoRecognition(
  supabase: SupabaseClient,
  photoId: string,
  facesDetected: number,
): Promise<void> {
  await supabase
    .from('photos')
    .update({
      person_tag: null,
      role_tag: null,
      analyzed: true,
      faces_detected: facesDetected,
    })
    .eq('id', photoId)
}

function looksLikeImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return true
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return true
  if (buffer.slice(0, 3).toString('ascii') === 'GIF') return true
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return true
  }
  return false
}

async function downloadPhotoBuffer(
  auth: PhotofinderAuthContext,
  driveId: string,
  mimeType: string,
  thumbnailUrl: string | null,
): Promise<Buffer> {
  const drive = getPhotofinderDrive(auth)

  const fetchThumbnail = async (): Promise<Buffer> => {
    if (!thumbnailUrl) throw new Error('Falha ao baixar imagem do Drive')
    const res = await fetch(thumbnailUrl)
    if (!res.ok) throw new Error('Falha ao baixar thumbnail')
    return Buffer.from(await res.arrayBuffer())
  }

  try {
    const response = await drive.files.get(
      { fileId: driveId, alt: 'media' },
      { responseType: 'arraybuffer' },
    )
    const buffer = Buffer.from(response.data as ArrayBuffer)
    if (looksLikeImageBuffer(buffer)) return buffer
    return await fetchThumbnail()
  } catch {
    return await fetchThumbnail()
  }
}

export async function recognizeSinglePhoto(
  supabase: SupabaseClient,
  auth: PhotofinderAuthContext,
  photo: {
    id: string
    drive_id: string
    mime_type: string
    name: string
    thumbnail_url: string | null
    person_tag: string | null
  },
  known: KnownPersonEmbedding[],
  options: { overwrite?: boolean } = {},
): Promise<RecognizePhotoResult> {
  if (photo.person_tag && !options.overwrite) {
    return { photoId: photo.id, status: 'skipped' }
  }

  if (known.length === 0) {
    return { photoId: photo.id, status: 'skipped', error: 'Nenhuma pessoa cadastrada' }
  }

  try {
    const buffer = await downloadPhotoBuffer(
      auth,
      photo.drive_id,
      photo.mime_type,
      photo.thumbnail_url,
    )

    const match = await matchAllFacesFromBuffer(buffer, photo.name, photo.mime_type, known)

    if (match.error) {
      await markPhotoAnalyzed(supabase, photo.id, 0)
      return { photoId: photo.id, status: 'error', error: match.error }
    }

    if (match.noFace || match.faceCount === 0) {
      if (options.overwrite) {
        await clearPhotoRecognition(supabase, photo.id, 0)
      } else {
        await markPhotoAnalyzed(supabase, photo.id, 0)
      }
      return { photoId: photo.id, status: 'no_face' }
    }

    if (!match.recognized || match.matches.length === 0) {
      if (options.overwrite) {
        await clearPhotoRecognition(supabase, photo.id, match.faceCount)
      } else {
        await markPhotoAnalyzed(supabase, photo.id, match.faceCount)
      }
      return { photoId: photo.id, status: 'no_match' }
    }

    const personNames = match.matches.map((item) => item.name)
    const roleTags = match.matches
      .map((item) => item.roleTag?.trim())
      .filter((role): role is string => Boolean(role))

    await supabase
      .from('photos')
      .update({
        person_tag: joinPersonTags(personNames),
        role_tag: roleTags.length > 0 ? joinPersonTags(roleTags) : null,
        analyzed: true,
        faces_detected: match.faceCount,
      })
      .eq('id', photo.id)

    const topConfidence = match.matches[0]?.confidence

    return {
      photoId: photo.id,
      status: 'recognized',
      personName: personNames[0],
      personNames,
      confidence: topConfidence,
    }
  } catch (err) {
    await markPhotoAnalyzed(supabase, photo.id, 0).catch(() => undefined)
    return {
      photoId: photo.id,
      status: 'error',
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

export async function recognizePhotoChunk(
  supabase: SupabaseClient,
  auth: PhotofinderAuthContext,
  userIds: string[],
  options: {
    limit?: number
    onlyUntagged?: boolean
    overwrite?: boolean
    afterPhotoId?: string
    eventFolderIds?: RecognizeEventFolderScope
    photoIds?: string[]
  } = {},
): Promise<RecognizeChunkResult> {
  const limit = options.limit ?? CHUNK_DEFAULT
  const overwrite = options.overwrite === true
  const photoIds = options.photoIds?.filter(Boolean) ?? []

  const engineOk = await recfaceEngineAvailable()
  if (!engineOk) {
    throw new Error(
      'Motor de reconhecimento indisponível. Use npm run dev (sobe Next + recface).',
    )
  }

  const known = await loadKnownPersonEmbeddings(supabase)
  if (known.length === 0) {
    return {
      processed: 0,
      recognized: 0,
      noMatch: 0,
      noFace: 0,
      errors: 0,
      done: true,
      remaining: 0,
      lastPhotoId: null,
      results: [],
    }
  }

  let photos: Awaited<ReturnType<typeof fetchRecognizePhotosByIds>> = []
  let lastPhotoId: string | null = null
  let remaining = 0

  if (photoIds.length > 0) {
    const startIndex =
      options.afterPhotoId != null ? Math.max(0, photoIds.indexOf(options.afterPhotoId) + 1) : 0
    const batchIds = photoIds.slice(startIndex, startIndex + limit)
    photos = await fetchRecognizePhotosByIds(supabase, userIds, batchIds)
    lastPhotoId = batchIds.length > 0 ? batchIds[batchIds.length - 1] ?? null : null

    const remainingIds = photoIds.slice(startIndex + batchIds.length)
    if (overwrite) {
      remaining = remainingIds.length
    } else if (remainingIds.length > 0) {
      const { count: pendingRemaining } = await buildRecognizePhotoIdsCountQuery(
        supabase,
        userIds,
        remainingIds,
        { pendingOnly: true },
      )
      remaining = pendingRemaining ?? 0
    }
  } else {
    const query = buildRecognizePhotosQuery(supabase, userIds, options.eventFolderIds, {
      overwrite,
      afterPhotoId: options.afterPhotoId,
    })

    const { data, error } = await query.limit(limit)
    if (error) throw error
    photos = data ?? []
    lastPhotoId = photos.length ? photos[photos.length - 1]?.id ?? null : null

    const remainingQuery = buildRecognizeRemainingCountQuery(
      supabase,
      userIds,
      options.eventFolderIds,
      { overwrite, afterPhotoId: lastPhotoId ?? options.afterPhotoId },
    )

    const { count: remainingAfter } = await remainingQuery
    remaining = remainingAfter ?? 0
  }

  const results: RecognizePhotoResult[] = []
  let recognized = 0
  let noMatch = 0
  let noFace = 0
  let errors = 0

  for (const photo of photos) {
    const result = await recognizeSinglePhoto(supabase, auth, photo, known, { overwrite })
    results.push(result)
    if (result.status === 'recognized') recognized++
    else if (result.status === 'no_match') noMatch++
    else if (result.status === 'no_face') noFace++
    else if (result.status === 'error') errors++
  }

  const processed = results.filter((r) => r.status !== 'skipped').length
  const batchEmpty = photos.length === 0

  return {
    processed,
    recognized,
    noMatch,
    noFace,
    errors,
    done: batchEmpty || remaining === 0,
    remaining,
    lastPhotoId,
    results,
  }
}
