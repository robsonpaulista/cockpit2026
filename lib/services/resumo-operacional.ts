import type { ResumoOperacionalResponse } from '@/lib/resumo-operacional'

export async function fetchResumoOperacional(
  days = 7,
  _instagram?: unknown
): Promise<ResumoOperacionalResponse> {
  const res = await fetch(`/api/resumo-operacional?days=${days}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ days }),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Falha ao carregar resumo operacional')
  }

  return res.json() as Promise<ResumoOperacionalResponse>
}
