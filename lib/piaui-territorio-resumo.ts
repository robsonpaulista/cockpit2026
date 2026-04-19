import dados from '@/lib/municipio-territorio-desenvolvimento-pi.json'
import { getEleitoradoByCity } from '@/lib/eleitores'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'

export type ResumoTerritorioPI = {
  territorio: TerritorioDesenvolvimentoPI
  municipios: number
  eleitores: number
}

/** Municípios e eleitores agregados por Território de Desenvolvimento (fonte: JSON TD + eleitores-piaui). */
export function getResumoPorTerritorioDesenvolvimentoPI(): ResumoTerritorioPI[] {
  return TERRITORIOS_DESENVOLVIMENTO_PI.map((nomeTd) => {
    const bloco = dados.territorios.find((t) => t.nome === nomeTd)
    const munis = bloco?.municipios ?? []
    let eleitores = 0
    for (const nome of munis) {
      const e = getEleitoradoByCity(nome)
      if (e != null) eleitores += e
    }
    return {
      territorio: nomeTd,
      municipios: munis.length,
      eleitores,
    }
  })
}

export function getTotaisResumoTerritorioPI(resumos: readonly ResumoTerritorioPI[]): {
  municipios: number
  eleitores: number
} {
  return resumos.reduce(
    (acc, r) => ({
      municipios: acc.municipios + r.municipios,
      eleitores: acc.eleitores + r.eleitores,
    }),
    { municipios: 0, eleitores: 0 }
  )
}
