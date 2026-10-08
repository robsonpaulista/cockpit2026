import fs from 'fs/promises'
import path from 'path'
import type { ResultadoSecao2026Payload } from '@/lib/resultado-secao-2026'
import { normalizeMunicipioChaveVotacao } from '@/lib/votacao-secao'

const DATA_PATH = path.join(process.cwd(), 'data', 'resultado-secao-2026.json')

let cache: { mtimeMs: number; payload: ResultadoSecao2026Payload } | null = null
let cacheVotosJadyel: { mtimeMs: number; porMunicipio: Map<string, number> } | null = null

/** Identificador da versão atual do arquivo (muda a cada regeneração), usado como ETag. */
export async function versaoResultadoSecao2026(): Promise<string> {
  const { mtimeMs, size } = await fs.stat(DATA_PATH)
  return `"r2026-${Math.round(mtimeMs)}-${size}"`
}

/** Lê `data/resultado-secao-2026.json`, recarregando só quando o arquivo muda. */
export async function carregarResultadoSecao2026(): Promise<ResultadoSecao2026Payload> {
  const { mtimeMs } = await fs.stat(DATA_PATH)
  if (cache && cache.mtimeMs === mtimeMs) return cache.payload
  const raw = await fs.readFile(DATA_PATH, 'utf8')
  cache = { mtimeMs, payload: JSON.parse(raw) as ResultadoSecao2026Payload }
  return cache.payload
}

function indiceJadyel(payload: ResultadoSecao2026Payload): number {
  const porNome = payload.candidatos.findIndex((c) => /jadyel/i.test(c.nome))
  if (porNome >= 0) return porNome
  const geral = payload.candidatos.findIndex((c) => c.comparativo && /federal/i.test(c.cargo))
  return geral >= 0 ? geral : 0
}

export function chaveMunicipioResultado2026(nome: string): string {
  return normalizeMunicipioChaveVotacao(nome)
}

/**
 * Votos do Jadyel em 2026 por município, indexados por `chaveMunicipioResultado2026(nome)`.
 * Retorna mapa vazio se o arquivo de resultados não existir.
 */
export async function votosJadyelPorMunicipio2026(): Promise<Map<string, number>> {
  let payload: ResultadoSecao2026Payload
  try {
    payload = await carregarResultadoSecao2026()
  } catch {
    return new Map()
  }
  const mtimeMs = cache?.mtimeMs ?? 0
  if (cacheVotosJadyel && cacheVotosJadyel.mtimeMs === mtimeMs) return cacheVotosJadyel.porMunicipio

  const idx = indiceJadyel(payload)
  const porCodigo = new Map<string, number>()
  for (const s of payload.secoes) {
    porCodigo.set(s.m, (porCodigo.get(s.m) ?? 0) + (s.v[idx] ?? 0))
  }
  const porMunicipio = new Map<string, number>()
  for (const m of payload.municipios) {
    porMunicipio.set(chaveMunicipioResultado2026(m.nome), porCodigo.get(m.codigo) ?? 0)
  }
  cacheVotosJadyel = { mtimeMs, porMunicipio }
  return porMunicipio
}
