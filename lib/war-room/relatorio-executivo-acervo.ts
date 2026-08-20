import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeIptMunicipio } from '@/lib/ipt'

export type RelatorioAcervoSalvo = {
  id: string
  municipio: string
  municipio_normalizado: string
  obra_id: string | null
  titulo: string
  status: string
  url: string
  label: string | null
  sort_order: number
  updated_at: string
}

const SELECT_COLS =
  'id, municipio, municipio_normalizado, obra_id, titulo, status, url, label, sort_order, updated_at'

function mapRow(row: Record<string, unknown>): RelatorioAcervoSalvo {
  return {
    id: String(row.id),
    municipio: String(row.municipio ?? ''),
    municipio_normalizado: String(row.municipio_normalizado ?? ''),
    obra_id: row.obra_id != null && String(row.obra_id).trim() ? String(row.obra_id) : null,
    titulo: String(row.titulo ?? ''),
    status: String(row.status ?? 'ACERVO'),
    url: String(row.url ?? ''),
    label: row.label != null && String(row.label).trim() ? String(row.label) : null,
    sort_order: Number(row.sort_order) || 0,
    updated_at: String(row.updated_at ?? ''),
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function listRelatorioAcervoMunicipio(
  supabase: SupabaseClient,
  municipio: string,
): Promise<RelatorioAcervoSalvo[]> {
  const key = normalizeIptMunicipio(municipio)
  if (!key) return []

  const { data, error } = await supabase
    .from('relatorio_executivo_acervo')
    .select(SELECT_COLS)
    .eq('municipio_normalizado', key)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

export async function salvarRelatorioAcervoItem(
  supabase: SupabaseClient,
  opts: {
    id?: string | null
    municipio: string
    obraId?: string | null
    titulo: string
    status?: string | null
    url: string
    label?: string | null
    sortOrder?: number | null
    userId: string
  },
): Promise<RelatorioAcervoSalvo> {
  const municipio = opts.municipio.trim()
  const municipio_normalizado = normalizeIptMunicipio(municipio)
  if (!municipio || !municipio_normalizado) {
    throw new Error('Município é obrigatório')
  }

  const url = opts.url.trim()
  if (!isHttpUrl(url)) {
    throw new Error('Informe uma URL válida começando com http:// ou https://')
  }

  const titulo = opts.titulo.trim()
  if (!titulo) throw new Error('Título é obrigatório')

  const obra_id = opts.obraId?.trim() || null
  const status = opts.status?.trim() || 'ACERVO'
  const label = opts.label?.trim() || null
  const sort_order = Number.isFinite(opts.sortOrder) ? Number(opts.sortOrder) : 0
  const now = new Date().toISOString()

  const payload = {
    municipio,
    municipio_normalizado,
    obra_id,
    titulo,
    status,
    url,
    label,
    sort_order,
    updated_at: now,
    updated_by: opts.userId,
  }

  if (opts.id?.trim()) {
    const { data, error } = await supabase
      .from('relatorio_executivo_acervo')
      .update(payload)
      .eq('id', opts.id.trim())
      .select(SELECT_COLS)
      .single()
    if (error) throw error
    return mapRow(data as Record<string, unknown>)
  }

  if (obra_id) {
    const existing = await supabase
      .from('relatorio_executivo_acervo')
      .select('id')
      .eq('municipio_normalizado', municipio_normalizado)
      .eq('obra_id', obra_id)
      .maybeSingle()
    if (existing.error) throw existing.error

    if (existing.data?.id) {
      const { data, error } = await supabase
        .from('relatorio_executivo_acervo')
        .update(payload)
        .eq('id', existing.data.id)
        .select(SELECT_COLS)
        .single()
      if (error) throw error
      return mapRow(data as Record<string, unknown>)
    }
  }

  const { data, error } = await supabase
    .from('relatorio_executivo_acervo')
    .insert(payload)
    .select(SELECT_COLS)
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function removerRelatorioAcervoItem(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('relatorio_executivo_acervo')
    .delete()
    .eq('id', id.trim())
  if (error) throw error
}
