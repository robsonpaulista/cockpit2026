import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Agg = {
  key: string
  commenter_username: string | null
  commenter_ig_id: string | null
  count: number
  lastAt: string
}

function commenterKey(row: {
  commenter_ig_id: string | null
  commenter_username: string | null
}): string {
  if (row.commenter_ig_id) return `id:${row.commenter_ig_id}`
  const u = (row.commenter_username || '').trim().toLowerCase()
  if (u) return `u:${u}`
  return 'anon:unknown'
}

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
    const limitLeaders = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)

    const pageSize = 1000
    let from = 0
    const map = new Map<string, Agg>()
    const comentariosContados = new Set<string>()

    for (;;) {
      const { data, error } = await admin
        .from('instagram_comments')
        .select('instagram_comment_id, commenter_username, commenter_ig_id, commented_at')
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      const rows = data || []
      if (rows.length === 0) break

      for (const row of rows) {
        const cid = row.instagram_comment_id as string
        if (!cid || comentariosContados.has(cid)) continue
        comentariosContados.add(cid)

        const key = commenterKey(row)
        const cur = map.get(key)
        const at = row.commented_at as string
        if (!cur) {
          map.set(key, {
            key,
            commenter_username: row.commenter_username,
            commenter_ig_id: row.commenter_ig_id,
            count: 1,
            lastAt: at,
          })
        } else {
          cur.count += 1
          if (at > cur.lastAt) cur.lastAt = at
          if (!cur.commenter_username && row.commenter_username) {
            cur.commenter_username = row.commenter_username
          }
          if (!cur.commenter_ig_id && row.commenter_ig_id) {
            cur.commenter_ig_id = row.commenter_ig_id
          }
        }
      }

      if (rows.length < pageSize) break
      from += pageSize
    }

    const leaders = [...map.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limitLeaders)
      .map((e, index) => ({
        rank: index + 1,
        commenter_username: e.commenter_username,
        commenter_ig_id: e.commenter_ig_id,
        comment_count: e.count,
        last_commented_at: e.lastAt,
      }))

    const totalComments = [...map.values()].reduce((s, x) => s + x.count, 0)

    return NextResponse.json({
      leaders,
      stats: {
        uniqueCommenters: map.size,
        totalComments,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
