import type { PrioridadeCampoApiRow } from '@/lib/agent/format-prioridade-visitas'

type TerritoriosFriosApiResponse = {
  prioridadeCampoLista?: PrioridadeCampoApiRow[]
  error?: string
}

/** Busca lista de prioridade (expectativa × visitas) — mesma base do mapa Campo / Resumo Operacional. */
export async function fetchPrioridadeVisitasCampoRows(): Promise<PrioridadeCampoApiRow[]> {
  const res = await fetch('/api/dashboard/territorios-frios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ territorioConfig: {} }),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Não consegui carregar prioridades de visita.')
  }

  const data = (await res.json()) as TerritoriosFriosApiResponse
  if (data.error) {
    throw new Error(data.error)
  }

  return Array.isArray(data.prioridadeCampoLista) ? data.prioridadeCampoLista : []
}

export async function fetchPrioridadeVisitasCampoReply(): Promise<{
  content: string
  speechSegments: string[]
}> {
  const { formatPrioridadeVisitasJarvisReply } = await import('@/lib/agent/format-prioridade-visitas')
  const rows = await fetchPrioridadeVisitasCampoRows()
  return formatPrioridadeVisitasJarvisReply(rows)
}
