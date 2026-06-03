import type { AndamentoPublicoResponse } from '@/lib/juridico-datajud'
import type { ComunicacoesProcessoResponse } from '@/lib/juridico-comunica'
import type { JuridicoMovimentacoesResponse, RegistrarMovimentacaoInput } from '@/lib/juridico-movimentacoes'
import type {
  ProcessoDimensao,
  ProcessosDimensaoKpis,
} from '@/lib/juridico-processos-dimensao'

export type JuridicoProcessosResponse = {
  geradoEm: string
  parteFiltro: string
  kpis: ProcessosDimensaoKpis
  filtros: {
    status: string[]
    areas: string[]
    prioridades: string[]
  }
  total: number
  processos: ProcessoDimensao[]
}

export type JuridicoProcessosQuery = {
  q?: string
  status?: string
  area?: string
  prioridade?: string
}

export async function fetchJuridicoProcessos(
  query: JuridicoProcessosQuery = {}
): Promise<JuridicoProcessosResponse> {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.status && query.status !== 'all') params.set('status', query.status)
  if (query.area && query.area !== 'all') params.set('area', query.area)
  if (query.prioridade && query.prioridade !== 'all') params.set('prioridade', query.prioridade)

  const qs = params.toString()
  const res = await fetch(`/api/juridico/processos${qs ? `?${qs}` : ''}`, { cache: 'no-store' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Falha ao carregar processos jurídicos')
  }
  return res.json() as Promise<JuridicoProcessosResponse>
}

export async function fetchJuridicoAndamento(processoId: string): Promise<AndamentoPublicoResponse> {
  const encoded = encodeURIComponent(processoId)
  const res = await fetch(`/api/juridico/processos/${encoded}/andamento`, { cache: 'no-store' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Falha ao consultar andamento')
  }
  return res.json() as Promise<AndamentoPublicoResponse>
}

export async function fetchJuridicoComunicacoes(
  processoId: string
): Promise<ComunicacoesProcessoResponse> {
  const encoded = encodeURIComponent(processoId)
  const res = await fetch(`/api/juridico/processos/${encoded}/comunicacoes`, { cache: 'no-store' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Falha ao consultar comunicações DJEN')
  }
  return res.json() as Promise<ComunicacoesProcessoResponse>
}

export async function fetchJuridicoMovimentacoes(
  processoId: string
): Promise<JuridicoMovimentacoesResponse> {
  const encoded = encodeURIComponent(processoId)
  const res = await fetch(`/api/juridico/processos/${encoded}/movimentacoes`, { cache: 'no-store' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Falha ao carregar histórico de movimentações')
  }
  return res.json() as Promise<JuridicoMovimentacoesResponse>
}

export async function registrarJuridicoMovimentacao(
  processoId: string,
  input: RegistrarMovimentacaoInput
): Promise<JuridicoMovimentacoesResponse & { ok: boolean }> {
  const encoded = encodeURIComponent(processoId)
  const res = await fetch(`/api/juridico/processos/${encoded}/movimentacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Falha ao registrar movimentação')
  }
  return res.json() as Promise<JuridicoMovimentacoesResponse & { ok: boolean }>
}
