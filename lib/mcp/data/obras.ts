import { createAdminClient } from '@/lib/supabase/admin'

export type ObraMcpRow = {
  id: string
  municipio: string | null
  obra: string | null
  tipo: string | null
  status: string | null
  valor_total: number | null
  parceiro: string | null
  orgao: string | null
  territorio: string | null
  imagem_url: string | null
}

/**
 * Busca obras no Supabase (service role).
 */
export async function buscarObrasMcp(opts?: {
  municipio?: string
  tipo?: string
  status?: string
  q?: string
  limite?: number
}): Promise<{ total: number; obras: ObraMcpRow[] }> {
  const limite = Math.min(Math.max(opts?.limite ?? 30, 1), 100)
  const supabase = createAdminClient()

  let query = supabase
    .from('obras')
    .select(
      'id, municipio, obra, tipo, status, valor_total, parceiro, orgao, territorio, imagem_url'
    )
    .order('created_at', { ascending: false })
    .limit(limite)

  if (opts?.municipio?.trim()) {
    query = query.ilike('municipio', `%${opts.municipio.trim()}%`)
  }
  if (opts?.tipo?.trim()) {
    query = query.ilike('tipo', `%${opts.tipo.trim()}%`)
  }
  if (opts?.status?.trim()) {
    query = query.eq('status', opts.status.trim())
  }
  if (opts?.q?.trim()) {
    query = query.or(
      `obra.ilike.%${opts.q.trim()}%,municipio.ilike.%${opts.q.trim()}%,tipo.ilike.%${opts.q.trim()}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(`Erro ao buscar obras: ${error.message}`)

  const obras = (data ?? []) as ObraMcpRow[]
  return { total: obras.length, obras }
}

/**
 * Obras sem conteúdo publicado vinculado (`conteudos_planejados.status = publicado`).
 */
export async function buscarObrasSemDivulgacaoMcp(opts?: {
  municipio?: string
  tipo?: string
  limite?: number
}): Promise<{ total: number; obras: ObraMcpRow[] }> {
  const limite = Math.min(Math.max(opts?.limite ?? 30, 1), 100)
  const supabase = createAdminClient()

  const { data: publicados, error: pErr } = await supabase
    .from('conteudos_planejados')
    .select('obra_id')
    .eq('status', 'publicado')
    .not('obra_id', 'is', null)

  if (pErr) throw new Error(`Erro ao ler conteúdos publicados: ${pErr.message}`)

  const comPub = new Set(
    (publicados ?? [])
      .map((r) => r.obra_id as string | null)
      .filter((id): id is string => Boolean(id))
  )

  let query = supabase
    .from('obras')
    .select(
      'id, municipio, obra, tipo, status, valor_total, parceiro, orgao, territorio, imagem_url'
    )
    .order('created_at', { ascending: false })
    .limit(500)

  if (opts?.municipio?.trim()) {
    query = query.ilike('municipio', `%${opts.municipio.trim()}%`)
  }
  if (opts?.tipo?.trim()) {
    query = query.ilike('tipo', `%${opts.tipo.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(`Erro ao buscar obras: ${error.message}`)

  const obras = ((data ?? []) as ObraMcpRow[]).filter((o) => !comPub.has(o.id)).slice(0, limite)

  return { total: obras.length, obras }
}
