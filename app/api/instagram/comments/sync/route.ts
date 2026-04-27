import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { resolveInstagramBusinessAccount } from '@/lib/instagram-graph'
import { fetchAllMediaSummaries, fetchCommentsForMedia, type IgCommentNode } from '@/lib/instagram-comments-graph'
import { logError, logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_MEDIA_DEFAULT = 80
const UPSERT_CHUNK = 80
const SYNC_LOOKBACK_DAYS = 15
const LOOKBACK_MIN_DAYS = 1
const LOOKBACK_MAX_DAYS = 90
const SOFT_TIMEOUT_MS = 240_000

function parseCommentTimestamp(ts: string | undefined): string {
  if (!ts) return new Date().toISOString()
  const n = Number(ts)
  if (!Number.isNaN(n) && String(n) === ts.trim()) {
    return new Date(n * 1000).toISOString()
  }
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function truncate(s: string | undefined, max: number): string | null {
  if (!s) return null
  return s.length <= max ? s : s.slice(0, max)
}

function isMediaWithinLookbackDays(timestamp: string | undefined, lookbackDays: number): boolean {
  if (!timestamp) return false
  const mediaDate = new Date(timestamp)
  if (Number.isNaN(mediaDate.getTime())) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - lookbackDays)
  return mediaDate >= cutoff
}

function parseLookbackDays(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return SYNC_LOOKBACK_DAYS
  return Math.min(Math.max(Math.trunc(parsed), LOOKBACK_MIN_DAYS), LOOKBACK_MAX_DAYS)
}

export async function POST(request: Request) {
  try {
    const startedAtMs = Date.now()
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const rl = checkRateLimit(`instagram-comments-sync:${user.id}`, RATE_LIMITS.INSTAGRAM_COMMENTS_SYNC)
    if (!rl.success) {
      return NextResponse.json(
        {
          error: 'Limite de sincronizações por hora atingido. Tente mais tarde.',
          resetAt: rl.resetAt,
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const token = body.token as string | undefined
    const businessAccountId = body.businessAccountId as string | undefined
    const lookbackDays = parseLookbackDays(body.lookbackDays)
    const rawMax = Number(body.maxMedia)
    const maxMedia = Math.min(
      Math.max(Number.isFinite(rawMax) && rawMax > 0 ? rawMax : MAX_MEDIA_DEFAULT, 1),
      80
    )

    if (!token || !businessAccountId) {
      return NextResponse.json(
        { error: 'Token e Business Account ID são obrigatórios' },
        { status: 400 }
      )
    }

    const { instagramBusinessId, ownerUsername } = await resolveInstagramBusinessAccount(
      businessAccountId,
      token
    )

    const mediaList = await fetchAllMediaSummaries(instagramBusinessId, token, maxMedia)
    const recentMediaList = mediaList.filter((media) =>
      isMediaWithinLookbackDays(media.timestamp, lookbackDays)
    )

    let commentsUpserted = 0
    const syncErrors: string[] = []
    let mediaProcessed = 0
    let timedOutEarly = false

    for (const media of recentMediaList) {
      if (Date.now() - startedAtMs >= SOFT_TIMEOUT_MS) {
        timedOutEarly = true
        syncErrors.push(
          `Sincronização parcial: limite interno de tempo (${Math.floor(SOFT_TIMEOUT_MS / 1000)}s) atingido.`
        )
        logger.warn('Sync comentários: encerrada por orçamento de tempo', {
          userId: user.id,
          lookbackDays,
          maxMedia,
          mediaProcessed,
          mediaPlanned: recentMediaList.length,
          commentsUpserted,
          elapsedMs: Date.now() - startedAtMs,
        })
        break
      }
      try {
        const edges = await fetchCommentsForMedia(media.id, token)
        const seen = new Set<string>()
        const rows: Record<string, unknown>[] = []

        const flushTop = (c: IgCommentNode) => {
          if (seen.has(c.id)) return
          seen.add(c.id)
          rows.push({
            user_id: user.id,
            instagram_business_account_id: instagramBusinessId,
            instagram_owner_username: ownerUsername || null,
            instagram_media_id: media.id,
            media_permalink: media.permalink || null,
            media_caption: truncate(media.caption, 4000),
            media_thumbnail_url: media.thumbnail_url || null,
            media_posted_at: media.timestamp ? parseCommentTimestamp(media.timestamp) : null,
            instagram_comment_id: c.id,
            parent_instagram_comment_id: null,
            commenter_ig_id: c.user?.id || null,
            commenter_username: c.username || null,
            comment_text: c.text ?? '',
            comment_like_count: c.like_count ?? 0,
            hidden: Boolean(c.hidden),
            commented_at: parseCommentTimestamp(c.timestamp),
            synced_at: new Date().toISOString(),
          })
        }

        const flushReply = (parentId: string, c: IgCommentNode) => {
          if (seen.has(c.id)) return
          seen.add(c.id)
          rows.push({
            user_id: user.id,
            instagram_business_account_id: instagramBusinessId,
            instagram_owner_username: ownerUsername || null,
            instagram_media_id: media.id,
            media_permalink: media.permalink || null,
            media_caption: truncate(media.caption, 4000),
            media_thumbnail_url: media.thumbnail_url || null,
            media_posted_at: media.timestamp ? parseCommentTimestamp(media.timestamp) : null,
            instagram_comment_id: c.id,
            parent_instagram_comment_id: parentId,
            commenter_ig_id: c.user?.id || null,
            commenter_username: c.username || null,
            comment_text: c.text ?? '',
            comment_like_count: c.like_count ?? 0,
            hidden: Boolean(c.hidden),
            commented_at: parseCommentTimestamp(c.timestamp),
            synced_at: new Date().toISOString(),
          })
        }

        for (const { comment: c, replies } of edges) {
          flushTop(c)
          for (const r of replies) {
            flushReply(c.id, r)
          }
        }

        for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
          const chunk = rows.slice(i, i + UPSERT_CHUNK)
          const { error } = await supabase.from('instagram_comments').upsert(chunk, {
            onConflict: 'user_id,instagram_comment_id',
          })
          if (error) {
            logError('instagram_comments upsert', new Error(error.message), {
              userId: user.id,
              mediaId: media.id,
              code: error.code,
            })
            syncErrors.push(`${media.id}: ${error.message}`)
          } else {
            commentsUpserted += chunk.length
          }
        }
        mediaProcessed += 1
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido'
        syncErrors.push(`${media.id}: ${msg}`)
        logger.warn('Sync comentários: mídia falhou', { mediaId: media.id, msg })
      }
    }

    logger.info('Instagram comentários sincronizados', {
      userId: user.id,
      mediaCount: mediaProcessed,
      mediaPlanned: recentMediaList.length,
      commentsUpserted,
      lookbackDays,
      timedOutEarly,
      elapsedMs: Date.now() - startedAtMs,
    })

    return NextResponse.json({
      success: true,
      instagramBusinessId,
      ownerUsername,
      mediaProcessed,
      commentsUpserted,
      lookbackDays,
      timedOutEarly,
      elapsedMs: Date.now() - startedAtMs,
      errors: syncErrors.length ? syncErrors : undefined,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno'
    logError('instagram comments sync', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
