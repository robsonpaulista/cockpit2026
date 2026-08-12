import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertCronAuthorized } from '@/lib/cron-auth'
import { DATA_RETENTION_DAYS, retentionCutoffIso } from '@/lib/data-retention'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type PurgeResult = {
  table: string
  removed: number
  remaining: number
}

async function countNewsOlderThan(supabase: ReturnType<typeof createAdminClient>, cutoffIso: string) {
  const [{ count: withPublished }, { count: nullPublished }] = await Promise.all([
    supabase
      .from('news')
      .select('*', { count: 'exact', head: true })
      .not('published_at', 'is', null)
      .lt('published_at', cutoffIso),
    supabase
      .from('news')
      .select('*', { count: 'exact', head: true })
      .is('published_at', null)
      .lt('collected_at', cutoffIso),
  ])
  return (withPublished ?? 0) + (nullPublished ?? 0)
}

async function deleteNewsOlderThan(supabase: ReturnType<typeof createAdminClient>, cutoffIso: string) {
  const { error: e1 } = await supabase
    .from('news')
    .delete()
    .not('published_at', 'is', null)
    .lt('published_at', cutoffIso)
  if (e1) throw new Error(e1.message)

  const { error: e2 } = await supabase
    .from('news')
    .delete()
    .is('published_at', null)
    .lt('collected_at', cutoffIso)
  if (e2) throw new Error(e2.message)
}

async function countGoogleNewsOlderThan(supabase: ReturnType<typeof createAdminClient>, cutoffIso: string) {
  const [{ count: withPublished }, { count: nullPublished }] = await Promise.all([
    supabase
      .from('google_news_mentions')
      .select('*', { count: 'exact', head: true })
      .not('published_at', 'is', null)
      .lt('published_at', cutoffIso),
    supabase
      .from('google_news_mentions')
      .select('*', { count: 'exact', head: true })
      .is('published_at', null)
      .lt('collected_at', cutoffIso),
  ])
  return (withPublished ?? 0) + (nullPublished ?? 0)
}

async function deleteGoogleNewsOlderThan(supabase: ReturnType<typeof createAdminClient>, cutoffIso: string) {
  const { error: e1 } = await supabase
    .from('google_news_mentions')
    .delete()
    .not('published_at', 'is', null)
    .lt('published_at', cutoffIso)
  if (e1) throw new Error(e1.message)

  const { error: e2 } = await supabase
    .from('google_news_mentions')
    .delete()
    .is('published_at', null)
    .lt('collected_at', cutoffIso)
  if (e2) throw new Error(e2.message)
}

export async function POST(request: Request) {
  try {
    const denied = assertCronAuthorized(request)
    if (denied) return denied

    const body = (await request.json().catch(() => ({}))) as { days?: number; dryRun?: boolean }
    const days = Math.min(365, Math.max(1, Number(body.days ?? DATA_RETENTION_DAYS) || DATA_RETENTION_DAYS))
    const dryRun = body.dryRun === true
    const cutoffIso = retentionCutoffIso(days)

    const supabase = createAdminClient()
    const results: PurgeResult[] = []

    const steps: Array<{
      table: string
      count: () => Promise<number>
      remove: () => Promise<void>
    }> = [
      { table: 'news', count: () => countNewsOlderThan(supabase, cutoffIso), remove: () => deleteNewsOlderThan(supabase, cutoffIso) },
      {
        table: 'google_news_mentions',
        count: () => countGoogleNewsOlderThan(supabase, cutoffIso),
        remove: () => deleteGoogleNewsOlderThan(supabase, cutoffIso),
      },
      {
        table: 'instagram_comments',
        count: async () => {
          const { count } = await supabase
            .from('instagram_comments')
            .select('*', { count: 'exact', head: true })
            .lt('commented_at', cutoffIso)
          return count ?? 0
        },
        remove: async () => {
          const { error } = await supabase
            .from('instagram_comments')
            .delete()
            .lt('commented_at', cutoffIso)
          if (error) throw new Error(error.message)
        },
      },
    ]

    for (const step of steps) {
      const toRemove = await step.count()
      if (!dryRun && toRemove > 0) await step.remove()
      const { count: remaining } = await supabase
        .from(step.table)
        .select('*', { count: 'exact', head: true })
      results.push({ table: step.table, removed: dryRun ? 0 : toRemove, remaining: remaining ?? 0 })
      if (dryRun) {
        results[results.length - 1] = {
          table: step.table,
          removed: toRemove,
          remaining: Math.max(0, (remaining ?? 0) - toRemove),
        }
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      retentionDays: days,
      cutoffIso,
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha na limpeza de retenção'
    console.error('[cron/purge-retention]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
