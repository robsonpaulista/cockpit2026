import { NextResponse } from 'next/server'

/**
 * Auth fail-closed para rotas de cron.
 * Exige `CRON_SECRET` no ambiente e header `Authorization: Bearer <secret>`.
 */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado no ambiente' },
      { status: 503 },
    )
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  return null
}
