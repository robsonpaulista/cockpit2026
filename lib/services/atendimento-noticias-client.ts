import type { PortalNoticiaItem } from '@/lib/radar-224/scrape-listagem-portal'

export type AtendimentoNoticiasPayload = {
  ok: boolean
  municipio: string
  fontesConsultadas: number
  total: number
  itens: PortalNoticiaItem[]
  error?: string
}

export async function fetchAtendimentoNoticiasMunicipio(
  municipio: string,
): Promise<AtendimentoNoticiasPayload> {
  const res = await fetch(
    `/api/resumo-eleicoes/noticias?municipio=${encodeURIComponent(municipio)}`,
  )
  const json = (await res.json().catch(() => ({}))) as Partial<AtendimentoNoticiasPayload> & {
    error?: string
  }
  if (!res.ok) {
    throw new Error(json.error || `Falha ao buscar notícias (${res.status})`)
  }
  return {
    ok: Boolean(json.ok),
    municipio: json.municipio ?? municipio,
    fontesConsultadas: json.fontesConsultadas ?? 0,
    total: json.total ?? json.itens?.length ?? 0,
    itens: json.itens ?? [],
    error: json.error,
  }
}
