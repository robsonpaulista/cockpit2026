import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { EmendasComparativoPayload } from '@/lib/war-room/emendas-comparativo-pi'

const DATA_FILE = path.join(process.cwd(), 'data', 'emendas-comparativo-pi.json')

let memoryCache: { payload: EmendasComparativoPayload; loadedAt: number } | null = null
const MEMORY_TTL_MS = 5 * 60 * 1000

export async function loadEmendasComparativoPi(): Promise<EmendasComparativoPayload> {
  const now = Date.now()
  if (memoryCache && now - memoryCache.loadedAt < MEMORY_TTL_MS) {
    return memoryCache.payload
  }

  const raw = await readFile(DATA_FILE, 'utf8')
  const payload = JSON.parse(raw) as EmendasComparativoPayload
  memoryCache = { payload, loadedAt: now }
  return payload
}

export function invalidateEmendasComparativoPiCache(): void {
  memoryCache = null
}
