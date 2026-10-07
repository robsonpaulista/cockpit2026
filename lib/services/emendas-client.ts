import type { EmendaListExportRow } from '@/lib/emendas-list-export'

export type Emenda = EmendaListExportRow

/** Campos editáveis, como texto do formulário (a API converte números e datas). */
export type EmendaForm = {
  bloco: string
  exercicio: string
  emenda: string
  municipio_beneficiario: string
  funcional: string
  gnd: string
  valor_indicado: string
  valor_empenhado: string
  valor_a_empenhar: string
  valor_pago: string
  valor_a_ser_pago: string
  empenho: string
  data_empenho: string
  portaria_convenio: string
  numero_proposta: string
  data_pagamento: string
  liderancas: string
  alteracao: string
  objeto: string
}

async function lerJson(res: Response): Promise<Record<string, unknown>> {
  const json: unknown = await res.json().catch(() => null)
  return json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
}

function erroDe(json: Record<string, unknown>, padrao: string): Error {
  return new Error(typeof json.error === 'string' ? json.error : padrao)
}

export async function fetchEmendas(): Promise<Emenda[]> {
  const res = await fetch('/api/emendas', { cache: 'no-store' })
  const json = await lerJson(res)
  if (!res.ok) throw erroDe(json, 'Erro ao carregar emendas.')
  return Array.isArray(json.emendas) ? (json.emendas as Emenda[]) : []
}

export async function salvarEmenda(form: EmendaForm, id?: string | null): Promise<void> {
  const res = await fetch(id ? `/api/emendas/${id}` : '/api/emendas', {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  })
  if (!res.ok) throw erroDe(await lerJson(res), 'Erro ao salvar emenda.')
}

export async function excluirEmenda(id: string): Promise<void> {
  const res = await fetch(`/api/emendas/${id}`, { method: 'DELETE' })
  if (!res.ok) throw erroDe(await lerJson(res), 'Erro ao excluir emenda.')
}
