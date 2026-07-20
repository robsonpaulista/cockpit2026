import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeIptMunicipio } from '@/lib/ipt'
import type {
  PlanejamentoFluxoFromAgenda,
  VisitaPlanejadaFluxo,
} from '@/lib/fluxo-digital/types'

export type { PlanejamentoFluxoFromAgenda, VisitaPlanejadaFluxo }

/**
 * Agrega visitas planejadas da tabela `agendas` para a etapa Planejado do Fluxo Digital.
 */
export async function buildPlanejamentoFromAgenda(opts?: {
  de?: string
  ate?: string
  limite?: number
}): Promise<PlanejamentoFluxoFromAgenda> {
  const limite = Math.min(Math.max(opts?.limite ?? 80, 1), 200)
  const hojeIso = new Date().toISOString().slice(0, 10)
  const de = opts?.de?.trim() || hojeIso
  const ate = opts?.ate?.trim() || null

  const supabase = createAdminClient()
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
      cities ( name ),
      obras ( obra, municipio )
    `
    )
    .eq('type', 'visita')
    .eq('status', 'planejada')
    .gte('date', de)
    .order('date', { ascending: true })
    .limit(limite)

  if (ate) query = query.lte('date', ate)

  const { data, error } = await query
  if (error) throw new Error(`Erro ao ler agenda para o Fluxo Digital: ${error.message}`)

  const municipiosSet = new Map<string, string>()
  const eventos: VisitaPlanejadaFluxo[] = []

  for (const row of data ?? []) {
    const cities = row.cities as { name?: string } | { name?: string }[] | null
    const obras = row.obras as
      | { obra?: string; municipio?: string }
      | { obra?: string; municipio?: string }[]
      | null
    const cityObj = Array.isArray(cities) ? cities[0] : cities
    const obraObj = Array.isArray(obras) ? obras[0] : obras
    const cidade =
      cityObj?.name?.trim() || obraObj?.municipio?.trim() || 'Município não informado'
    const key = normalizeIptMunicipio(cidade)
    if (key && cidade !== 'Município não informado' && !municipiosSet.has(key)) {
      municipiosSet.set(key, cidade)
    }
    eventos.push({
      id: String(row.id),
      date: (row.date as string | null) ?? null,
      cidade,
      description: (row.description as string | null) ?? null,
      hora_evento: (row.hora_evento as string | null) ?? null,
      obra_nome: obraObj?.obra?.trim() || null,
      status: (row.status as string | null) ?? null,
    })
  }

  const municipios = [...municipiosSet.values()].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  )

  return {
    fonte: 'agendas',
    atualizadoEm: new Date().toISOString(),
    de,
    ate,
    visitasPlanejadas: eventos.length,
    municipiosUnicos: municipios.length,
    municipios,
    eventos,
  }
}
