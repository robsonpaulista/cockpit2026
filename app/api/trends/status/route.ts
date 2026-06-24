import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { getGoogleTrendsCollectState } from '@/lib/google-trends-collect'
import {
  GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE,
  isGoogleTrendsRunnerAvailable,
} from '@/lib/serverless-runtime'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()

    const runnerAvailable = isGoogleTrendsRunnerAvailable()
    const collectState = getGoogleTrendsCollectState()

    const { error: tableError } = await supabase.from('google_trends_interest').select('id').limit(1)
    if (tableError) {
      const missing = tableError.message.includes('does not exist') || tableError.code === '42P01'
      if (missing) {
        return NextResponse.json({
          runnerAvailable,
          runnerMessage: runnerAvailable ? null : GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE,
          setupRequired: true,
          ...collectState,
        })
      }
      throw new Error(tableError.message)
    }

    return NextResponse.json({
      runnerAvailable,
      runnerMessage: runnerAvailable ? null : GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE,
      setupRequired: false,
      ...collectState,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao verificar status Trends'
    console.error('[trends/status]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
