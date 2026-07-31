import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeSeiProtocolo } from '@/lib/sei-protocolo-url'
import type { ObrasRecapItem } from '@/lib/obras-recap-store'

export type ObrasSeiDbPatch = {
  sei_url?: string | null
  sei_ultimo_andamento?: string | null
  sei_ultimo_andamento_data?: string | null
  sei_alerta_andamento_desatualizado?: boolean | null
  sei_data_mais_recente_concluido?: string | null
  sei_descricao_mais_recente_concluido?: string | null
  sei_todos_andamentos_concluidos?: boolean | null
  sei_ultimo_status?: string | null
  sei_ultimo_status_data?: string | null
  sei_plano_trabalho_url?: string | null
  sei_plano_trabalho_tipo?: string | null
  sei_plano_trabalho_numero?: string | null
}

export type ObraSeiRow = {
  id: string
  sei?: string | null
  tipo?: string | null
  sei_url?: string | null
  sei_ultimo_andamento?: string | null
  sei_ultimo_andamento_data?: string | null
  sei_alerta_andamento_desatualizado?: boolean | null
  sei_data_mais_recente_concluido?: string | null
  sei_descricao_mais_recente_concluido?: string | null
  sei_todos_andamentos_concluidos?: boolean | null
  sei_ultimo_status?: string | null
  sei_ultimo_status_data?: string | null
  sei_plano_trabalho_url?: string | null
  sei_plano_trabalho_tipo?: string | null
  sei_plano_trabalho_numero?: string | null
  updated_at?: string | null
}

const SEI_SELECT =
  'id, sei, tipo, sei_url, sei_ultimo_andamento, sei_ultimo_andamento_data, sei_alerta_andamento_desatualizado, sei_data_mais_recente_concluido, sei_descricao_mais_recente_concluido, sei_todos_andamentos_concluidos, sei_ultimo_status, sei_ultimo_status_data, sei_plano_trabalho_url, sei_plano_trabalho_tipo, sei_plano_trabalho_numero, updated_at'

export function seiLookupKey(sei: string | null | undefined): string {
  return normalizeSeiProtocolo(sei ?? '')
}

/** Busca obra no banco pelo número SEI (match normalizado). */
export async function findObraBySei(
  supabase: SupabaseClient,
  sei: string,
  preferTipo?: string,
): Promise<ObraSeiRow | null> {
  const key = seiLookupKey(sei)
  if (!key) return null

  const { data, error } = await supabase
    .from('obras')
    .select(SEI_SELECT)
    .eq('sei', sei.trim())
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error) throw error

  let rows = (data ?? []) as ObraSeiRow[]
  if (rows.length === 0) {
    // Fallback: alguns registros podem ter espaços ou formatação levemente diferente
    const { data: all, error: err2 } = await supabase
      .from('obras')
      .select(SEI_SELECT)
      .not('sei', 'is', null)
      .ilike('sei', `%${key.slice(-12)}%`)
      .limit(50)
    if (err2) throw err2
    rows = ((all ?? []) as ObraSeiRow[]).filter(
      (row) => seiLookupKey(row.sei) === key,
    )
  }

  if (rows.length === 0) return null
  if (preferTipo) {
    const sameTipo = rows.find((r) => (r.tipo ?? '').trim() === preferTipo)
    if (sameTipo) return sameTipo
  }
  return rows[0]
}

