export const JARVIS_RESUMO_PENDING_KEY = 'jarvis_resumo_pending_busca_v1'

export interface JarvisResumoPendingBusca {
  cidade: string
  liderancaCargo?: string
  liderancaNome?: string
  modo: 'atendimento' | 'busca'
  at: number
}

export function setJarvisResumoPendingBusca(payload: Omit<JarvisResumoPendingBusca, 'at'>): void {
  if (typeof window === 'undefined') return
  const data: JarvisResumoPendingBusca = { ...payload, at: Date.now() }
  sessionStorage.setItem(JARVIS_RESUMO_PENDING_KEY, JSON.stringify(data))
}

export function consumeJarvisResumoPendingBusca(): JarvisResumoPendingBusca | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(JARVIS_RESUMO_PENDING_KEY)
    if (!raw) return null
    sessionStorage.removeItem(JARVIS_RESUMO_PENDING_KEY)
    const parsed = JSON.parse(raw) as JarvisResumoPendingBusca
    if (!parsed?.cidade?.trim()) return null
    if (Date.now() - (parsed.at || 0) > 120_000) return null
    return parsed
  } catch {
    return null
  }
}

export function buildResumoEleicoesNavigateUrl(cidade: string): string {
  const params = new URLSearchParams({
    cidade,
    jarvisBuscar: '1',
  })
  return `/dashboard/resumo-eleicoes?${params.toString()}`
}
