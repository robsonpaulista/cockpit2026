import { NextResponse } from 'next/server'
import { getInstagramRadarCollectStatus } from '@/lib/instagram-radar-collect'
import { isYoutubeApiConfigured } from '@/lib/youtube-data-api'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { isSupabaseMissingTableError } from '@/lib/supabase/table-error'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncOwnCandidateInstagramRadar } from '@/lib/instagram-radar-own-sync'
import { requireRouteUser } from '@/lib/supabase/route-auth'

export const dynamic = 'force-dynamic'

function parseDays(searchParams: URLSearchParams): number {
  const daysRaw = Number(searchParams.get('days') ?? 30)
  return Number.isFinite(daysRaw) ? Math.min(90, Math.max(1, daysRaw)) : 30
}

function parseLimit(searchParams: URLSearchParams): number {
  const limitRaw = Number(searchParams.get('limit') ?? 400)
  return Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, limitRaw)) : 400
}

export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const days = parseDays(searchParams)
    const limit = parseLimit(searchParams)

    try {
      const admin = createAdminClient()
      await syncOwnCandidateInstagramRadar(admin, {
        windowLabel: `${days} days`,
        postsLimit: Math.min(100, Math.max(limit, days * 12)),
      })
    } catch (syncErr) {
      console.warn('[instagram-radar/bootstrap] sync candidato próprio:', syncErr)
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffIso = cutoff.toISOString()

    const [actorsRes, postsRes, status] = await Promise.all([
      supabase
        .from('political_actors')
        .select(
          `
          id,
          name,
          slug,
          actor_type,
          active,
          notes,
          instagram_username,
          instagram_avatar_url,
          created_at,
          updated_at,
          youtube_search_terms (
            id,
            politico_id,
            term,
            active,
            priority,
            created_at,
            updated_at
          )
        `
        )
        .order('name', { ascending: true }),
      supabase
        .from('instagram_radar_posts')
        .select(`*, political_actors!inner ( id, name, slug, actor_type, instagram_avatar_url )`)
        .gte('posted_at', cutoffIso)
        .order('posted_at', { ascending: false })
        .limit(limit),
      getInstagramRadarCollectStatus(supabase),
    ])

    const actorsError = actorsRes.error
    const postsError = postsRes.error

    if (actorsError && isSupabaseMissingTableError(actorsError)) {
      return NextResponse.json({
        setupRequired: true,
        actors: [] as PoliticalActorWithTerms[],
        posts: [] as InstagramRadarPostWithActor[],
        commenterStats: [],
        status,
        configured: isYoutubeApiConfigured(),
        lookbackDays: days,
      })
    }

    if (postsError && isSupabaseMissingTableError(postsError)) {
      return NextResponse.json({
        setupRequired: true,
        actors: (actorsRes.data ?? []) as PoliticalActorWithTerms[],
        posts: [] as InstagramRadarPostWithActor[],
        commenterStats: [],
        status,
        configured: isYoutubeApiConfigured(),
        lookbackDays: days,
      })
    }

    if (actorsError) throw new Error(actorsError.message)
    if (postsError) throw new Error(postsError.message)

    const posts = (postsRes.data ?? []) as InstagramRadarPostWithActor[]
    const postIds = [...new Set(posts.map((p) => p.post_id).filter(Boolean))]
    const politicoIds = [...new Set(posts.map((p) => p.politico_id).filter(Boolean))]

    let commenterStats: Array<{
      politicoId: string
      uniqueCommenters: number
      commentsSampled: number
      postsWithComments: number
    }> = []

    if (politicoIds.length > 0 && postIds.length > 0) {
      const { data: commentRows, error: commentsError } = await supabase
        .from('instagram_radar_comments')
        .select('politico_id, post_id, commenter_username')
        .in('politico_id', politicoIds)
        .in('post_id', postIds)
        .limit(25000)

      if (commentsError && !isSupabaseMissingTableError(commentsError)) {
        // Tabela ausente = setup ainda não rodou; segue sem stats.
        if (!String(commentsError.message || '').includes('instagram_radar_comments')) {
          throw new Error(commentsError.message)
        }
      } else if (!commentsError && commentRows) {
        const byPolitico = new Map<
          string,
          { users: Set<string>; comments: number; posts: Set<string> }
        >()
        for (const row of commentRows) {
          const pid = row.politico_id as string
          const user = String(row.commenter_username || '')
            .trim()
            .toLowerCase()
          if (!pid || !user) continue
          const acc = byPolitico.get(pid) ?? {
            users: new Set<string>(),
            comments: 0,
            posts: new Set<string>(),
          }
          acc.users.add(user)
          acc.comments += 1
          if (row.post_id) acc.posts.add(String(row.post_id))
          byPolitico.set(pid, acc)
        }
        commenterStats = [...byPolitico.entries()].map(([politicoId, acc]) => ({
          politicoId,
          uniqueCommenters: acc.users.size,
          commentsSampled: acc.comments,
          postsWithComments: acc.posts.size,
        }))
      }
    }

    let message = ''
    if (!status.apifyConfigured && !status.ownAccountConfigured) {
      message =
        'Configure a coleta de concorrentes no servidor ou abra Redes & Instagram para gravar dados do Jadyel.'
    } else if (status.ownAccountConfigured && status.ownInstagramSource === 'metrics_history') {
      message = `Jadyel: dados da página Redes & Instagram (${status.ownInstagramPostsInHistory ?? 0} posts no histórico). Concorrentes: coleta automatizada.`
    } else if (status.canCollect) {
      message = `Coleta liberada · Jadyel via ${status.ownAccountConfigured ? 'conta autenticada/histórico ✓' : '—'} · concorrentes ${status.apifyConfigured ? '✓' : '(opcional)'}.`
    } else if (status.cooldownEnabled && !status.canCollect && status.nextCollectAt) {
      message = `Próxima coleta disponível em ${new Date(status.nextCollectAt).toLocaleString('pt-BR')}.`
    }

    return NextResponse.json({
      setupRequired: false,
      configured: isYoutubeApiConfigured(),
      actors: (actorsRes.data ?? []) as PoliticalActorWithTerms[],
      posts,
      commenterStats,
      status: { ...status, message },
      lookbackDays: days,
    })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível. Aguarde alguns segundos e tente novamente.',
          retryable: true,
        },
        { status: 503 }
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao carregar Instagram Radar'
    if (msg.includes('does not exist') || msg.includes('42P01')) {
      return NextResponse.json({
        setupRequired: true,
        actors: [],
        posts: [],
        status: null,
        message: 'Execute database/create-instagram-radar-tables.sql no Supabase.',
      })
    }
    console.error('[instagram-radar/bootstrap]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
