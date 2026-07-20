import { createAdminClient } from '@/lib/supabase/admin'

export type AgendaMcpRow = {
  id: string
  date: string | null
  type: string | null
  status: string | null
  description: string | null
  hora_evento: string | null
  territorio: string | null
  cidade: string | null
  obra_id: string | null
  obra_nome: string | null
  obra_municipio: string | null
}

/**
 * Lista eventos da agenda de conteúdo (`agendas`), com cidade e obra.
 * Por padrão: visitas planejadas a partir de hoje.
 */
export async function listarAgendaMcp(opts?: {
  tipo?: 'visita' | 'evento' | 'reuniao' | 'outro' | 'todos'
  status?: 'planejada' | 'concluida' | 'cancelada' | 'todos'
  municipio?: string
  de?: string
  ate?: string
  limite?: number
}): Promise<{ total: number; eventos: AgendaMcpRow[] }> {
  const limite = Math.min(Math.max(opts?.limite ?? 40, 1), 100)
  const supabase = createAdminClient()

  const hoje = new Date()
  const hojeIso = hoje.toISOString().slice(0, 10)

  let query = supabase
    .from('agendas')
    .select(
      `
      id,
      date,
      type,
      status,
      description,
      hora_evento,
      territorio,
      obra_id,
      cities ( name ),
      obras ( obra, municipio )
    `
    )
    .order('date', { ascending: true })
    .limit(limite)

  const tipo = opts?.tipo ?? 'visita'
  if (tipo !== 'todos') {
    query = query.eq('type', tipo)
  }

  const status = opts?.status ?? 'planejada'
  if (status !== 'todos') {
    query = query.eq('status', status)
  }

  const de = opts?.de?.trim() || hojeIso
  query = query.gte('date', de)
  if (opts?.ate?.trim()) {
    query = query.lte('date', opts.ate.trim())
  }

  const { data, error } = await query
  if (error) throw new Error(`Erro ao listar agenda: ${error.message}`)

  const municipioFiltro = opts?.municipio?.trim().toLowerCase()

  const eventos: AgendaMcpRow[] = (data ?? [])
    .map((row) => {
      const cities = row.cities as { name?: string } | { name?: string }[] | null
      const obras = row.obras as
        | { obra?: string; municipio?: string }
        | { obra?: string; municipio?: string }[]
        | null
      const cityObj = Array.isArray(cities) ? cities[0] : cities
      const obraObj = Array.isArray(obras) ? obras[0] : obras
      return {
        id: String(row.id),
        date: (row.date as string | null) ?? null,
        type: (row.type as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        description: (row.description as string | null) ?? null,
        hora_evento: (row.hora_evento as string | null) ?? null,
        territorio: (row.territorio as string | null) ?? null,
        cidade: cityObj?.name?.trim() || obraObj?.municipio?.trim() || null,
        obra_id: (row.obra_id as string | null) ?? null,
        obra_nome: obraObj?.obra?.trim() || null,
        obra_municipio: obraObj?.municipio?.trim() || null,
      }
    })
    .filter((e) => {
      if (!municipioFiltro) return true
      const c = (e.cidade || e.obra_municipio || '').toLowerCase()
      return c.includes(municipioFiltro)
    })

  return { total: eventos.length, eventos }
}
