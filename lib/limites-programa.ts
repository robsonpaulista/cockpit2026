import limitesProgramaPap2026 from '@/data/limites-programa-pap-2026.json'
import limitesProgramaMac2026 from '@/data/limites-programa-mac-2026.json'
import { normalizeMunicipioNome, mapearNomeMunicipio } from '@/lib/fns-municipio-normalize'

export type ProgramaTetoTipo = 'PAP' | 'MAC'

export interface LimitePrograma {
  uf: string
  ibge: string | number
  municipio: string
  valor: number
  tipo: 'PROGRAMA'
  programa: ProgramaTetoTipo
}

const LISTA_POR_PROGRAMA: Record<ProgramaTetoTipo, LimitePrograma[]> = {
  PAP: limitesProgramaPap2026 as LimitePrograma[],
  MAC: limitesProgramaMac2026 as LimitePrograma[],
}

function chaveBusca(nomeMunicipio: string): string {
  return normalizeMunicipioNome(mapearNomeMunicipio(nomeMunicipio))
}

export function getValorLimitePrograma(
  nomeMunicipio: string,
  programa: ProgramaTetoTipo,
): number | null {
  const chave = chaveBusca(nomeMunicipio)
  const found = LISTA_POR_PROGRAMA[programa].find(
    (l) => normalizeMunicipioNome(l.municipio) === chave,
  )
  return found?.valor ?? null
}
