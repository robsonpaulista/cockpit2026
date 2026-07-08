import obrasJadyelData from '@/data/obras-jadyel.json'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  filtrarObrasMapaTemas,
  toObraMapaRow,
  type JadyelObraMapaRow,
  type JadyelObraPeriodo,
  type JadyelObraPlanilhaRow,
} from '@/lib/jadyel-obras-planilha'

export type { JadyelObraMapaRow, JadyelObraPeriodo }

interface ObrasJadyelFile {
  obras: JadyelObraPlanilhaRow[]
}

const BASE_OBRAS = (obrasJadyelData as ObrasJadyelFile).obras ?? []

export const JADYEL_OBRA_STATUS_SUGESTOES = [
  'A iniciar',
  'Em andamento',
  'Em projeto',
  'Finalizada',
  'Concluída',
  'Paralisada',
] as const

export function listarObrasJadyelBase(): JadyelObraPlanilhaRow[] {
  return BASE_OBRAS
}

export function listarObrasJadyelMapaBase(): JadyelObraMapaRow[] {
  return BASE_OBRAS.map(toObraMapaRow)
}

async function carregarStatusMapa(
  supabase: SupabaseClient
): Promise<Map<string, string | null>> {
  const { data, error } = await supabase
    .from('obras_mapa_jadyel_status')
    .select('obra_id, status')

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      return new Map()
    }
    throw new Error(error.message)
  }

  return new Map((data ?? []).map((row) => [row.obra_id as string, (row.status as string | null) ?? null]))
}

export function aplicarStatusNasObras(
  obras: JadyelObraMapaRow[],
  statusPorId: Map<string, string | null>
): JadyelObraMapaRow[] {
  return obras.map((obra) => ({
    ...obra,
    status: statusPorId.get(obra.id) ?? obra.status ?? null,
  }))
}

export async function carregarObrasJadyelMapa(
  supabase: SupabaseClient
): Promise<JadyelObraMapaRow[]> {
  const statusPorId = await carregarStatusMapa(supabase)
  return aplicarStatusNasObras(listarObrasJadyelMapaBase(), statusPorId)
}

export async function carregarObrasJadyelLista(
  supabase: SupabaseClient,
  opts?: { incluirOutros?: boolean; periodo?: JadyelObraPeriodo | 'todos' }
): Promise<JadyelObraMapaRow[]> {
  const statusPorId = await carregarStatusMapa(supabase)
  let fonte = BASE_OBRAS.map(toObraMapaRow)
  if (!opts?.incluirOutros) fonte = filtrarObrasMapaTemas(fonte)
  if (opts?.periodo && opts.periodo !== 'todos') {
    fonte = fonte.filter((obra) => obra.periodo === opts.periodo)
  }
  return aplicarStatusNasObras(fonte, statusPorId).sort((a, b) => {
    const byPeriodo = b.periodo.localeCompare(a.periodo)
    if (byPeriodo !== 0) return byPeriodo
    const byMun = a.municipio.localeCompare(b.municipio, 'pt-BR')
    if (byMun !== 0) return byMun
    return (a.obra ?? '').localeCompare(b.obra ?? '', 'pt-BR')
  })
}

export async function salvarStatusObraJadyel(
  supabase: SupabaseClient,
  obraId: string,
  status: string | null,
  userId: string
): Promise<void> {
  const trimmed = status?.trim() ?? ''
  if (!trimmed) {
    const { error } = await supabase.from('obras_mapa_jadyel_status').delete().eq('obra_id', obraId)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from('obras_mapa_jadyel_status').upsert(
    {
      obra_id: obraId,
      status: trimmed,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: 'obra_id' }
  )

  if (error) throw new Error(error.message)
}

export function obraJadyelExiste(obraId: string): boolean {
  return BASE_OBRAS.some((obra) => obra.id === obraId)
}
