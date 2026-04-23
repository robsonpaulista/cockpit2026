import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

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
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 40, 1), 100)
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)
    const mediaId = searchParams.get('mediaId')

    let query = admin
      .from('instagram_comments')
      .select(
        'id, instagram_media_id, media_permalink, media_caption, media_thumbnail_url, media_posted_at, instagram_comment_id, parent_instagram_comment_id, commenter_ig_id, commenter_username, comment_text, comment_like_count, hidden, commented_at, synced_at, instagram_owner_username'
      )
      .eq('user_id', user.id)
      .order('commented_at', { ascending: false })

    if (mediaId) {
      query = query.eq('instagram_media_id', mediaId)
    }

    const { data, error } = await query.range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ comments: data ?? [] })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
