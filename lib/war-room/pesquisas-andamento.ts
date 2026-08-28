import type { SupabaseClient } from '@supabase/supabase-js'

export type WarRoomPesquisaAndamentoStatus =
  | 'planejada'
  | 'em_campo'
  | 'processando'
  | 'entregue'
  | 'atrasada'

export type WarRoomPesquisaAndamento = {
  id: string
  cidade: string
  cidadeId: string | null
  instituto: string
  data: string
  dataLabel: string
  status: WarRoomPesquisaAndamentoStatus
  finalizadaAt: string | null
  updatedAt: string | null
}

export const WAR_ROOM_PESQUISA_ANDAMENTO_STATUS: WarRoomPesquisaAndamentoStatus[] = [
  'planejada',
  'em_campo',
  'processando',
  'entregue',
  'atrasada',
]

/** Pesquisas em campo permanecem no card até serem finalizadas. */
const STATUS_ATIVO = new Set<WarRoomPesquisaAndamentoStatus>([
  'planejada',
  'em_campo',
  'processando',
  'atrasada',
])

/** Tempo que uma pesquisa finalizada permanece visível no card. */
export const PESQUISA_ANDAMENTO_FINALIZADA_TTL_MS = 24 * 60 * 60 * 1000

const SELECT_COLS =
  'id, data, instituto, cidade, cidade_id, status, finalizada_at, created_at, updated_at'

function dataCurta(data: string): string {
  return data.includes('T') ? (data.split('T')[0] ?? data) : data
}

export function formatPesquisaAndamentoDataLabel(isoDate: string): string {
  const parts = dataCurta(isoDate).split('-')
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}`
  }
  return isoDate
}

function isStatus(value: string): value is WarRoomPesquisaAndamentoStatus {
  return WAR_ROOM_PESQUISA_ANDAMENTO_STATUS.includes(value as WarRoomPesquisaAndamentoStatus)
}

function mapRow(row: Record<string, unknown>): WarRoomPesquisaAndamento {
  const data = dataCurta(String(row.data ?? ''))
  const statusRaw = String(row.status ?? 'em_campo')
  return {
    id: String(row.id),
    cidade: String(row.cidade ?? '').trim(),
    cidadeId:
      row.cidade_id != null && String(row.cidade_id).trim()
        ? String(row.cidade_id)
        : null,
    instituto: String(row.instituto ?? '').trim(),
    data,
    dataLabel: formatPesquisaAndamentoDataLabel(data),
    status: isStatus(statusRaw) ? statusRaw : 'em_campo',
    finalizadaAt:
      row.finalizada_at != null && String(row.finalizada_at).trim()
        ? String(row.finalizada_at)
        : null,
    updatedAt:
      row.updated_at != null && String(row.updated_at).trim()
        ? String(row.updated_at)
        : null,
  }
}

function finalizadaTimestamp(row: WarRoomPesquisaAndamento): number | null {
  if (row.status !== 'entregue') return null
  const raw = row.finalizadaAt ?? row.updatedAt
  if (!raw) return null
  const ts = Date.parse(raw)
  return Number.isFinite(ts) ? ts : null
}

export function isPesquisaAndamentoEmCampo(row: WarRoomPesquisaAndamento): boolean {
  return STATUS_ATIVO.has(row.status)
}

export function isPesquisaAndamentoFinalizadaRecente(
  row: WarRoomPesquisaAndamento,
  now = Date.now(),
): boolean {
  if (row.status !== 'entregue') return false
  const ts = finalizadaTimestamp(row)
  if (ts == null) return false
  return now - ts < PESQUISA_ANDAMENTO_FINALIZADA_TTL_MS
}

/** Pesquisas ativas + finalizadas há menos de 24h (visíveis no card). */
export function andamentoVisiveisNoCard(
  rows: WarRoomPesquisaAndamento[],
  now = Date.now(),
): WarRoomPesquisaAndamento[] {
  return rows.filter((r) => {
    if (STATUS_ATIVO.has(r.status)) return true
    return isPesquisaAndamentoFinalizadaRecente(r, now)
  })
}

/** @deprecated Use andamentoVisiveisNoCard */
export function andamentoAtivos(
  rows: WarRoomPesquisaAndamento[],
): WarRoomPesquisaAndamento[] {
  return andamentoVisiveisNoCard(rows)
}

export type WarRoomPesquisaAndamentoInput = {
  id?: string | null
  data: string
  instituto: string
  cidade: string
  cidadeId?: string | null
  status?: WarRoomPesquisaAndamentoStatus | null
}

export async function listPesquisasAndamentoDb(
  supabase: SupabaseClient,
): Promise<WarRoomPesquisaAndamento[]> {
  const { data, error } = await supabase
    .from('war_room_pesquisas_andamento')
    .select(SELECT_COLS)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

export async function salvarPesquisaAndamentoDb(
  supabase: SupabaseClient,
  opts: WarRoomPesquisaAndamentoInput & { userId: string },
): Promise<WarRoomPesquisaAndamento> {
  const data = dataCurta(opts.data.trim())
  const instituto = opts.instituto.trim()
  const cidade = opts.cidade.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new Error('Data inválida')
  }
  if (!instituto) throw new Error('Instituto é obrigatório')
  if (!cidade) throw new Error('Cidade é obrigatória')

  const status = opts.status && isStatus(opts.status) ? opts.status : 'em_campo'
  const now = new Date().toISOString()

  let finalizadaAt: string | null = null
  if (status === 'entregue') {
    if (opts.id) {
      const { data: existing, error: readError } = await supabase
        .from('war_room_pesquisas_andamento')
        .select('status, finalizada_at')
        .eq('id', opts.id)
        .maybeSingle()
      if (readError) throw readError
      const wasEntregue = existing?.status === 'entregue'
      finalizadaAt =
        wasEntregue && existing?.finalizada_at
          ? String(existing.finalizada_at)
          : now
    } else {
      finalizadaAt = now
    }
  }

  const payload = {
    data,
    instituto,
    cidade,
    cidade_id: opts.cidadeId?.trim() || null,
    status,
    finalizada_at: finalizadaAt,
    updated_at: now,
  }

  if (opts.id) {
    const { data: row, error } = await supabase
      .from('war_room_pesquisas_andamento')
      .update(payload)
      .eq('id', opts.id)
      .select(SELECT_COLS)
      .single()
    if (error) throw error
    return mapRow(row as Record<string, unknown>)
  }

  const { data: row, error } = await supabase
    .from('war_room_pesquisas_andamento')
    .insert({
      ...payload,
      created_by: opts.userId,
    })
    .select(SELECT_COLS)
    .single()
  if (error) throw error
  return mapRow(row as Record<string, unknown>)
}

export async function removerPesquisaAndamentoDb(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('war_room_pesquisas_andamento')
    .delete()
    .eq('id', id)
  if (error) throw error
}
