import { ARENA_LEVELS } from '@/lib/arena/constants'
import type { ArenaBadgeId, ArenaLevel, PontuacaoPerfil } from '@/lib/arena/types'

/** Início da Arena de Apoiadores: "Tudo" soma daqui até hoje. */
export const ARENA_INICIO = '2026-08-16'

export const PONTOS = {
  comentarioBase: 10,
  /** +2 quando o comentário tem 5 ou mais palavras. */
  bonusTexto: 2,
  palavrasMinimas: 5,
  /** +2 quando o comentário recebeu ao menos uma curtida. */
  bonusCurtido: 2,
  cedo: 8,
  cedoMinutos: 60,
  curtida: 3,
  /** Comentários pontuados por pessoa em um mesmo post (evita repetição). */
  limitePorPost: 3,
  fidelidadeTaxa: 0.7,
  fidelidadeBonus: 0.15,
} as const

export type ComentarioArena = {
  id: string
  handle: string
  mediaId: string
  texto: string | null
  curtidas: number
  postadoEm: string | null
  comentadoEm: string
}

const FORMATO_DIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })

function diaBrasilia(iso: string): string {
  return FORMATO_DIA.format(new Date(iso))
}

function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function resolverNivel(pontos: number): {
  nivel: ArenaLevel
  proximoNivel: ArenaLevel | null
  progressoNivel: number
} {
  let nivel = ARENA_LEVELS[0]!
  for (const l of ARENA_LEVELS) if (pontos >= l.minPoints) nivel = l
  const i = ARENA_LEVELS.indexOf(nivel)
  const proximoNivel = ARENA_LEVELS[i + 1] ?? null
  if (!proximoNivel) return { nivel, proximoNivel: null, progressoNivel: 1 }
  const faixa = proximoNivel.minPoints - nivel.minPoints
  return {
    nivel,
    proximoNivel,
    progressoNivel: Math.min(1, Math.max(0, (pontos - nivel.minPoints) / faixa)),
  }
}

export function pontosDoComentario(c: ComentarioArena): { base: number; cedo: number } {
  const palavras = (c.texto ?? '').trim().split(/\s+/).filter(Boolean).length
  let base = PONTOS.comentarioBase
  if (palavras >= PONTOS.palavrasMinimas) base += PONTOS.bonusTexto
  if (c.curtidas > 0) base += PONTOS.bonusCurtido
  const minutos = c.postadoEm
    ? (new Date(c.comentadoEm).getTime() - new Date(c.postadoEm).getTime()) / 60_000
    : Number.POSITIVE_INFINITY
  return { base, cedo: minutos >= 0 && minutos <= PONTOS.cedoMinutos ? PONTOS.cedo : 0 }
}

/** Dias seguidos com comentário, contando de `ate` (ou da véspera, se ainda não comentou no dia). */
function sequenciaDias(dias: Set<string>, ate: string): number {
  let cursor = dias.has(ate) ? ate : diaAnterior(ate)
  let n = 0
  while (dias.has(cursor)) {
    n += 1
    cursor = diaAnterior(cursor)
  }
  return n
}

/**
 * Pontua cada perfil a partir dos comentários do período.
 * `postsNoPeriodo` = posts publicados no período (base da fidelidade).
 */
export function pontuarPerfis(opts: {
  handles: string[]
  comentarios: ComentarioArena[]
  postsNoPeriodo: number
  ate: string
}): Map<string, PontuacaoPerfil> {
  const porHandle = new Map<string, ComentarioArena[]>()
  for (const c of opts.comentarios) {
    const lista = porHandle.get(c.handle)
    if (lista) lista.push(c)
    else porHandle.set(c.handle, [c])
  }

  const parcial = opts.handles.map((handle) => {
    const lista = (porHandle.get(handle) ?? []).sort((a, b) =>
      a.comentadoEm.localeCompare(b.comentadoEm),
    )
    const porPost = new Map<string, number>()
    const dias = new Set<string>()
    let pontosComentario = 0
    let bonusCedo = 0
    let comentariosPontuados = 0
    let comentariosCedo = 0
    for (const c of lista) {
      dias.add(diaBrasilia(c.comentadoEm))
      const jaNoPost = porPost.get(c.mediaId) ?? 0
      porPost.set(c.mediaId, jaNoPost + 1)
      if (jaNoPost >= PONTOS.limitePorPost) continue
      const p = pontosDoComentario(c)
      pontosComentario += p.base
      bonusCedo += p.cedo
      comentariosPontuados += 1
      if (p.cedo > 0) comentariosCedo += 1
    }
    const pontosCurtida = 0
    const subtotal = pontosComentario + bonusCedo + pontosCurtida
    const taxaEngajamento =
      opts.postsNoPeriodo > 0 ? Math.min(1, porPost.size / opts.postsNoPeriodo) : 0
    const bonusFidelidade =
      taxaEngajamento >= PONTOS.fidelidadeTaxa ? Math.round(subtotal * PONTOS.fidelidadeBonus) : 0
    return {
      handle,
      pontos: subtotal + bonusFidelidade,
      pontosComentario,
      bonusCedo,
      pontosCurtida,
      bonusFidelidade,
      comentarios: lista.length,
      comentariosPontuados,
      comentariosCedo,
      postsComentados: porPost.size,
      postsNoPeriodo: opts.postsNoPeriodo,
      taxaEngajamento,
      sequenciaDias: sequenciaDias(dias, opts.ate),
      ultimoComentario: lista.at(-1)?.comentadoEm ?? null,
    }
  })

  const top10 = new Set(
    [...parcial]
      .filter((p) => p.pontos > 0)
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, 10)
      .map((p) => p.handle),
  )

  const resultado = new Map<string, PontuacaoPerfil>()
  for (const { handle, ...p } of parcial) {
    const conquistas: ArenaBadgeId[] = []
    if (p.comentarios >= 150) conquistas.push('voz_ativa')
    if (p.sequenciaDias >= 3) conquistas.push('sequencia_3')
    if (p.comentariosCedo >= 10) conquistas.push('comentarista_relampago')
    if (p.taxaEngajamento >= PONTOS.fidelidadeTaxa) conquistas.push('fiel')
    if (top10.has(handle)) conquistas.push('top_10')
    resultado.set(handle, { ...p, ...resolverNivel(p.pontos), conquistas })
  }
  return resultado
}
