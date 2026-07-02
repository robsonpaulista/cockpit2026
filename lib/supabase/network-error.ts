export function isSupabaseNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  if (
    msg.includes('fetch failed') ||
    msg.includes('connect timeout') ||
    msg.includes('network') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout')
  ) {
    return true
  }
  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause
  if (!cause) return false
  const causeMsg = (cause.message ?? '').toLowerCase()
  return (
    cause.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    cause.code === 'ETIMEDOUT' ||
    causeMsg.includes('connect timeout')
  )
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
