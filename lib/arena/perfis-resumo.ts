import { ARENA_LEVELS } from '@/lib/arena/constants'
import type { ArenaPerfil } from '@/lib/arena/types'

export type GrupoResumo = {
  chave: string
  perfis: number
  pontos: number
  comentarios: number
  /** Perfis que pontuaram no período. */
  ativos: number
}

export function agruparPerfis(
  perfis: ArenaPerfil[],
  chaveDe: (p: ArenaPerfil) => string | null,
): GrupoResumo[] {
  const mapa = new Map<string, GrupoResumo>()
  for (const p of perfis) {
    const chave = chaveDe(p) ?? 'Não informado'
    const g = mapa.get(chave) ?? { chave, perfis: 0, pontos: 0, comentarios: 0, ativos: 0 }
    g.perfis += 1
    g.pontos += p.pontos
    g.comentarios += p.comentarios
    if (p.pontos > 0) g.ativos += 1
    mapa.set(chave, g)
  }
  return [...mapa.values()]
}

/** Todos os níveis, do mais alto ao mais baixo (inclusive os sem ninguém). */
export function resumoPorNivel(perfis: ArenaPerfil[]): GrupoResumo[] {
  const grupos = new Map(agruparPerfis(perfis, (p) => p.nivel.name).map((g) => [g.chave, g]))
  return [...ARENA_LEVELS]
    .reverse()
    .map(
      (l) => grupos.get(l.name) ?? { chave: l.name, perfis: 0, pontos: 0, comentarios: 0, ativos: 0 },
    )
}

export function resumoPorRegiao(perfis: ArenaPerfil[]): GrupoResumo[] {
  return agruparPerfis(perfis, (p) => p.regiao).sort((a, b) => b.pontos - a.pontos)
}

export function somaPontos(perfis: ArenaPerfil[]): number {
  return perfis.reduce((acc, p) => acc + p.pontos, 0)
}

export function somaComentarios(perfis: ArenaPerfil[]): number {
  return perfis.reduce((acc, p) => acc + p.comentarios, 0)
}

export function mediaPontos(perfis: ArenaPerfil[]): number {
  return perfis.length > 0 ? Math.round(somaPontos(perfis) / perfis.length) : 0
}
