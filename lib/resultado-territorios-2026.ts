import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  getTerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import type { LinhaQuadroMunicipio2026, QuadroMunicipios2026 } from '@/lib/resultado-secao-2026'

export type TerritorioQuadro2026 = {
  /** Soma das cidades do território, no mesmo formato de uma linha do quadro (`codigo` = nome do TD). */
  linha: LinhaQuadroMunicipio2026
  cidades: LinhaQuadroMunicipio2026[]
}

const SEM_TERRITORIO = 'Sem território'

/** Agrupa as linhas do quadro por município nos 12 Territórios de Desenvolvimento do Piauí. */
export function quadroPorTerritorio2026(quadro: QuadroMunicipios2026): TerritorioQuadro2026[] {
  const grupos = new Map<string, LinhaQuadroMunicipio2026[]>()
  for (const l of quadro.linhas) {
    const td = getTerritorioDesenvolvimentoPI(l.nome) ?? SEM_TERRITORIO
    grupos.set(td, [...(grupos.get(td) ?? []), l])
  }
  return [...TERRITORIOS_DESENVOLVIMENTO_PI, SEM_TERRITORIO].flatMap((td) => {
    const cidades = grupos.get(td)
    if (!cidades) return []
    const votos = new Array<number>(quadro.indices.length).fill(0)
    for (const c of cidades) for (let p = 0; p < votos.length; p++) votos[p] += c.votos[p] ?? 0
    const ranking = votos
      .flatMap((v, p) => (v > 0 ? [p] : []))
      .sort((a, b) => votos[b] - votos[a] || a - b)
    const total = votos.reduce((a, b) => a + b, 0)
    return [{ linha: { codigo: td, nome: td, total, votos, ranking }, cidades }]
  })
}
