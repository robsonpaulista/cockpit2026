import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'
import type {
  JuridicoMovimentacao,
  JuridicoMovimentacaoFonte,
  RegistrarMovimentacaoInput,
} from '@/lib/juridico-movimentacoes'

type MovRow = {
  id: string
  processo_id: string
  descricao: string
  data_movimentacao: string | null
  status_processo: string | null
  observacoes: string | null
  fonte: JuridicoMovimentacaoFonte
  created_at: string
  created_by: string | null
  profiles?: { name: string | null } | { name: string | null }[] | null
}

export type UltimaMovimentacaoResumo = {
  descricao: string
  dataMovimentacao: string | null
  statusProcesso: string | null
}

function mapRow(row: MovRow): JuridicoMovimentacao {
  const prof = row.profiles
  const name = Array.isArray(prof) ? prof[0]?.name : prof?.name
  return {
    id: row.id,
    processoId: row.processo_id,
    descricao: row.descricao,
    dataMovimentacao: row.data_movimentacao,
    statusProcesso: row.status_processo,
    observacoes: row.observacoes,
    fonte: row.fonte,
    createdAt: row.created_at,
    createdByName: name ?? null,
  }
}

function pickMaisRecente(rows: MovRow[]): MovRow | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => {
    const da = a.data_movimentacao ?? a.created_at.slice(0, 10)
    const db = b.data_movimentacao ?? b.created_at.slice(0, 10)
    if (da !== db) return db.localeCompare(da)
    return b.created_at.localeCompare(a.created_at)
  })
  return sorted[0] ?? null
}

export async function listMovimentacoesProcesso(
  supabase: SupabaseClient,
  processoId: string
): Promise<JuridicoMovimentacao[]> {
  const { data, error } = await supabase
    .from('juridico_processo_movimentacoes')
    .select('*, profiles:created_by(name)')
    .eq('processo_id', processoId)
    .order('data_movimentacao', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as MovRow[]).map(mapRow)
}

export async function registrarMovimentacao(
  supabase: SupabaseClient,
  processoId: string,
  userId: string,
  input: RegistrarMovimentacaoInput
): Promise<JuridicoMovimentacao> {
  const descricao = input.descricao.trim()
  if (!descricao) throw new Error('Descrição da movimentação é obrigatória')

  const { data, error } = await supabase
    .from('juridico_processo_movimentacoes')
    .insert({
      processo_id: processoId,
      descricao,
      data_movimentacao: input.dataMovimentacao?.trim() || null,
      status_processo: input.statusProcesso?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      fonte: 'manual',
      created_by: userId,
    })
    .select('*, profiles:created_by(name)')
    .single()

  if (error) throw error
  return mapRow(data as MovRow)
}

export async function getUltimasMovimentacoesMap(
  supabase: SupabaseClient,
  processoIds: string[]
): Promise<Map<string, UltimaMovimentacaoResumo>> {
  const map = new Map<string, UltimaMovimentacaoResumo>()
  if (processoIds.length === 0) return map

  const unique = [...new Set(processoIds)]
  const { data, error } = await supabase
    .from('juridico_processo_movimentacoes')
    .select('processo_id, descricao, data_movimentacao, status_processo, created_at')
    .in('processo_id', unique)

  if (error) {
    if (error.code === '42P01') return map
    throw error
  }

  const byProcesso = new Map<string, MovRow[]>()
  for (const row of data as MovRow[]) {
    const list = byProcesso.get(row.processo_id) ?? []
    list.push(row)
    byProcesso.set(row.processo_id, list)
  }

  for (const [pid, rows] of byProcesso) {
    const latest = pickMaisRecente(rows)
    if (latest) {
      map.set(pid, {
        descricao: latest.descricao,
        dataMovimentacao: latest.data_movimentacao,
        statusProcesso: latest.status_processo,
      })
    }
  }
  return map
}

export async function enrichProcessosComMovimentacoes<T extends ProcessoDimensao>(
  supabase: SupabaseClient,
  processos: T[]
): Promise<T[]> {
  const ids = processos.map((p) => p.id)
  let latestMap: Map<string, UltimaMovimentacaoResumo>
  try {
    latestMap = await getUltimasMovimentacoesMap(supabase, ids)
  } catch (e) {
    console.warn('[juridico] movimentações indisponíveis (tabela existe?)', e)
    return processos
  }

  if (latestMap.size === 0) return processos

  return processos.map((p) => {
    const u = latestMap.get(p.id)
    if (!u) return p
    return {
      ...p,
      ultimaMovimentacao: u.descricao,
      dataConsulta: u.dataMovimentacao ?? p.dataConsulta,
      status: u.statusProcesso ?? p.status,
    }
  })
}
