const LIXO_STORAGE_KEY = 'cockpit_noticias_lixo_ids'

export function loadLixoIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(LIXO_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

export function saveLixoIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  if (ids.size === 0) {
    localStorage.removeItem(LIXO_STORAGE_KEY)
    return
  }
  localStorage.setItem(LIXO_STORAGE_KEY, JSON.stringify([...ids]))
}
