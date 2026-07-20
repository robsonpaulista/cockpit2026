import { createAdminClient } from '@/lib/supabase/admin'
import { AGENDA_CONTEUDO_PACK } from '@/lib/conteudo/agenda-pack'
import { normalizeIptMunicipio } from '@/lib/ipt'
import type { ProducaoFluxoResumo, ConteudoFluxoItem } from '@/lib/fluxo-digital/types'

export type SeedProducaoResult = {
  agendaId: string
  cidade: string
  jaExistia: boolean
  criados: number
  total: number
  conteudos: Array<{ id: string; template: string | null; fase: string | null; status: string }>
}

/**
 * Garante o pacote de templates (AGENDA_CONTEUDO_PACK) para uma visita do Fluxo Digital.
 * Não exige obra_id — cidade vem da agenda.
 */
export async function seedProducaoFromAgenda(agendaId: string): Promise<SeedProducaoResult> {
  const supabase = createAdminClient()

  const { data: agenda, error: aErr } = await supabase
    .from('agendas')
    .select(
      `
      id,
      date,
      description,
      obra_id,
      incluir_fluxo_digital,
      cities ( name ),
      obras ( obra, municipio )
    `
    )
    .eq('id', agendaId)
    .maybeSingle()

  if (aErr) throw new Error(`Erro ao ler agenda: ${aErr.message}`)
  if (!agenda) throw new Error('Agenda não encontrada')

  if (!(agenda as { incluir_fluxo_digital?: boolean }).incluir_fluxo_digital) {
    throw new Error('Esta agenda não está marcada para o Fluxo Digital')
  }

  const cities = agenda.cities as { name?: string } | { name?: string }[] | null
  const obras = agenda.obras as
    | { obra?: string; municipio?: string }
    | { obra?: string; municipio?: string }[]
    | null
  const cityObj = Array.isArray(cities) ? cities[0] : cities
  const obraObj = Array.isArray(obras) ? obras[0] : obras
  const cidade =
    cityObj?.name?.trim() || obraObj?.municipio?.trim() || 'Município não informado'

  const { data: existing, error: eErr } = await supabase
    .from('conteudos_planejados')
    .select('id, template, fase, status')
    .eq('agenda_id', agendaId)

  if (eErr) throw new Error(`Erro ao ler conteúdos: ${eErr.message}`)

  if (existing && existing.length > 0) {
    return {
      agendaId,
      cidade,
      jaExistia: true,
      criados: 0,
      total: existing.length,
      conteudos: existing.map((r) => ({
        id: String(r.id),
        template: (r.template as string | null) ?? null,
        fase: (r.fase as string | null) ?? null,
        status: String(r.status),
      })),
    }
  }

  const rows = AGENDA_CONTEUDO_PACK.map((s) => ({
    obra_id: (agenda as { obra_id?: string | null }).obra_id ?? null,
    agenda_id: agendaId,
    cidade: cidade === 'Município não informado' ? null : cidade,
    territorio: null,
    fase: s.fase,
    formato: s.formato,
    template: s.template,
    titulo: null,
    texto_arte: null,
    legenda: null,
    status: 'rascunho' as const,
    campanha_geral: false,
    data_sugerida: (agenda as { date?: string | null }).date ?? null,
  }))

  const { data: inserted, error: iErr } = await supabase
    .from('conteudos_planejados')
    .insert(rows)
    .select('id, template, fase, status')

  if (iErr) throw new Error(`Erro ao criar pacote de templates: ${iErr.message}`)

  return {
    agendaId,
    cidade,
    jaExistia: false,
    criados: inserted?.length ?? 0,
    total: inserted?.length ?? 0,
    conteudos: (inserted ?? []).map((r) => ({
      id: String(r.id),
      template: (r.template as string | null) ?? null,
      fase: (r.fase as string | null) ?? null,
      status: String(r.status),
    })),
  }
}

/**
 * Agrega conteúdos das agendas marcadas no Fluxo Digital (etapa Produzido).
 */
