import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { getGoogleTrendingTopicsCollectState } from '@/lib/google-trending-topics-collect'
import { isGoogleTrendsRunnerAvailable } from '@/lib/serverless-runtime'

export const dynamic = 'force-dynamic'

const VIRAL_RUNNER_MESSAGE =
  'Coleta de temas em alta indisponível na Vercel. Rode localmente: node scripts/collect-google-trending-topics.mjs'

export async function GET() {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()
    const runnerAvailable = isGoogleTrendsRunnerAvailable()
    const collectState = getGoogleTrendingTopicsCollectState()
    const runnerMessage = runnerAvailable ? null : VIRAL_RUNNER_MESSAGE

    const { error: tableError } = await supabase.from('google_trending_topics').select('id').limit(1)
    if (tableError) {
      const missing = tableError.message.includes('does not exist') || tableError.code === '42P01'
      if (missing) {
        return NextResponse.json({
          runnerAvailable,
          runnerMessage,
          setupRequired: true,
          ...collectState,
        })
      }
      throw new Error(tableError.message)
    }

    return NextResponse.json({
      runnerAvailable,
      runnerMessage,
      setupRequired: false,
      ...collectState,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao verificar status de temas em alta'
    console.error('[viral-trends/status]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
