/**
 * Sistema de Rate Limiting simples e eficiente
 * Usa Map em memória para armazenar contadores
 * 
 * Para produção em escala, considere usar Redis (Upstash, etc.)
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Armazenamento em memória (limpa automaticamente após reset)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Limpar entradas expiradas periodicamente
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Limpar a cada minuto

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number // Janela de tempo em milissegundos
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Verifica se uma requisição está dentro do limite
 * @param identifier Identificador único (ex: IP, userId)
 * @param config Configuração do rate limit
 * @returns Resultado da verificação
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const key = `${identifier}:${config.windowMs}`
  const entry = rateLimitStore.get(key)

  // Se não existe entrada ou expirou, criar nova
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs
    rateLimitStore.set(key, {
      count: 1,
      resetAt,
    })
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt,
    }
  }

  // Se já atingiu o limite
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  // Incrementar contador
  entry.count++
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Obter IP do cliente (considera proxies)
 */
export function getClientIP(request: Request): string {
  // Vercel e outros proxies
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  // Cloudflare
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback
  return request.headers.get('x-real-ip') || 'unknown'
}

/**
 * Configurações pré-definidas de rate limiting
 */
export const RATE_LIMITS = {
  // Login: 5 tentativas por minuto
  LOGIN: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minuto
  },
  // Coleta de notícias: 10 requisições por hora
  NEWS_COLLECT: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hora
  },
  // Instagram API: 20 requisições por minuto (respeitando limites do Facebook)
  INSTAGRAM: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minuto
  },
  // APIs gerais: 100 requisições por minuto
  GENERAL: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minuto
  },
} as const
