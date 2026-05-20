import limitesPap from '@/data/limites-pap-2025.json'
import { normalizeMunicipioNome, mapearNomeMunicipio } from '@/lib/fns-municipio-normalize'

export interface LimitePap {
  uf: string
  ibge: string | number
  municipio: string
  valor: number
  tipo: string
}

const LISTA = limitesPap as LimitePap[]

function chaveBusca(nomeMunicipio: string): string {
  return normalizeMunicipioNome(mapearNomeMunicipio(nomeMunicipio))
}

export function getLimitePapByMunicipio(nomeMunicipio: string): LimitePap | undefined {
  const chave = chaveBusca(nomeMunicipio)
  return LISTA.find((l) => normalizeMunicipioNome(l.municipio) === chave)
}

export function getValorLimitePap(nomeMunicipio: string): number | null {
  return getLimitePapByMunicipio(nomeMunicipio)?.valor ?? null
}

export function getAllLimitesPap(): LimitePap[] {
  return LISTA
}
