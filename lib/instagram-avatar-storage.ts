import type { SupabaseClient } from '@supabase/supabase-js'

export const INSTAGRAM_AVATARS_BUCKET = 'instagram-avatars'

function extFromContentType(contentType: string | null): string {
  if (!contentType) return 'jpg'
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}

export async function ensureInstagramAvatarsBucket(supabase: SupabaseClient): Promise<void> {
  const { data: bucket } = await supabase.storage.getBucket(INSTAGRAM_AVATARS_BUCKET)
  if (bucket) return

  const { error } = await supabase.storage.createBucket(INSTAGRAM_AVATARS_BUCKET, {
    public: true,
    fileSizeLimit: '5242880',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  })

  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw new Error(`Não foi possível criar bucket ${INSTAGRAM_AVATARS_BUCKET}: ${error.message}`)
  }
}

/**
 * Baixa a imagem e grava no Storage.
 * Remoção de fundo (#F3F4F4) roda só nos scripts Node
 * (`collect-instagram-radar` / `instagram:avatars:reprocess`) — evita sharp/imgly no Webpack do Next.
 */
export async function persistInstagramAvatarFromUrl(
  supabase: SupabaseClient,
  opts: {
    actorId: string
    slug: string
    imageUrl: string
  },
): Promise<{ publicUrl: string; path: string } | null> {
  const imageUrl = opts.imageUrl?.trim()
  if (!imageUrl) return null

  await ensureInstagramAvatarsBucket(supabase)

  const res = await fetch(imageUrl, {
    headers: { Accept: 'image/*,*/*;q=0.8' },
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(`Falha ao baixar avatar (${res.status})`)
  }

  const contentTypeHeader = res.headers.get('content-type')
  const contentType =
    contentTypeHeader && contentTypeHeader.startsWith('image/')
      ? contentTypeHeader.split(';')[0]!.trim()
      : 'image/jpeg'
  const ext = extFromContentType(contentType)
  const path = `${opts.slug}.${ext}`
  const buf = Buffer.from(await res.arrayBuffer())

  const { error: upErr } = await supabase.storage.from(INSTAGRAM_AVATARS_BUCKET).upload(path, buf, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  })
  if (upErr) {
    throw new Error(`Storage avatar: ${upErr.message}`)
  }

  const { data: publicUrlData } = supabase.storage.from(INSTAGRAM_AVATARS_BUCKET).getPublicUrl(path)
  const publicUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`
  const updatedAt = new Date().toISOString()

  const { error: dbErr } = await supabase
    .from('political_actors')
    .update({
      instagram_avatar_url: publicUrl,
      instagram_avatar_path: path,
      instagram_avatar_updated_at: updatedAt,
    })
    .eq('id', opts.actorId)

  if (dbErr) {
    throw new Error(`Banco avatar: ${dbErr.message}`)
  }

  return { publicUrl, path }
}
