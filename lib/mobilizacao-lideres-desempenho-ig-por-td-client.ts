import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

export type LiderDesempenhoIgLinha = {
  id: string
  nome: string
  lideradosComRede: number
  publicacoes: number
  comentarios: number
  lideradosQueComentaram: number
  /** Mídias distintas com comentário do grupo ÷ publicações processadas na conta × 100. */
  pctParticipacao: number
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
