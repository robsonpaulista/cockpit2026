import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { TERRITORIOS_DESENVOLVIMENTO_PI } from '@/lib/piaui-territorio-desenvolvimento'
import type { HistoricoIntencaoPontoGrafico, PesquisaLinhaPorRegiao } from '@/lib/piaui-regiao'

export type MediaIntencaoPorTd = {
  territorio: TerritorioDesenvolvimentoPI
  media: number
  n: number
}

export type HistoricoIntencaoPorTdMap = Record<TerritorioDesenvolvimentoPI, HistoricoIntencaoPontoGrafico[]>

export type PesquisasPorTdMap = Record<TerritorioDesenvolvimentoPI, PesquisaLinhaPorRegiao[]>

function preencherVazioTd<T>(fabrica: () => T): Record<TerritorioDesenvolvimentoPI, T> {
  const o = {} as Record<TerritorioDesenvolvimentoPI, T>
  for (const t of TERRITORIOS_DESENVOLVIMENTO_PI) {
    o[t] = fabrica()
  }
  return o
}

export function historicoIntencaoPorTdVazio(): HistoricoIntencaoPorTdMap {
  return preencherVazioTd(() => [] as HistoricoIntencaoPontoGrafico[])
}

export function pesquisasPorTdVazio(): PesquisasPorTdMap {
  return preencherVazioTd(() => [] as PesquisaLinhaPorRegiao[])
}

/** Ordem estável dos 12 TDs (LC estadual / mapa). */
export const TERRITORIOS_DESENVOLVIMENTO_PI_ORDER: readonly TerritorioDesenvolvimentoPI[] =
  TERRITORIOS_DESENVOLVIMENTO_PI
