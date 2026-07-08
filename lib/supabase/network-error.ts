function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message ?? '')
  }
  return typeof error === 'string' ? error : ''
}

export function isSupabaseNetworkError(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase()
  if (
    msg.includes('fetch failed') ||
    msg.includes('connect timeout') ||
    msg.includes('network') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout')
  ) {
    return true
  }

  if (error && typeof error === 'object') {
    const o = error as { details?: string; hint?: string }
    const extra = `${o.details ?? ''} ${o.hint ?? ''}`.toLowerCase()
    if (
      extra.includes('connect timeout') ||
      extra.includes('fetch failed') ||
      extra.includes('etimedout')
    ) {
      return true
    }
  }

  if (error instanceof Error) {
    const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause
    if (cause) {
      const causeMsg = (cause.message ?? '').toLowerCase()
      if (
        cause.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        cause.code === 'ETIMEDOUT' ||
        causeMsg.includes('connect timeout')
      ) {
        return true
      }
    }
  }

  return false
}

export function supabaseNetworkErrorResponse(error: unknown): Response | null {
  if (!isSupabaseNetworkError(error)) return null
  return Response.json(
    {
      error: 'Conexão com o Supabase temporariamente indisponível. Aguarde alguns segundos e tente novamente.',
      retryable: true,
    },
    { status: 503 }
  )
}
