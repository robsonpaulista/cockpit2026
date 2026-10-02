import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import { ENGAJA_LEADERS } from '@/lib/arena/engaja-leaders'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'

export const dynamic = 'force-dynamic'

type CommentRow = {
  instagram_comment_id: string
  commenter_username: string | null
  comment_text: string | null
  commented_at: string
  instagram_media_id: string
  media_permalink: string | null
  media_caption: string | null
}

export type ArenaLeaderCommentMatch = {
  leaderId: string
  name: string
  city: string | null
  instagram: string
  commentCount: number
  lastCommentedAt: string | null
  sampleComments: Array<{
    id: string
    text: string
    commentedAt: string
    mediaId: string
    permalink: string | null
  }>
}

/**
 * Cruza comentários já sincronizados (Graph → instagram_comments)
 * com os @ das lideranças Engaja cadastradas na Arena.
 */
export async function GET(request: Request) {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const days = Math.min(Math.max(Number(searchParams.get('days')) || 30, 1), 90)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffIso = cutoff.toISOString()

  const handleToLeader = new Map<string, (typeof ENGAJA_LEADERS)[number]>()
  for (const l of ENGAJA_LEADERS) {
    const h = normalizeInstagramHandle(l.instagram)
    if (h) handleToLeader.set(h, l)
  }

  const admin = createAdminClient()
  const pageSize = 1000
  let from = 0
  const byHandle = new Map<
    string,
    {
      count: number
      lastAt: string
      samples: ArenaLeaderCommentMatch['sampleComments']
      seenIds: Set<string>
    }
  >()

  let totalScanned = 0
  let matchedComments = 0

  for (;;) {
    const { data, error } = await admin
      .from('instagram_comments')
      .select(
        'instagram_comment_id, commenter_username, comment_text, commented_at, instagram_media_id, media_permalink, media_caption',
      )
      .eq('user_id', user.id)
      .gte('commented_at', cutoffIso)
      .order('commented_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[api/arena/comments-match]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data ?? []) as CommentRow[]
    if (rows.length === 0) break
    totalScanned += rows.length

    for (const row of rows) {
      const handle = normalizeInstagramHandle(row.commenter_username)
      if (!handle || !handleToLeader.has(handle)) continue
      const cid = row.instagram_comment_id
      if (!cid) continue

      let bucket = byHandle.get(handle)
      if (!bucket) {
        bucket = { count: 0, lastAt: row.commented_at, samples: [], seenIds: new Set() }
        byHandle.set(handle, bucket)
      }
      if (bucket.seenIds.has(cid)) continue
      bucket.seenIds.add(cid)
      bucket.count += 1
      matchedComments += 1
      if (row.commented_at > bucket.lastAt) bucket.lastAt = row.commented_at
      if (bucket.samples.length < 5) {
        bucket.samples.push({
          id: cid,
          text: (row.comment_text ?? '').slice(0, 280),
          commentedAt: row.commented_at,
          mediaId: row.instagram_media_id,
          permalink: row.media_permalink,
        })
      }
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  const matches: ArenaLeaderCommentMatch[] = []
  for (const l of ENGAJA_LEADERS) {
    const h = normalizeInstagramHandle(l.instagram)
    if (!h) continue
    const bucket = byHandle.get(h)
    matches.push({
      leaderId: l.id,
      name: l.name,
      city: l.city,
      instagram: h,
      commentCount: bucket?.count ?? 0,
      lastCommentedAt: bucket?.lastAt ?? null,
      sampleComments: bucket?.samples ?? [],
    })
  }

  matches.sort((a, b) => b.commentCount - a.commentCount || a.name.localeCompare(b.name, 'pt-BR'))

  const withComments = matches.filter((m) => m.commentCount > 0).length

  return NextResponse.json({
    days,
    cutoff: cutoffIso,
    leadersTotal: ENGAJA_LEADERS.length,
    leadersWithComments: withComments,
    commentsScanned: totalScanned,
    commentsMatched: matchedComments,
    matches,
  })
}
