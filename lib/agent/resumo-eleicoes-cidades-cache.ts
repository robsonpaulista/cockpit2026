/** Mesma chave usada em `app/dashboard/resumo-eleicoes/page.tsx`. */
export const RESUMO_CIDADES_CACHE_KEY = 'resumo_eleicoes_cidades_cache_v1'

export function readResumoCidadesCache(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RESUMO_CIDADES_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => String(item || '').trim())
      .filter((item) => item.length > 0)
  } catch {
    return []
  }
}

export function resolveResumoCidadesForJarvis(pageCidades?: string[]): string[] {
  if (pageCidades && pageCidades.length > 0) return pageCidades
  return readResumoCidadesCache()
}
