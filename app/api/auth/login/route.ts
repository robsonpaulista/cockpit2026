import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, logError } from '@/lib/logger'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export async function POST(request: Request) {
  try {
    // ✅ Rate limiting - Proteção contra força bruta
    const ip = getClientIP(request)
    const rateLimitResult = checkRateLimit(`login:${ip}`, RATE_LIMITS.LOGIN)

    if (!rateLimitResult.success) {
      logger.warn('Rate limit excedido no login', {
        ip,
        endpoint: '/api/auth/login',
        resetAt: new Date(rateLimitResult.resetAt).toISOString(),
      })

      return NextResponse.json(
        {
          error: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(RATE_LIMITS.LOGIN.maxRequests),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      )
    }

    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    // ✅ Log seguro (sem senha)
    logger.info('Tentativa de login', { email, ip })

    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // ✅ Log de falha (sem senha)
      logger.warn('Login falhou', {
        email,
        ip,
        error: error.message,
      })

      return NextResponse.json(
        { error: error.message },
        {
          status: 401,
          headers: {
            'X-RateLimit-Limit': String(RATE_LIMITS.LOGIN.maxRequests),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      )
    }

    // ✅ Log de sucesso
    logger.info('Login bem-sucedido', { email, ip })

    return NextResponse.json(
      {
        user: data.user,
        session: data.session,
      },
      {
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMITS.LOGIN.maxRequests),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
        },
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validação de login falhou', {
        errors: error.errors,
      })

      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    logError('Erro interno no login', error, {
      endpoint: '/api/auth/login',
    })

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}




