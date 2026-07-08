import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

/** Métricas por liderado (@) — no mapa digital IG usa histórico completo; no monitoramento usa o mês de referência. */
export type LideradoIgEngajamentoLinha = {
  handle: string
  /** Nome do liderado em `leads_militancia`, quando disponível. */
  nome?: string | null
  comentarios: number
  /** Quantidade de publicações (mídias) distintas em que este @ comentou. */
  publicacoesComComentario: number
  /** Data/hora ISO da publicação do comentário mais recente deste @ (campo `media_posted_at` da linha). */
  ultimaPublicacaoComentadaEm: string | null
}

export type LiderDesempenhoIgLinha = {
  id: string
  nome: string
  lideradosComRede: number
  publicacoes: number
  comentarios: number
  lideradosQueComentaram: number
  /** Mídias distintas com comentário do grupo ÷ publicações processadas na conta × 100. */
  pctParticipacao: number
  /** @ normalizados dos liderados com Instagram ativo vinculados ao líder (recorte do TD ou município). */
  lideradosInstagram: string[]
  /** Por @: comentários, mídias distintas e última publicação comentada (mesma ordem base que `lideradosInstagram`). */
  lideradosEngajamento?: LideradoIgEngajamentoLinha[]
}

/** Agrega métricas por @ ao unir respostas de vários TDs (ranking geral). */
export function mergeLideradosEngajamentoPorHandle(
  a: LideradoIgEngajamentoLinha[] | undefined,
  b: LideradoIgEngajamentoLinha[] | undefined
): LideradoIgEngajamentoLinha[] {
  const pickNome = (x: string | null | undefined, y: string | null | undefined): string | null => {
    const nx = (x ?? '').trim()
    const ny = (y ?? '').trim()
    if (!nx) return ny || null
    if (!ny) return nx || null
    return nx.length >= ny.length ? nx : ny
  }

  const acc = new Map<
    string,
    {
      comentarios: number
      publicacoesComComentario: number
      ultimaPublicacaoComentadaEm: string | null
      nome: string | null
    }
  >()
  const feed = (rows: LideradoIgEngajamentoLinha[] | undefined) => {
    if (!rows) return
    for (const r of rows) {
      const h = r.handle.trim()
      if (!h) continue
      const cur = acc.get(h)
      if (!cur) {
        acc.set(h, {
          comentarios: r.comentarios,
          publicacoesComComentario: r.publicacoesComComentario,
          ultimaPublicacaoComentadaEm: r.ultimaPublicacaoComentadaEm,
          nome: (r.nome ?? '').trim() || null,
        })
        continue
      }
      cur.comentarios += r.comentarios
      cur.publicacoesComComentario += r.publicacoesComComentario
      cur.nome = pickNome(cur.nome, r.nome)
      const u1 = cur.ultimaPublicacaoComentadaEm
      const u2 = r.ultimaPublicacaoComentadaEm
      if (!u2) continue
      if (!u1 || u2 > u1) cur.ultimaPublicacaoComentadaEm = u2
    }
  }
  feed(a)
  feed(b)
  return Array.from(acc.entries())
    .map(([handle, v]) => ({
      handle,
      nome: v.nome,
      comentarios: v.comentarios,
      publicacoesComComentario: v.publicacoesComComentario,
      ultimaPublicacaoComentadaEm: v.ultimaPublicacaoComentadaEm,
    }))
    .sort((x, y) => x.handle.localeCompare(y.handle, 'pt-BR', { sensitivity: 'base' }))
}

export type MobilizacaoLideresDesempenhoIgPorTdPayload = {
  td: TerritorioDesenvolvimentoPI
  /** Preenchido quando os dados vêm do endpoint por município. */
  municipio?: string | null
  postagensProcessadas: number
  lideres: LiderDesempenhoIgLinha[]
  totais: {
    lideres: number
    lideradosComRede: number
    publicacoesDistintas: number
    comentarios: number
    lideradosQueComentaramDistintos: number
    pctGeral: number
  }
}

export type FetchMobilizacaoLideresDesempenhoIgPorTdResult =
  | { ok: true; data: MobilizacaoLideresDesempenhoIgPorTdPayload }
  | { ok: false; status: number; message?: string }

export async function fetchMobilizacaoLideresDesempenhoIgPorTd(
  td: TerritorioDesenvolvimentoPI
): Promise<FetchMobilizacaoLideresDesempenhoIgPorTdResult> {
  try {
    const q = new URLSearchParams({ td })
    const res = await fetch(`/api/mobilizacao/lideres-desempenho-ig-por-td?${q}`, { cache: 'no-store' })
    if (res.status === 401) return { ok: false, status: 401, message: 'Não autenticado' }
    if (res.status === 403) return { ok: false, status: 403, message: 'Sem permissão para Mobilização' }
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      return { ok: false, status: res.status, message: j.error ?? res.statusText }
    }
    const data = (await res.json()) as MobilizacaoLideresDesempenhoIgPorTdPayload
    return { ok: true, data }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Falha na rede'
    return { ok: false, status: 0, message }
  }
}

export async function fetchMobilizacaoLideresDesempenhoIgPorMunicipio(
  td: TerritorioDesenvolvimentoPI,
  municipio: string
): Promise<FetchMobilizacaoLideresDesempenhoIgPorTdResult> {
  try {
    const q = new URLSearchParams({ td, municipio })
    const res = await fetch(`/api/mobilizacao/lideres-desempenho-ig-por-municipio?${q}`, { cache: 'no-store' })
    if (res.status === 401) return { ok: false, status: 401, message: 'Não autenticado' }
    if (res.status === 403) return { ok: false, status: 403, message: 'Sem permissão para Mobilização' }
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      return { ok: false, status: res.status, message: j.error ?? res.statusText }
    }
    const data = (await res.json()) as MobilizacaoLideresDesempenhoIgPorTdPayload
    return { ok: true, data }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Falha na rede'
    return { ok: false, status: 0, message }
  }
}
