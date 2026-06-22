import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE,
  isGoogleTrendsRunnerAvailable,
} from '@/lib/serverless-runtime'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const runnerAvailable = isGoogleTrendsRunnerAvailable()

    const { error: tableError } = await supabase.from('google_trends_interest').select('id').limit(1)
    if (tableError) {
      const missing = tableError.message.includes('does not exist') || tableError.code === '42P01'
      if (missing) {
        return NextResponse.json({
          runnerAvailable,
          runnerMessage: runnerAvailable ? null : GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE,
          setupRequired: true,
        })
      }
      throw new Error(tableError.message)
    }

    return NextResponse.json({
      runnerAvailable,
      runnerMessage: runnerAvailable ? null : GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE,
      setupRequired: false,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao verificar status Trends'
    console.error('[trends/status]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
