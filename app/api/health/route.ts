import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { validateEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

/**
 * Health Check Endpoint
 * Verifica se o sistema está funcionando corretamente
 */
export async function GET() {
  const checks = {
    status: 'ok' as 'ok' | 'error',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: 'unknown' as 'ok' | 'error' | 'unknown',
      env: 'unknown' as 'ok' | 'error' | 'unknown',
    },
  }

  // Verificar variáveis de ambiente
  const envResult = validateEnv(false)
  if (envResult.valid) {
    checks.checks.env = 'ok'
  } else {
    checks.checks.env = 'error'
    checks.status = 'error'
    logger.warn('Health check: variáveis de ambiente faltando', {
      missing: envResult.missing,
    })
  }

  // Verificar conexão com Supabase
  try {
    const supabase = createClient()
    // Query simples para verificar conexão
    const { error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)

    if (error) {
      // Se for erro de autenticação ou permissão, ainda é conexão OK
      if (error.code === 'PGRST301' || error.code === '42501') {
        checks.checks.database = 'ok'
      } else {
        checks.checks.database = 'error'
        checks.status = 'error'
        logger.error('Health check: erro ao conectar com Supabase', { error: error.message })
      }
    } else {
      checks.checks.database = 'ok'
    }
  } catch (error) {
    checks.checks.database = 'error'
    checks.status = 'error'
    logger.error('Health check: exceção ao verificar Supabase', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return NextResponse.json(checks, {
    status: checks.status === 'ok' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
