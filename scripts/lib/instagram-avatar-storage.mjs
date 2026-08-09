/** Baixa foto de perfil, remove fundo, grava PNG com fundo #F3F4F4 no bucket `instagram-avatars`. */

import { flattenInstagramAvatar } from './instagram-avatar-flatten.mjs'

export const INSTAGRAM_AVATARS_BUCKET = 'instagram-avatars'

export async function ensureInstagramAvatarsBucket(supabase) {
  const { data: bucket } = await supabase.storage.getBucket(INSTAGRAM_AVATARS_BUCKET)
  if (bucket) return

  const { error } = await supabase.storage.createBucket(INSTAGRAM_AVATARS_BUCKET, {
    public: true,
    fileSizeLimit: '5242880',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  })

  if (error && !String(error.message).toLowerCase().includes('already exists')) {
    throw new Error(`Não foi possível criar bucket ${INSTAGRAM_AVATARS_BUCKET}: ${error.message}`)
  }
}

export async function persistInstagramAvatarFromUrl(supabase, { actorId, slug, imageUrl }) {
  if (!imageUrl?.trim()) return null

  await ensureInstagramAvatarsBucket(supabase)

  const res = await fetch(imageUrl.trim(), {
    headers: { Accept: 'image/*,*/*;q=0.8' },
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(`Falha ao baixar avatar (${res.status})`)
  }

  const contentTypeHeader = res.headers.get('content-type')
  const sourceType =
    contentTypeHeader && contentTypeHeader.startsWith('image/')
      ? contentTypeHeader.split(';')[0].trim()
      : 'image/jpeg'
  const sourceBuf = Buffer.from(await res.arrayBuffer())

  let outBuf = sourceBuf
  let contentType = sourceType
  let flattened = false

  try {
    const flat = await flattenInstagramAvatar(sourceBuf, sourceType)
    outBuf = flat.buf
    contentType = flat.contentType
    flattened = flat.flattened
  } catch (err) {
    console.warn(
      `[avatar] flatten falhou (${slug}), enviando original:`,
      err instanceof Error ? err.message : String(err),
    )
    // fallback JPEG/PNG original — ainda padroniza path .png se possível
    try {
      const sharp = (await import('sharp')).default
      outBuf = await sharp(sourceBuf)
        .resize(320, 320, { fit: 'cover' })
        .flatten({ background: '#F3F4F4' })
        .png()
        .toBuffer()
      contentType = 'image/png'
    } catch {
      /* keep sourceBuf */
    }
  }

  const path = `${slug}.png`
  const { error: upErr } = await supabase.storage.from(INSTAGRAM_AVATARS_BUCKET).upload(path, outBuf, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  })
  if (upErr) throw new Error(`Storage avatar: ${upErr.message}`)

  const { data: publicUrlData } = supabase.storage.from(INSTAGRAM_AVATARS_BUCKET).getPublicUrl(path)
  // bust cache de CDN/browser quando reprocessa
  const publicUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`
  const updatedAt = new Date().toISOString()

  const { error: dbErr } = await supabase
    .from('political_actors')
    .update({
      instagram_avatar_url: publicUrl,
      instagram_avatar_path: path,
      instagram_avatar_updated_at: updatedAt,
    })
    .eq('id', actorId)

  if (dbErr) throw new Error(`Banco avatar: ${dbErr.message}`)

  return { publicUrl, path, flattened }
}
