import limitesMac from '@/data/limites-mac-2025.json'
import { normalizeMunicipioNome, mapearNomeMunicipio } from '@/lib/fns-municipio-normalize'

export interface LimiteMac {
  uf: string
  ibge: string | number
  municipio: string
  valor: number
  cnes: string | number
  nome_fantasia: string
  tipo: string
}

const LISTA = limitesMac as LimiteMac[]

function chaveBusca(nomeMunicipio: string): string {
  return normalizeMunicipioNome(mapearNomeMunicipio(nomeMunicipio))
}

/** Soma limites MAC de todos os estabelecimentos (CNES) do município. */
export function getValorLimiteMac(nomeMunicipio: string): number | null {
  const chave = chaveBusca(nomeMunicipio)
  const itens = LISTA.filter((l) => normalizeMunicipioNome(l.municipio) === chave)
  if (itens.length === 0) return null
  return itens.reduce((acc, l) => acc + (l.valor || 0), 0)
}

export function getLimitesMacByMunicipio(nomeMunicipio: string): LimiteMac[] {
  const chave = chaveBusca(nomeMunicipio)
  return LISTA.filter((l) => normalizeMunicipioNome(l.municipio) === chave)
}

export function getAllLimitesMac(): LimiteMac[] {
  return LISTA
}
