import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dedupeRowsByInstagramCommentId } from '@/lib/instagram-comments-dedupe'

export const dynamic = 'force-dynamic'

const SELECT_FIELDS =
  'id, instagram_media_id, media_permalink, media_caption, media_thumbnail_url, media_posted_at, instagram_comment_id, parent_instagram_comment_id, commenter_ig_id, commenter_username, comment_text, comment_like_count, hidden, commented_at, synced_at, instagram_owner_username'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const maxRows = Math.min(Math.max(Number(searchParams.get('maxRows')) || 6000, 100), 15000)

    const { data: rows, error } = await admin
      .from('instagram_comments')
      .select(SELECT_FIELDS)
      .order('media_posted_at', { ascending: false, nullsFirst: false })
      .order('commented_at', { ascending: false })
      .limit(maxRows)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const list = dedupeRowsByInstagramCommentId(rows ?? [])
    const byMedia = new Map<
      string,
      {
        instagram_media_id: string
        media_permalink: string | null
        media_caption: string | null
        media_thumbnail_url: string | null
        media_posted_at: string | null
        comments: typeof list
      }
    >()

    for (const row of list) {
      const mid = row.instagram_media_id as string
      let g = byMedia.get(mid)
      if (!g) {
        g = {
          instagram_media_id: mid,
          media_permalink: (row.media_permalink as string | null) ?? null,
          media_caption: (row.media_caption as string | null) ?? null,
          media_thumbnail_url: (row.media_thumbnail_url as string | null) ?? null,
          media_posted_at: (row.media_posted_at as string | null) ?? null,
          comments: [],
        }
        byMedia.set(mid, g)
      }
      g.comments.push(row)
      if (!g.media_permalink && row.media_permalink) g.media_permalink = row.media_permalink as string
      if (!g.media_thumbnail_url && row.media_thumbnail_url) {
        g.media_thumbnail_url = row.media_thumbnail_url as string | null
      }
      if (!g.media_caption && row.media_caption) g.media_caption = row.media_caption as string | null
      if (!g.media_posted_at && row.media_posted_at) g.media_posted_at = row.media_posted_at as string | null
    }

    const posts = [...byMedia.values()].sort((a, b) => {
      const ta = a.media_posted_at ? new Date(a.media_posted_at).getTime() : 0
      const tb = b.media_posted_at ? new Date(b.media_posted_at).getTime() : 0
      return tb - ta
    })

    const totalRows = list.length
    const truncated = totalRows >= maxRows

    return NextResponse.json({
      posts: posts.map((p) => ({
        instagram_media_id: p.instagram_media_id,
        media_permalink: p.media_permalink,
        media_caption: p.media_caption,
        media_thumbnail_url: p.media_thumbnail_url,
        media_posted_at: p.media_posted_at,
        comments_count: p.comments.length,
        comments: p.comments,
      })),
      meta: {
        totalRows,
        postCount: posts.length,
        truncated,
        maxRows,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
