/**
 * Snapshots e fingerprint de cards da War Room para detectar mudanças
 * entre atualizações silenciosas.
 */

export type WarRoomCardId =
  | 'expectativa'
  | 'evolucao'
  | 'pesquisas'
  | 'noticias'
  | 'agenda'
  | 'redes'
  | 'instagram-radar'
  | 'visitas-cidade'

export type WarRoomCardChange = {
  summary: string
  keys: string[]
  at: number
}

/** TTL do destaque visual após uma mudança detectada. */
export const WAR_ROOM_CHANGE_TTL_MS = 2 * 60 * 1000

/** Intervalo de atualização silenciosa. */
export const WAR_ROOM_AUTO_REFRESH_MS = 20 * 60 * 1000

export function fingerprintLines(lines: string[]): string {
  return lines.slice().sort((a, b) => a.localeCompare(b, 'pt-BR')).join('\n')
}

export function diffFingerprints(
  prev: string | null,
  next: string,
): { changed: boolean; keys: string[] } {
  if (prev == null || prev === next) {
    return { changed: false, keys: [] }
  }
  const prevSet = new Set(prev.split('\n').filter(Boolean))
  const nextSet = new Set(next.split('\n').filter(Boolean))
  const keys: string[] = []
  for (const line of nextSet) {
    if (!prevSet.has(line)) {
      const key = line.split('\t')[0] ?? line
      if (key && !keys.includes(key)) keys.push(key)
    }
  }
  for (const line of prevSet) {
    if (!nextSet.has(line)) {
      const key = line.split('\t')[0] ?? line
      if (key && !keys.includes(key)) keys.push(key)
    }
  }
  return { changed: keys.length > 0 || prev !== next, keys }
}

export function summarizeChange(keys: number, noun: string): string {
  if (keys <= 0) return 'Atualizado'
  if (keys === 1) return `1 ${noun} alterado`
  return `${keys} ${noun}s alterados`
}
