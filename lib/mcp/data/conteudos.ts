import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildProducaoFromConteudos,
  seedProducaoFromAgenda,
} from '@/lib/fluxo-digital/seed-producao'

export async function listarConteudosFluxoMcp(opts?: {
  status?: string
  municipio?: string
  limite?: number
}) {
  const resumo = await buildProducaoFromConteudos()
  let itens = resumo.itens
  if (opts?.status && opts.status !== 'todos') {
    itens = itens.filter((i) => i.status === opts.status)
  }
  if (opts?.municipio?.trim()) {
    const q = opts.municipio.trim().toLowerCase()
    itens = itens.filter((i) => i.cidade.toLowerCase().includes(q))
  }
  const limite = Math.min(Math.max(opts?.limite ?? 40, 1), 100)
  return {
    ...resumo,
    itens: itens.slice(0, limite),
  }
}

export async function criarPacoteConteudoMcp(agendaId: string) {
  return seedProducaoFromAgenda(agendaId)
}

export type RegistrarArteGeradaInput = {
  conteudoId: string
  /** URL pública do export/preview (PNG/JPG) ou link do design no Canva */
  imagemUrl: string
  /** Link de edição no Canva (opcional; guardado em texto_arte se ainda vazio) */
  canvaEditUrl?: string
  titulo?: string
  textoArte?: string
  legenda?: string
}

/**
 * Registra arte gerada no Canva (ou outra fonte externa) e marca status `gerado`.
 * Assim a etapa Produzido do Fluxo Digital passa a contar o município.
 */
export async function registrarArteGeradaMcp(input: RegistrarArteGeradaInput) {
  const conteudoId = input.conteudoId?.trim()
  const imagemUrl = input.imagemUrl?.trim()
  if (!conteudoId) throw new Error('conteudoId é obrigatório')
  if (!imagemUrl) throw new Error('imagemUrl é obrigatório')
  if (!URL.canParse(imagemUrl)) throw new Error('imagemUrl inválida')

  const supabase = createAdminClient()
  const { data: existing, error: eErr } = await supabase
    .from('conteudos_planejados')
    .select('id, status, titulo, texto_arte, legenda, cidade, template, fase, agenda_id')
    .eq('id', conteudoId)
    .maybeSingle()

  if (eErr) throw new Error(eErr.message)
  if (!existing) throw new Error('Conteúdo não encontrado')

  const update: Record<string, unknown> = {
    imagem_url: imagemUrl,
    fundo_origem: 'canva',
    status: 'gerado',
  }

  if (input.titulo?.trim()) update.titulo = input.titulo.trim()
  if (input.textoArte?.trim()) update.texto_arte = input.textoArte.trim()
  if (input.legenda?.trim()) update.legenda = input.legenda.trim()

  const editUrl = input.canvaEditUrl?.trim()
  if (editUrl) {
    if (!URL.canParse(editUrl)) throw new Error('canvaEditUrl inválida')
    const currentTexto = (existing.texto_arte as string | null)?.trim()
    if (!input.textoArte?.trim() && !currentTexto) {
      update.texto_arte = `Canva: ${editUrl}`
    } else if (!input.textoArte?.trim() && currentTexto && !currentTexto.includes(editUrl)) {
      update.texto_arte = `${currentTexto}\nCanva: ${editUrl}`
    }
  }

  const { data, error } = await supabase
    .from('conteudos_planejados')
    .update(update)
    .eq('id', conteudoId)
    .select(
      'id, status, imagem_url, fundo_origem, titulo, texto_arte, legenda, cidade, template, fase, agenda_id'
    )
    .single()

  if (error) throw new Error(error.message)

  return {
    ok: true,
    fonte: 'canva',
    conteudo: data,
    mensagem:
      'Arte registrada. Status = gerado. O município entra no KPI Produzido do Fluxo Digital.',
  }
}

/** Agendas do Fluxo Digital ainda sem pacote de templates. */
export async function listarPendentesProducaoMcp(limite = 30) {
  const supabase = createAdminClient()
  const { data: agendas, error } = await supabase
    .from('agendas')
    .select(
      `
      id,
      date,
      description,
      hora_evento,
      cities ( name )
    `
    )
    .eq('incluir_fluxo_digital', true)
    .eq('status', 'planejada')
    .gte('date', new Date().toISOString().slice(0, 10))
    .order('date', { ascending: true })
    .limit(Math.min(Math.max(limite, 1), 80))

  if (error) throw new Error(error.message)

  const ids = (agendas ?? []).map((a) => String(a.id))
  if (ids.length === 0) return { total: 0, pendentes: [] as unknown[] }

  const { data: links, error: lErr } = await supabase
    .from('conteudos_planejados')
    .select('agenda_id')
    .in('agenda_id', ids)

  if (lErr) throw new Error(lErr.message)

  const comPacote = new Set((links ?? []).map((l) => String(l.agenda_id)))
  const pendentes = (agendas ?? [])
    .filter((a) => !comPacote.has(String(a.id)))
    .map((a) => {
      const cities = a.cities as { name?: string } | { name?: string }[] | null
      const cityObj = Array.isArray(cities) ? cities[0] : cities
      return {
        agendaId: String(a.id),
        date: a.date,
        cidade: cityObj?.name ?? null,
        description: a.description,
        hora_evento: a.hora_evento,
      }
    })

  return { total: pendentes.length, pendentes }
}