/** Atualiza ou cria obra no banco com andamento SEI (não grava DOE). */
export async function upsertObraSeiAndamento(
  supabase: SupabaseClient,
  opts: {
    sei: string
    tabName: string
    recapItem: ObrasRecapItem
    patch: ObrasSeiDbPatch
  },
): Promise<ObraSeiRow> {
  const sei = opts.sei.trim()
  const existing = await findObraBySei(supabase, sei, opts.tabName)

  const seiPayload: Record<string, unknown> = { sei }
  const p = opts.patch
  if (p.sei_url !== undefined) seiPayload.sei_url = p.sei_url
  if (p.sei_ultimo_andamento !== undefined) {
    seiPayload.sei_ultimo_andamento = p.sei_ultimo_andamento
  }
  if (p.sei_ultimo_andamento_data !== undefined) {
    seiPayload.sei_ultimo_andamento_data = p.sei_ultimo_andamento_data
  }
  if (p.sei_alerta_andamento_desatualizado !== undefined) {
    seiPayload.sei_alerta_andamento_desatualizado = Boolean(
      p.sei_alerta_andamento_desatualizado,
    )
  }
  if (p.sei_data_mais_recente_concluido !== undefined) {
    seiPayload.sei_data_mais_recente_concluido = p.sei_data_mais_recente_concluido
  }
  if (p.sei_descricao_mais_recente_concluido !== undefined) {
    seiPayload.sei_descricao_mais_recente_concluido =
      p.sei_descricao_mais_recente_concluido
  }
  if (p.sei_todos_andamentos_concluidos !== undefined) {
    seiPayload.sei_todos_andamentos_concluidos = Boolean(
      p.sei_todos_andamentos_concluidos,
    )
  }
  if (p.sei_ultimo_status !== undefined) {
    seiPayload.sei_ultimo_status = p.sei_ultimo_status
  }
  if (p.sei_ultimo_status_data !== undefined) {
    seiPayload.sei_ultimo_status_data = p.sei_ultimo_status_data
  }
  if (p.sei_plano_trabalho_url !== undefined) {
    seiPayload.sei_plano_trabalho_url = p.sei_plano_trabalho_url
  }
  if (p.sei_plano_trabalho_tipo !== undefined) {
    seiPayload.sei_plano_trabalho_tipo = p.sei_plano_trabalho_tipo
  }
  if (p.sei_plano_trabalho_numero !== undefined) {
    seiPayload.sei_plano_trabalho_numero = p.sei_plano_trabalho_numero
  }

  if (existing) {
    const { data, error } = await supabase
      .from('obras')
      .update(seiPayload)
      .eq('id', existing.id)
      .select(SEI_SELECT)
      .single()
    if (error) throw error
    return data as ObraSeiRow
  }

  const { data, error } = await supabase
    .from('obras')
    .insert({
      municipio: opts.recapItem.municipio ?? null,
      obra: opts.recapItem.obra,
      orgao: opts.recapItem.orgao ?? null,
      tipo: opts.tabName,
      status: opts.recapItem.status ?? null,
      valor_total: opts.recapItem.valor_total ?? null,
      valor_pago: opts.recapItem.valor_pago ?? null,
      ...seiPayload,
    })
    .select(SEI_SELECT)
    .single()
  if (error) throw error
  return data as ObraSeiRow
}

/** Carrega mapa SEI → campos de andamento do banco. */
export async function loadSeiFieldsBySeiKeys(
  supabase: SupabaseClient,
  seiList: string[],
): Promise<Map<string, ObraSeiRow>> {
  const map = new Map<string, ObraSeiRow>()
  const unique = [...new Set(seiList.map((s) => s.trim()).filter(Boolean))]
  if (unique.length === 0) return map

  // Chunk para respeitar limites do .in()
  const chunkSize = 80
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('obras')
      .select(SEI_SELECT)
      .in('sei', chunk)
      .order('updated_at', { ascending: false })
    if (error) throw error
    for (const row of (data ?? []) as ObraSeiRow[]) {
      const key = seiLookupKey(row.sei)
      if (!key || map.has(key)) continue
      map.set(key, row)
    }
  }

  // Complementa chaves que não bateram exatamente (espaços / formatação)
  const missing = unique.filter((s) => !map.has(seiLookupKey(s)))
  if (missing.length > 0) {
    const { data, error } = await supabase
      .from('obras')
      .select(SEI_SELECT)
      .not('sei', 'is', null)
      .not('sei_ultimo_andamento', 'is', null)
      .limit(2000)
    if (!error && data) {
      const byKey = new Map<string, ObraSeiRow>()
      for (const row of data as ObraSeiRow[]) {
        const key = seiLookupKey(row.sei)
        if (!key) continue
        const prev = byKey.get(key)
        if (!prev || (row.updated_at ?? '') > (prev.updated_at ?? '')) {
          byKey.set(key, row)
        }
      }
      for (const sei of missing) {
        const row = byKey.get(seiLookupKey(sei))
        if (row) map.set(seiLookupKey(sei), row)
      }
    }
  }

  return map
}

export function pickSeiFieldsFromDbRow(row: ObraSeiRow): ObrasSeiDbPatch & {
  db_obra_id?: string
} {
  return {
    db_obra_id: row.id,
    sei_url: row.sei_url ?? null,
    sei_ultimo_andamento: row.sei_ultimo_andamento ?? null,
    sei_ultimo_andamento_data: row.sei_ultimo_andamento_data ?? null,
    sei_alerta_andamento_desatualizado:
      row.sei_alerta_andamento_desatualizado ?? null,
    sei_data_mais_recente_concluido: row.sei_data_mais_recente_concluido ?? null,
    sei_descricao_mais_recente_concluido:
      row.sei_descricao_mais_recente_concluido ?? null,
    sei_todos_andamentos_concluidos: row.sei_todos_andamentos_concluidos ?? null,
    sei_ultimo_status: row.sei_ultimo_status ?? null,
    sei_ultimo_status_data: row.sei_ultimo_status_data ?? null,
    sei_plano_trabalho_url: row.sei_plano_trabalho_url ?? null,
    sei_plano_trabalho_tipo: row.sei_plano_trabalho_tipo ?? null,
    sei_plano_trabalho_numero: row.sei_plano_trabalho_numero ?? null,
  }
}
