import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  if (msg.includes('fetch failed') || msg.includes('connect timeout')) return true
  const cause = (error as Error & { cause?: { code?: string } }).cause
  return cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
}

export type RouteAuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

/**
 * Autenticação de API route via sessão no cookie (sem round-trip ao Auth).
 * Evita dezenas de `getUser()` paralelos ao carregar o monitoramento.
 * Distingue falha de rede residual (503) de sessão ausente (401).
 */
export async function requireRouteUser(): Promise<RouteAuthResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      if (isNetworkFailure(error)) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: 'Autenticação temporariamente indisponível. Tente novamente em instantes.' },
            { status: 503 }
          ),
        }
      }
    }

    const user = data.session?.user
    if (!user) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
      }
    }

    return { ok: true, user }
  } catch (error) {
    if (isNetworkFailure(error)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Autenticação temporariamente indisponível. Tente novamente em instantes.' },
          { status: 503 }
        ),
      }
    }
    throw error
  }
}