export async function buildProducaoFromConteudos(): Promise<ProducaoFluxoResumo> {
  const supabase = createAdminClient()

  const { data: agendas, error: aErr } = await supabase
    .from('agendas')
    .select('id')
    .eq('incluir_fluxo_digital', true)
    .eq('status', 'planejada')

  if (aErr) {
    if (aErr.message.includes('incluir_fluxo_digital')) {
      throw new Error(
        'Falta a coluna incluir_fluxo_digital em agendas. Execute database/add-agendas-fluxo-digital.sql.'
      )
    }
    throw new Error(`Erro ao ler agendas do fluxo: ${aErr.message}`)
  }

  const agendaIds = (agendas ?? []).map((a) => String(a.id))
  if (agendaIds.length === 0) {
    return emptyProducao()
  }

  const { data: rows, error: cErr } = await supabase
    .from('conteudos_planejados')
    .select(
      `
      id,
      agenda_id,
      cidade,
      fase,
      formato,
      template,
      titulo,
      status,
      data_sugerida,
      imagem_url,
      fundo_origem,
      agendas ( date, description, cities ( name ) )
    `
    )
    .in('agenda_id', agendaIds)
    .order('data_sugerida', { ascending: true })

  if (cErr) throw new Error(`Erro ao ler conteúdos: ${cErr.message}`)

  const itens: ConteudoFluxoItem[] = []
  const municipiosGerados = new Map<string, string>()
  let rascunho = 0
  let gerado = 0
  let aprovado = 0
  let publicado = 0

  for (const row of rows ?? []) {
    const status = String(row.status ?? 'rascunho')
    if (status === 'rascunho') rascunho += 1
    else if (status === 'gerado') gerado += 1
    else if (status === 'aprovado') aprovado += 1
    else if (status === 'publicado') publicado += 1

    const agendasJoin = row.agendas as
      | { date?: string; description?: string; cities?: { name?: string } | { name?: string }[] }
      | { date?: string; description?: string; cities?: { name?: string } | { name?: string }[] }[]
      | null
    const agendaObj = Array.isArray(agendasJoin) ? agendasJoin[0] : agendasJoin
    const cities = agendaObj?.cities
    const cityObj = Array.isArray(cities) ? cities[0] : cities
    const cidade =
      (row.cidade as string | null)?.trim() ||
      cityObj?.name?.trim() ||
      'Município não informado'

    if (status === 'gerado' || status === 'aprovado' || status === 'publicado') {
      const key = normalizeIptMunicipio(cidade)
      if (key && cidade !== 'Município não informado' && !municipiosGerados.has(key)) {
        municipiosGerados.set(key, cidade)
      }
    }

    itens.push({
      id: String(row.id),
      agendaId: String(row.agenda_id),
      cidade,
      fase: (row.fase as string | null) ?? null,
      formato: (row.formato as string | null) ?? null,
      template: (row.template as string | null) ?? null,
      titulo: (row.titulo as string | null) ?? null,
      status,
      dataSugerida: (row.data_sugerida as string | null) ?? agendaObj?.date ?? null,
      agendaDescricao: agendaObj?.description ?? null,
      imagemUrl: (row.imagem_url as string | null) ?? null,
      fundoOrigem: (row.fundo_origem as string | null) ?? null,
    })
  }

  const municipios = [...municipiosGerados.values()].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  )
  const produzidos = gerado + aprovado + publicado

  return {
    fonte: 'conteudos_planejados',
    atualizadoEm: new Date().toISOString(),
    totalPecas: itens.length,
    rascunho,
    gerado,
    aprovado,
    publicado,
    produzidos,
    municipiosUnicos: municipios.length,
    municipios,
    itens,
  }
}

function emptyProducao(): ProducaoFluxoResumo {
  return {
    fonte: 'conteudos_planejados',
    atualizadoEm: new Date().toISOString(),
    totalPecas: 0,
    rascunho: 0,
    gerado: 0,
    aprovado: 0,
    publicado: 0,
    produzidos: 0,
    municipiosUnicos: 0,
    municipios: [],
    itens: [],
  }
}
