/**
 * Validação de Variáveis de Ambiente
 * Valida variáveis obrigatórias no startup
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

const optionalEnvVars = [
  'CRON_SECRET',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'MEDIA_CLOUD_API_KEY',
] as const

export interface EnvValidationResult {
  valid: boolean
  missing: string[]
  warnings: string[]
}

/**
 * Validar variáveis de ambiente
 * @param throwOnError Se true, lança erro se variáveis obrigatórias faltarem
 */
export function validateEnv(throwOnError = false): EnvValidationResult {
  const missing: string[] = []
  const warnings: string[] = []

  // Verificar variáveis obrigatórias
  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  // Verificar variáveis opcionais (apenas avisar)
  for (const key of optionalEnvVars) {
    if (!process.env[key]) {
      warnings.push(key)
    }
  }

  if (missing.length > 0) {
    const error = new Error(
      `Variáveis de ambiente obrigatórias faltando: ${missing.join(', ')}`
    )
    
    if (throwOnError) {
      throw error
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  }
}

/**
 * Validar no startup (apenas em produção)
 */
if (process.env.NODE_ENV === 'production') {
  const result = validateEnv(false)
  if (!result.valid) {
    console.error('⚠️ [ENV] Variáveis obrigatórias faltando:', result.missing)
    console.error('⚠️ [ENV] A aplicação pode não funcionar corretamente!')
  }
  if (result.warnings.length > 0) {
    console.warn('⚠️ [ENV] Variáveis opcionais não configuradas:', result.warnings)
  }
}
