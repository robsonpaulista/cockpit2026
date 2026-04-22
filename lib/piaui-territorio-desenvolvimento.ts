import dados from '@/lib/municipio-territorio-desenvolvimento-pi.json'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'

/** Nomes dos 12 Territórios de Desenvolvimento (alinhados à tabela `territories` / LC estadual). */
export type TerritorioDesenvolvimentoPI =
  | 'Planície Litorânea'
  | 'Cocais'
  | 'Carnaubais'
  | 'Entre Rios'
  | 'Vale do Sambito'
  | 'Vale do Rio Guaribas'
  | 'Chapada do Vale do Rio Itaim'
  | 'Vale do Canindé'
  | 'Serra da Capivara'
  | 'Vale dos Rios Piauí e Itaueira'
  | 'Tabuleiros do Alto Parnaíba'
  | 'Chapada das Mangabeiras'

export const TERRITORIOS_DESENVOLVIMENTO_PI: readonly TerritorioDesenvolvimentoPI[] = [
  'Planície Litorânea',
  'Cocais',
  'Carnaubais',
  'Entre Rios',
  'Vale do Sambito',
  'Vale do Rio Guaribas',
  'Chapada do Vale do Rio Itaim',
  'Vale do Canindé',
  'Serra da Capivara',
  'Vale dos Rios Piauí e Itaueira',
  'Tabuleiros do Alto Parnaíba',
  'Chapada das Mangabeiras',
]

let mapaRef: Map<string, TerritorioDesenvolvimentoPI> | null = null

function buildMap(): Map<string, TerritorioDesenvolvimentoPI> {
  const m = new Map<string, TerritorioDesenvolvimentoPI>()
  for (const t of dados.territorios) {
    const nomeTd = t.nome as TerritorioDesenvolvimentoPI
    for (const cidade of t.municipios) {
      m.set(normalizeMunicipioNome(cidade), nomeTd)
    }
  }
  return m
}

export function getCidadeToTerritorioDesenvolvimentoMap(): ReadonlyMap<string, TerritorioDesenvolvimentoPI> {
  if (!mapaRef) mapaRef = buildMap()
  return mapaRef
}

/** Resolve o TD a partir do nome da cidade (aceita sufixo " - PI", barra, etc.). */
/** Lista de nomes dos municípios do TD (ordem da base; use sort no UI se quiser A–Z). */
export function getMunicipiosPorTerritorioDesenvolvimentoPI(
  td: TerritorioDesenvolvimentoPI
): readonly string[] {
  const bloco = dados.territorios.find((t) => t.nome === td)
  return bloco?.municipios ?? []
}

export function getTerritorioDesenvolvimentoPI(cidade: string): TerritorioDesenvolvimentoPI | null {
  const mapa = getCidadeToTerritorioDesenvolvimentoMap()
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

function buildTodosMunicipiosCanonOrdenados(): string[] {
  const porChave = new Map<string, string>()
  for (const t of dados.territorios) {
    for (const m of t.municipios) {
      const nome = String(m ?? '').trim()
      if (!nome) continue
      const key = normalizeMunicipioNome(nome)
      if (!porChave.has(key)) porChave.set(key, nome)
    }
  }
  return Array.from(porChave.values()).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  )
}

let cacheMunicipiosOrdenados: readonly string[] | null = null

/** Todos os municípios do Piauí na base dos TDs (Mapa TDs), nomes canônicos, ordenados A–Z. */
export function getTodosMunicipiosPIOficiaisOrdenados(): readonly string[] {
  if (!cacheMunicipiosOrdenados) {
    cacheMunicipiosOrdenados = Object.freeze(buildTodosMunicipiosCanonOrdenados())
  }
  return cacheMunicipiosOrdenados
}

let cacheNormMunicipioParaCanonico: ReadonlyMap<string, string> | null = null

function getMapaMunicipioNormalizadoParaCanonico(): ReadonlyMap<string, string> {
  if (!cacheNormMunicipioParaCanonico) {
    const m = new Map<string, string>()
    for (const canon of getTodosMunicipiosPIOficiaisOrdenados()) {
      m.set(normalizeMunicipioNome(canon), canon)
    }
    cacheNormMunicipioParaCanonico = m
  }
  return cacheNormMunicipioParaCanonico
}

/** Retorna o nome canônico do município na base oficial dos TDs, ou `null` se não existir. */
export function resolverNomeMunicipioPIOficial(input: string): string | null {
  const t = String(input ?? '').trim()
  if (!t) return null
  return getMapaMunicipioNormalizadoParaCanonico().get(normalizeMunicipioNome(t)) ?? null
}
