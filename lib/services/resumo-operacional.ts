import type { InstagramCredentials, ResumoOperacionalResponse } from '@/lib/resumo-operacional'
import { loadInstagramConfigAsync } from '@/lib/instagramApi'

export async function fetchResumoOperacional(
  days = 7,
  instagram?: InstagramCredentials | null
): Promise<ResumoOperacionalResponse> {
  let creds = instagram
  if (!creds?.token || !creds?.businessAccountId) {
    const loaded = await loadInstagramConfigAsync()
    if (loaded.token && loaded.businessAccountId) {
      creds = { token: loaded.token, businessAccountId: loaded.businessAccountId }
    }
  }

  const res = await fetch(`/api/resumo-operacional?days=${days}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      days,
      ...(creds?.token && creds.businessAccountId
        ? { token: creds.token, businessAccountId: creds.businessAccountId }
        : {}),
    }),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Falha ao carregar resumo operacional')
  }

  return res.json() as Promise<ResumoOperacionalResponse>
}
