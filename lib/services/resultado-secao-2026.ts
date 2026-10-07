import type { ResultadoSecao2026Payload } from '@/lib/resultado-secao-2026'

export async function fetchResultadoSecao2026(): Promise<ResultadoSecao2026Payload> {
  const res = await fetch('/api/resumo-eleicoes/resultado-2026')
  const json = (await res.json()) as ResultadoSecao2026Payload & { error?: string }
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar resultado por seção')
  return json
}
