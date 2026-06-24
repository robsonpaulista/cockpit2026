import municipiosPiaui from '@/lib/municipios-piaui.json'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import type { LiderancaResumo } from '@/lib/territorio-expectativa-sheet'

export interface CargoCountRow {
  cargo: string
  total: number
}

export interface CidadeLiderancasCargoRow {
  cidade: string
  total: number
  cargos: CargoCountRow[]
}

const municipioLabelPorKey = new Map(
  (municipiosPiaui as Array<{ nome: string }>).map((m) => [normalizeMunicipioNome(m.nome), m.nome])
)

function labelCidade(key: string): string {
  return municipioLabelPorKey.get(key) ?? key
}

function aggregateCargos(leaders: LiderancaResumo[]): CargoCountRow[] {
  const map = new Map<string, number>()
  for (const leader of leaders) {
    const cargo = leader.cargo?.trim() || 'Sem cargo'
    map.set(cargo, (map.get(cargo) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([cargo, total]) => ({ cargo, total }))
    .sort((a, b) => b.total - a.total || a.cargo.localeCompare(b.cargo, 'pt-BR'))
}

export function buildLiderancasCargoPorCidade(
  leadersByCity: ReadonlyMap<string, LiderancaResumo[]>
): CidadeLiderancasCargoRow[] {
  const rows: CidadeLiderancasCargoRow[] = []

  leadersByCity.forEach((leaders, key) => {
    if (leaders.length === 0) return
    rows.push({
      cidade: labelCidade(key),
      total: leaders.length,
      cargos: aggregateCargos(leaders),
    })
  })

  return rows.sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, 'pt-BR'))
}

export interface LiderancasCargoPorCidadeResumo {
  totalLiderancas: number
  totalCidades: number
  cargosEstado: CargoCountRow[]
}

export function summarizeLiderancasCargoPorCidade(
  rows: CidadeLiderancasCargoRow[]
): LiderancasCargoPorCidadeResumo {
  const cargosMap = new Map<string, number>()
  let totalLiderancas = 0

  for (const row of rows) {
    totalLiderancas += row.total
    for (const cargo of row.cargos) {
      cargosMap.set(cargo.cargo, (cargosMap.get(cargo.cargo) ?? 0) + cargo.total)
    }
  }

  const cargosEstado = [...cargosMap.entries()]
    .map(([cargo, total]) => ({ cargo, total }))
    .sort((a, b) => b.total - a.total || a.cargo.localeCompare(b.cargo, 'pt-BR'))

  return {
    totalLiderancas,
    totalCidades: rows.length,
    cargosEstado,
  }
}

export function cargoColumnsFromResumo(cargosEstado: CargoCountRow[]): string[] {
  return cargosEstado.map((c) => c.cargo)
}

export function countCargoNaCidade(row: CidadeLiderancasCargoRow, cargo: string): number {
  return row.cargos.find((c) => c.cargo === cargo)?.total ?? 0
}

/** Chaves normalizadas de municípios com pelo menos uma liderança no cargo. */
export function buildCidadesComCargoSet(
  rows: CidadeLiderancasCargoRow[],
  cargo: string
): Set<string> {
  const set = new Set<string>()
  for (const row of rows) {
    if (countCargoNaCidade(row, cargo) > 0) {
      set.add(normalizeMunicipioNome(row.cidade))
    }
  }
  return set
}

export function buildLiderancasPorCidadeKeyMap(
  rows: CidadeLiderancasCargoRow[]
): Map<string, CidadeLiderancasCargoRow> {
  const map = new Map<string, CidadeLiderancasCargoRow>()
  for (const row of rows) {
    map.set(normalizeMunicipioNome(row.cidade), row)
  }
  return map
}

/** Total exibido na coluna Lideranças — por cargo quando filtrado, senão total na cidade. */
export function liderancasExibidasNaCidade(
  cidadeRow: CidadeLiderancasCargoRow | undefined,
  cargoFiltro: string | null,
  fallbackTotal = 0
): number {
  if (!cidadeRow) return fallbackTotal
  if (cargoFiltro) return countCargoNaCidade(cidadeRow, cargoFiltro)
  return cidadeRow.total
}
