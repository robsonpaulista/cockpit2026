/**
 * Rate limit conservador para o tier gratuito da Groq.
 * Valores baixos evitam 429 e preservam cota diária da conta.
 */

const MAX_PER_MINUTE = 6
const MAX_PER_HOUR = 40

type Bucket = {
  minuteCount: number
  minuteResetAt: number
  hourCount: number
  hourResetAt: number
}

const buckets = new Map<string, Bucket>()

function nowMs(): number {
  return Date.now()
}

function getBucket(sessionId: string): Bucket {
  const existing = buckets.get(sessionId)
  if (existing) return existing
  const fresh: Bucket = {
    minuteCount: 0,
    minuteResetAt: nowMs() + 60_000,
    hourCount: 0,
    hourResetAt: nowMs() + 3_600_000,
  }
  buckets.set(sessionId, fresh)
  return fresh
}

/** Limpa entradas antigas ocasionalmente (evita vazamento de memória). */
function pruneStaleBuckets(): void {
  if (buckets.size < 500) return
  const cutoff = nowMs() - 3_600_000
  for (const [key, bucket] of buckets) {
    if (bucket.hourResetAt < cutoff) buckets.delete(key)
  }
}

export function checkAgentRateLimit(sessionId: string): {
  ok: boolean
  retryAfterSec?: number
  reason?: 'minute' | 'hour'
} {
  pruneStaleBuckets()
  const t = nowMs()
  const bucket = getBucket(sessionId)

  if (t >= bucket.minuteResetAt) {
    bucket.minuteCount = 0
    bucket.minuteResetAt = t + 60_000
  }
  if (t >= bucket.hourResetAt) {
    bucket.hourCount = 0
    bucket.hourResetAt = t + 3_600_000
  }

  if (bucket.minuteCount >= MAX_PER_MINUTE) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((bucket.minuteResetAt - t) / 1000),
      reason: 'minute',
    }
  }
  if (bucket.hourCount >= MAX_PER_HOUR) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((bucket.hourResetAt - t) / 1000),
      reason: 'hour',
    }
  }

  bucket.minuteCount += 1
  bucket.hourCount += 1
  return { ok: true }
}

export const AGENT_RATE_LIMITS = {
  maxPerMinute: MAX_PER_MINUTE,
  maxPerHour: MAX_PER_HOUR,
} as const
