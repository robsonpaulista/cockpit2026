/**
 * Mesmas faixas latitudinais do mapa de presença (MapaPresenca / REGIOES).
 */

export type RegiaoPiaui = 'Norte' | 'Centro-Norte' | 'Centro-Sul' | 'Sul'

export const REGIOES_PI_ORDER: RegiaoPiaui[] = ['Norte', 'Centro-Norte', 'Centro-Sul', 'Sul']

export function normalizeMunicipioNome(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export function getRegiaoByLat(lat: number): RegiaoPiaui {
  if (lat > -4.8) return 'Norte'
  if (lat > -6.5) return 'Centro-Norte'
  if (lat > -8.5) return 'Centro-Sul'
  return 'Sul'
}

export function buildCidadeToRegiaoMap(
  municipios: ReadonlyArray<{ nome: string; lat: number }>
): Map<string, RegiaoPiaui> {
  const m = new Map<string, RegiaoPiaui>()
  for (const mu of municipios) {
    m.set(normalizeMunicipioNome(mu.nome), getRegiaoByLat(mu.lat))
  }
  return m
}

/** Tenta casar o nome do banco com o JSON de municípios (sufixo UF, barra, etc.). */
export function getRegiaoParaCidade(
  cidade: string,
  mapa: Map<string, RegiaoPiaui>
): RegiaoPiaui | null {
  const raw = cidade.trim()
  if (!raw) return null

  const tryKey = (s: string) => mapa.get(normalizeMunicipioNome(s)) ?? null

  let found = tryKey(raw)
  if (found) return found

  const semSufixo = raw
    .replace(/\s*[-–/]\s*PI\s*$/i, '')
    .replace(/\s*\(\s*PI\s*\)\s*$/i, '')
    .replace(/\s*\/\s*PI\s*$/i, '')
    .trim()
  if (semSufixo !== raw) {
    found = tryKey(semSufixo)
    if (found) return found
  }

  const antesBarra = raw.split('/')[0]?.trim() ?? ''
  if (antesBarra && antesBarra !== raw) {
    found = tryKey(antesBarra)
    if (found) return found
  }

  return null
}

export type MediaIntencaoPorRegiao = {
  regiao: RegiaoPiaui
  media: number
  n: number
}

/** Ponto da série temporal do gráfico de histórico (cockpit / API) */
export type HistoricoIntencaoPontoGrafico = {
  date: string
  dateOriginal: string
  intencao: number
  instituto?: string
  cidade?: string
}

export type HistoricoIntencaoPorRegiaoMap = Record<RegiaoPiaui, HistoricoIntencaoPontoGrafico[]>

export function historicoIntencaoPorRegiaoVazio(): HistoricoIntencaoPorRegiaoMap {
  return {
    Norte: [],
    'Centro-Norte': [],
    'Centro-Sul': [],
    Sul: [],
  }
}

/** Uma linha de pesquisa individual listada por região (modal cockpit) */
export type PesquisaLinhaPorRegiao = {
  dateOriginal: string
  /** Data legível, ex. DD/MM/AAAA */
  dataExibicao: string
  cidade: string
  instituto: string
  intencao: number
}

export type PesquisasPorRegiaoMap = Record<RegiaoPiaui, PesquisaLinhaPorRegiao[]>

export function pesquisasPorRegiaoVazio(): PesquisasPorRegiaoMap {
  return {
    Norte: [],
    'Centro-Norte': [],
    'Centro-Sul': [],
    Sul: [],
  }
}
