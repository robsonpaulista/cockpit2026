import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

export type LideradoNoMunicipioDto = {
  id: string
  nome: string
  whatsapp: string
  instagram: string | null
  cidade: string | null
  status: string
  /** Comentários IG cujo @ coincide com o Instagram deste liderado (dedupe por `instagram_comment_id`, escopo do usuário logado). */
  comentarios: number
  /** Mídias distintas (`instagram_media_id`) com ≥1 comentário desse @ (engajamento por cobertura de posts, não volume de comentários). */
  midiasComComentario: number
  /** Perfis distintos entre comentaristas — no máximo 1 por liderado (próprio @). */
  perfisUnicos: number
  /**
   * Tempo médio entre `media_posted_at` e `commented_at` nos comentários vinculados ao @ (ms).
   * `null` se não houver comentário com as duas datas ou sem comentários.
   */
  tempoMedioPostComentarioMs: number | null
}

export type LiderNoMunicipioDto = {
  id: string
  nome: string
  telefone: string | null
  liderados: LideradoNoMunicipioDto[]
}

export type MobilizacaoLideresLideradosNoMunicipioPayload = {
  territorio: TerritorioDesenvolvimentoPI
  municipioOficial: string
  lideres: LiderNoMunicipioDto[]
}

export type FetchMobilizacaoLideresLideradosNoMunicipioResult =
  | { ok: true; data: MobilizacaoLideresLideradosNoMunicipioPayload }
  | { ok: false; status: number; message?: string }

export async function fetchMobilizacaoLideresLideradosNoMunicipio(
  td: TerritorioDesenvolvimentoPI,
  municipioNome: string
): Promise<FetchMobilizacaoLideresLideradosNoMunicipioResult> {
  try {
    const q = new URLSearchParams()
    q.set('td', td)
    q.set('municipio', municipioNome)
    const res = await fetch(`/api/mobilizacao/lideres-liderados-no-municipio?${q.toString()}`, { cache: 'no-store' })
    if (res.status === 401) return { ok: false, status: 401, message: 'Não autenticado' }
    if (res.status === 403) return { ok: false, status: 403, message: 'Sem permissão para Mobilização' }
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      return { ok: false, status: res.status, message: j.error ?? res.statusText }
    }
    const data = (await res.json()) as MobilizacaoLideresLideradosNoMunicipioPayload
    return { ok: true, data }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Falha na rede'
    return { ok: false, status: 0, message }
  }
}
