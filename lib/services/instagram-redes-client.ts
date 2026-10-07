import type { ObraMapaRow } from '@/lib/obras-mapa'

export type InstagramPostClassification = {
  theme?: string
  isBoosted?: boolean
  obraMapaId?: string | null
}

export type InstagramClassificationsMap = Record<string, InstagramPostClassification>

const CLASSIFICATIONS_CACHE_KEY = 'instagram_post_classifications'
const CUSTOM_THEMES_KEY = 'instagram_custom_themes'

function lerLocalStorage<T>(chave: string): T | null {
  if (typeof window === 'undefined') return null
  const salvo = window.localStorage.getItem(chave)
  if (!salvo) return null
  try {
    return JSON.parse(salvo) as T
  } catch {
    return null
  }
}

function gravarLocalStorage(chave: string, valor: unknown): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(chave, JSON.stringify(valor))
}

/** Classificações (tema, impulsionado, obra) — backend com cache local como fallback. */
export async function fetchInstagramClassifications(): Promise<InstagramClassificationsMap> {
  try {
    const response = await fetch('/api/instagram/classifications')
    if (response.ok) {
      const data = (await response.json()) as {
        success?: boolean
        classifications?: InstagramClassificationsMap
      }
      if (data.success && data.classifications) {
        gravarLocalStorage(CLASSIFICATIONS_CACHE_KEY, data.classifications)
        return data.classifications
      }
    }
  } catch {
    // cai no cache local
  }
  return lerLocalStorage<InstagramClassificationsMap>(CLASSIFICATIONS_CACHE_KEY) ?? {}
}

export function cacheInstagramClassifications(map: InstagramClassificationsMap): void {
  gravarLocalStorage(CLASSIFICATIONS_CACHE_KEY, map)
}

export async function saveInstagramClassification(payload: {
  postId?: string
  postDate?: string
  postCaption?: string
  theme: string
  isBoosted: boolean
  obraMapaId: string | null
}): Promise<boolean> {
  try {
    const response = await fetch('/api/instagram/classifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return response.ok
  } catch {
    return false
  }
}

export function loadInstagramCustomThemes(): string[] {
  const temas = lerLocalStorage<unknown>(CUSTOM_THEMES_KEY)
  return Array.isArray(temas) ? temas.filter((t): t is string => typeof t === 'string') : []
}

export function saveInstagramCustomThemes(temas: string[]): void {
  gravarLocalStorage(CUSTOM_THEMES_KEY, temas)
}

/** Lista de obras do mapa para relacionar posts com tema "Obras". */
export async function fetchObrasMapaLista(): Promise<ObraMapaRow[]> {
  try {
    const response = await fetch('/api/obras/mapa?escopo=lista&periodo=todos')
    if (!response.ok) return []
    const data = (await response.json()) as { obras?: ObraMapaRow[] } | ObraMapaRow[]
    if (Array.isArray(data)) return data
    return Array.isArray(data?.obras) ? data.obras : []
  } catch {
    return []
  }
}
