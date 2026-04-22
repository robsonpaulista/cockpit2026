import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

export type LiderInstagramCoberturaDto = {
  id: string
  nome: string
  territorio: TerritorioDesenvolvimentoPI | null
  handles: string[]
}

export type MobilizacaoLideresInstagramPorTdPayload = {
  lideres: LiderInstagramCoberturaDto[]
}

export type FetchMobilizacaoLideresInstagramResult =
  | { ok: true; data: MobilizacaoLideresInstagramPorTdPayload }
  | { ok: false; status: number; message?: string }

export async function fetchMobilizacaoLideresInstagramPorTd(
  td: TerritorioDesenvolvimentoPI | null
): Promise<FetchMobilizacaoLideresInstagramResult> {
  try {
    const q = new URLSearchParams()
    if (td) q.set('td', td)
    const res = await fetch(`/api/mobilizacao/lideres-instagram-por-td?${q.toString()}`, { cache: 'no-store' })
    if (res.status === 401) return { ok: false, status: 401, message: 'Não autenticado' }
    if (res.status === 403) return { ok: false, status: 403, message: 'Sem permissão para Mobilização' }
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      return { ok: false, status: res.status, message: j.error ?? res.statusText }
    }
    const data = (await res.json()) as MobilizacaoLideresInstagramPorTdPayload
    return { ok: true, data }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Falha na rede'
    return { ok: false, status: 0, message }
  }
}
