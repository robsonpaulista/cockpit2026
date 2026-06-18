import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import { resolveAgendaReply } from '@/lib/agent/resolve-agenda-reply'
import {
  filterPesquisasByTermo,
  parsePesquisaTipoFromQuery,
  queryMentionsJadyelAlencar,
  resolvePesquisasReply,
  type PesquisaTipo,
} from '@/lib/agent/format-pesquisas'
import {
  formatPesquisaTendenciaReply,
  type HistoricoIntencaoApiPayload,
} from '@/lib/agent/format-pesquisa-tendencia'
import {
  formatRankingEstimuladaFederalReply,
  type RankingEstimuladaApiPayload,
} from '@/lib/agent/format-ranking-estimulada'
import {
  formatComparativoExpectativa2022JarvisReply,
} from '@/lib/agent/format-comparativo-expectativa-jarvis'
import type {
  ComparativoExpectativa2022Resumo,
  ComparativoExpectativa2022Row,
} from '@/lib/comparativo-expectativa-2022'
import { resolveCandidatoParaPesquisa } from '@/lib/agent/resolve-candidato-pesquisa'
import { resolveCidadeTendenciaPesquisa } from '@/lib/agent/detect-pesquisa-avancada'
import { PESQUISA_TENDENCIA_CIDADE_HINT } from '@/lib/agent/pesquisa-tendencia-followup'
import {
  formatNoticiasDestaqueReply,
  formatNoticiasCriticasReply,
  formatNoticiasResumoReply,
  formatNoticiasFiltradasReply,
  mapNoticiasApiRows,
} from '@/lib/agent/format-noticias'
import { buildNoticiasApiPath } from '@/lib/noticias-jarvis-stats'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toolEnviarWhatsApp } from '@/lib/agent/tool-enviar-whatsapp'
import { toolConsultarInstagramSeguidoresDiario } from '@/lib/agent/tool-instagram-seguidores-diario'
import { toolConsultarInstagramPosts } from '@/lib/agent/tool-instagram-posts'
import {
  resolveVisitasCampoReply,
  type CampoAgendaRow,
  type VisitasCampoModo,
} from '@/lib/agent/format-visitas-campo'
import { isPrioridadeVisitasCampoQuery } from '@/lib/agent/detect-prioridade-visitas'
import { formatPrioridadeVisitasJarvisReply } from '@/lib/agent/format-prioridade-visitas'
import {
  buildSidebarNavigateReply,
  detectSidebarNavigate,
  resolveSidebarNavigateFromGroqArgs,
} from '@/lib/agent/detect-sidebar-navigate'
import type {
  AgentClassifiedIntent,
  AgentContextPayload,
  AgendaScopePending,
  PesquisaTipoChoicePending,
} from '@/lib/agent/types'

export interface AgentToolAuth {
  supabase: SupabaseClient
  user: { id: string; email?: string | null }
}

export interface PesquisasToolResult {
  content: string
  pesquisaTipoPending?: PesquisaTipoChoicePending
}

type PollRow = {
  data?: string
  instituto?: string
  candidato_nome?: string
  intencao?: number
  tipo?: string
  cities?: { name?: string } | null
}

type DemandRow = {
  title?: string
  status?: string
  theme?: string
  cidade?: string
  city?: string
}

function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

async function fetchWithCookies(
  origin: string,
  path: string,
  cookie: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${origin}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      cookie,
    },
    cache: 'no-store',
  })
}

function formatDatePt(isoOrDate: string): string {
  if (!isoOrDate) return '—'
  if (isoOrDate.includes('/')) return isoOrDate
  const d = isoOrDate.includes('T')
    ? new Date(isoOrDate)
    : (() => {
        const [y, m, day] = isoOrDate.split('-').map(Number)
        return new Date(y, (m || 1) - 1, day || 1)
      })()
  if (Number.isNaN(d.getTime())) return isoOrDate
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function parseTipoArg(args: Record<string, string>): PesquisaTipo | undefined {
  const fromArg = (args.tipo || '').toLowerCase()
  if (fromArg === 'estimulada' || fromArg === 'espontanea') return fromArg
  const fromTermo = parsePesquisaTipoFromQuery(
    `${args.termo || ''} ${args.cidade || ''} ${args.candidato || ''}`
  )
  return fromTermo ?? undefined
}

async function toolConsultarPesquisas(
  origin: string,
  cookie: string,
  args: Record<string, string>
): Promise<PesquisasToolResult> {
  const res = await fetchWithCookies(origin, '/api/pesquisa?limit=80', cookie)
  if (!res.ok) {
    return { content: 'Não consegui acessar as pesquisas cadastradas. Verifique se está logado.' }
  }

  const polls = (await res.json()) as PollRow[]
  if (!Array.isArray(polls) || polls.length === 0) {
    return { content: 'Não há pesquisas cadastradas no sistema.' }
  }

  const termoExibicao = args.termo || args.cidade || args.candidato || ''
  const focoJadyel =
    queryMentionsJadyelAlencar(args.candidato || '') ||
    queryMentionsJadyelAlencar(termoExibicao) ||
    queryMentionsJadyelAlencar(`${args.cidade || ''} ${args.termo || ''}`)
  const filtered = termoExibicao
    ? filterPesquisasByTermo(polls as Array<Record<string, unknown>>, termoExibicao, { focoJadyel })
    : (polls as Array<Record<string, unknown>>)

  if (filtered.length === 0) {
    return { content: `Não encontrei pesquisas para «${termoExibicao}».` }
  }

  const tipoFilter = parseTipoArg(args)
  const result = resolvePesquisasReply(filtered, {
    termo: termoExibicao || undefined,
    tipoFilter,
    focoJadyel,
    maxGrupos: 3,
    maxCandidatosPorGrupo: 12,
  })

  if (result.kind === 'ask_tipo') {
    return { content: result.content, pesquisaTipoPending: result.pending }
  }

  if (result.kind === 'empty' || !result.content) {
    return { content: result.content || `Não encontrei pesquisas para «${termoExibicao}».` }
  }

  return { content: result.content }
}

async function toolConsultarPesquisaTendencia(
  origin: string,
  cookie: string,
  args: Record<string, string>,
  context?: AgentContextPayload,
  queryHint?: string
): Promise<{ content: string }> {
  const resolved = resolveCandidatoParaPesquisa(args, context, queryHint)
  if (!resolved.candidato) {
    return { content: resolved.aviso || 'Informe o candidato para ver a tendência.' }
  }

  const municipio = resolveCidadeTendenciaPesquisa(queryHint ?? '', args.cidade)

  const qs = new URLSearchParams({ candidato: resolved.candidato })
  if (municipio) qs.set('municipio', municipio)

  const res = await fetchWithCookies(origin, `/api/pesquisa/historico-intencao?${qs.toString()}`, cookie)
  if (!res.ok) {
    return { content: 'Não consegui acessar o histórico de intenção. Verifique se está logado.' }
  }

  const payload = (await res.json()) as HistoricoIntencaoApiPayload
  const content = formatPesquisaTendenciaReply(payload, {
    candidato: resolved.candidato,
    municipio,
  })
  const hint = municipio ? '' : PESQUISA_TENDENCIA_CIDADE_HINT
  return { content: `${content}${hint}`.trim() }
}

async function toolConsultarComparativoExpectativa2022(
  origin: string,
  cookie: string,
  args: Record<string, string>
): Promise<{ content: string; speechSegments: string[] }> {
  const filtro = args.filtro?.trim() || 'caiu'
  const cenario = args.cenario?.trim() || 'legado'
  const modo = args.modo?.trim() === 'lista' ? 'lista' : 'resumo'
  const qs = new URLSearchParams({ filtro, cenario, modo, limit: '25' })
  const res = await fetchWithCookies(
    origin,
    `/api/territorio/comparativo-expectativa-2022?${qs}`,
    cookie
  )
  if (!res.ok) {
    return {
      content: 'Não consegui montar o comparativo expectativa 2026 × Federal 2022. Verifique a planilha em Território & Base.',
      speechSegments: ['Não consegui montar o comparativo territorial.'],
    }
  }

  const data = (await res.json()) as {
    rows?: ComparativoExpectativa2022Row[]
    totalFiltrado?: number
    filtro?: 'caiu' | 'cresceu' | 'manteve' | 'todos'
    cenario?: 'legado' | 'aferido' | 'promessa'
    modo?: 'resumo' | 'lista'
    resumo?: ComparativoExpectativa2022Resumo
    error?: string
  }

  if (data.error) {
    return {
      content: data.error,
      speechSegments: [data.error],
    }
  }

  return formatComparativoExpectativa2022JarvisReply({
    rows: data.rows ?? [],
    filtro: data.filtro ?? 'caiu',
    cenario: data.cenario ?? 'legado',
    totalFiltrado: data.totalFiltrado ?? 0,
    limite: 25,
    modo: data.modo ?? modo,
    resumo: data.resumo,
  })
}

async function toolConsultarRankingEstimuladaFederal(
  origin: string,
  cookie: string,
  args: Record<string, string>,
  context?: AgentContextPayload,
  queryHint?: string
): Promise<{ content: string }> {
  const resolved = resolveCandidatoParaPesquisa(args, context, queryHint)
  if (!resolved.candidato) {
    return { content: resolved.aviso || 'Informe o candidato para ver o ranking estimulada.' }
  }

  const qs = new URLSearchParams({ candidato: resolved.candidato })
  const res = await fetchWithCookies(origin, `/api/pesquisa/ranking-estimulada?${qs.toString()}`, cookie)
  if (!res.ok) {
    return { content: 'Não consegui acessar o ranking estimulada. Verifique se está logado.' }
  }

  const payload = (await res.json()) as RankingEstimuladaApiPayload
  return { content: formatRankingEstimuladaFederalReply(payload) }
}

async function toolConsultarAgendas(
  origin: string,
  cookie: string,
  args: Record<string, string>
): Promise<{ content: string; speechSegments?: string[]; agendaScopePending?: AgendaScopePending }> {
  const res = await fetchWithCookies(origin, '/api/agenda/events', cookie)
  if (!res.ok) {
    return { content: 'Não consegui acessar a agenda do Google Calendar.' }
  }

  const payload = (await res.json()) as {
    events?: CalendarEventRow[]
    error?: string
  }

  if (payload.error) return { content: payload.error }

  const events = payload.events ?? []
  if (events.length === 0) {
    return { content: 'Não há eventos na agenda configurada.' }
  }

  const queryHint = [args.data, args.termo, args.cidade, 'agenda'].filter(Boolean).join(' ')
  const result = resolveAgendaReply(events, queryHint, {
    cidade: args.cidade?.trim() || undefined,
    maxItems: 8,
  })

  if (result.kind === 'ask_scope') {
    return { content: result.content, agendaScopePending: result.pending }
  }

  if (result.kind === 'error') {
    return { content: result.content }
  }

  return { content: result.content, speechSegments: result.speechSegments }
}

async function toolConsultarVisitasCampo(
  origin: string,
  cookie: string,
  args: Record<string, string>,
  queryHint: string
): Promise<{ content: string; speechSegments?: string[] }> {
  const modoArg = (args.modo?.trim() || undefined) as VisitasCampoModo | undefined
  const prioridade =
    modoArg === 'prioridade_visitas' || isPrioridadeVisitasCampoQuery(queryHint)

  if (prioridade) {
    const res = await fetchWithCookies(origin, '/api/dashboard/territorios-frios', cookie, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territorioConfig: {} }),
    })
    if (!res.ok) {
      return { content: 'Não consegui carregar a prioridade de visitas de campo.' }
    }
    const data = (await res.json()) as { prioridadeCampoLista?: Parameters<typeof formatPrioridadeVisitasJarvisReply>[0] }
    return formatPrioridadeVisitasJarvisReply(data.prioridadeCampoLista ?? [])
  }

  const res = await fetchWithCookies(origin, '/api/campo/agendas', cookie)
  if (!res.ok) {
    return { content: 'Não consegui acessar as visitas do módulo Campo & Agenda.' }
  }

  const agendas = (await res.json()) as CampoAgendaRow[]
  if (!Array.isArray(agendas)) {
    return { content: 'Não consegui ler as agendas de campo.' }
  }

  const modo = (args.modo?.trim() || undefined) as VisitasCampoModo | undefined
  return resolveVisitasCampoReply(agendas, queryHint, {
    cidade: args.cidade?.trim() || undefined,
    modo,
    mes: args.mes?.trim(),
    ano: args.ano?.trim(),
    limite: args.limite ? Number(args.limite) : undefined,
  })
}

async function toolConsultarDemandas(
  origin: string,
  cookie: string,
  args: Record<string, string>
): Promise<string> {
  if (!args.cidade?.trim()) {
    return 'Informe o município, por exemplo: «demandas em Teresina».'
  }

  const res = await fetchWithCookies(
    origin,
    `/api/campo/demands?cidade=${encodeURIComponent(args.cidade.trim())}`,
    cookie
  )
  if (!res.ok) return `Não consegui buscar demandas de **${args.cidade}**.`

  const demands = (await res.json()) as DemandRow[]
  if (!Array.isArray(demands) || demands.length === 0) {
    return `Não há demandas registradas para **${args.cidade}**.`
  }

  const show = demands.slice(0, 8)
  let out = `**Demandas em ${args.cidade}** (${demands.length})\n\n`
  show.forEach((d, i) => {
    out += `${i + 1}. ${d.title || 'Sem título'}\n`
    out += `   Status: ${d.status || '—'}`
    if (d.theme) out += ` · ${d.theme}`
    out += '\n'
    if (i < show.length - 1) out += '\n'
  })
  if (demands.length > 8) out += `\n+ ${demands.length - 8} outras demandas`
  return out.trim()
}

async function toolConsultarNoticiasDestaque(
  origin: string,
  cookie: string
): Promise<{ content: string; speechSegments: string[] }> {
  const res = await fetchWithCookies(
    origin,
    '/api/noticias?dashboard_highlight=true&limit=8',
    cookie
  )

  if (!res.ok) {
    return {
      content: 'Não consegui acessar as notícias em destaque.',
      speechSegments: ['Não consegui acessar as notícias em destaque.'],
    }
  }

  const rows = mapNoticiasApiRows((await res.json()) as unknown[])
  const formatted = formatNoticiasDestaqueReply(rows)
  return { content: formatted.content, speechSegments: formatted.speechSegments }
}

async function toolConsultarNoticiasCriticas(
  origin: string,
  cookie: string
): Promise<{ content: string; speechSegments: string[] }> {
  const res = await fetchWithCookies(
    origin,
    '/api/noticias?risk_level=high&limit=10',
    cookie
  )

  if (!res.ok) {
    return {
      content: 'Não consegui acessar as notícias com alerta crítico.',
      speechSegments: ['Não consegui acessar as notícias com alerta crítico.'],
    }
  }

  const rows = mapNoticiasApiRows((await res.json()) as unknown[])
  const formatted = formatNoticiasCriticasReply(rows)
  return { content: formatted.content, speechSegments: formatted.speechSegments }
}

async function toolConsultarNoticiasResumo(
  origin: string,
  cookie: string,
  args: Record<string, string>
): Promise<{ content: string; speechSegments: string[] }> {
  const res = await fetchWithCookies(origin, '/api/noticias?limit=100', cookie)

  if (!res.ok) {
    return {
      content: 'Não consegui acessar o monitor de notícias.',
      speechSegments: ['Não consegui acessar o monitor de notícias.'],
    }
  }

  const rows = mapNoticiasApiRows((await res.json()) as unknown[])
  const formatted = formatNoticiasResumoReply(rows, args.foco)
  return { content: formatted.content, speechSegments: formatted.speechSegments }
}

async function toolConsultarNoticiasFiltradas(
  origin: string,
  cookie: string,
  args: Record<string, string>
): Promise<{ content: string; speechSegments: string[] }> {
  const path = buildNoticiasApiPath({
    sentiment: args.sentimento || undefined,
    risco: args.risco || undefined,
    termo: args.termo_busca || undefined,
    limite: 10,
  })

  const res = await fetchWithCookies(origin, path, cookie)

  if (!res.ok) {
    return {
      content: 'Não consegui acessar as notícias com esse filtro.',
      speechSegments: ['Não consegui acessar as notícias com esse filtro.'],
    }
  }

  const rows = mapNoticiasApiRows((await res.json()) as unknown[])
  const formatted = formatNoticiasFiltradasReply(rows, args)
  return { content: formatted.content, speechSegments: formatted.speechSegments }
}

function toolConsultarAlertas(context?: AgentContextPayload): string {
  const n = context?.alertsCriticosCount ?? 0
  if (n === 0) return 'Não há alertas críticos no momento.'
  return `Há **${n}** alerta${n > 1 ? 's' : ''} crítico${n > 1 ? 's' : ''} no painel. Acesse o cockpit ou o módulo de notícias para detalhes.`
}

function toolConsultarTerritoriosFrios(context?: AgentContextPayload): string {
  const n = context?.territoriosFriosCount ?? 0
  if (n === 0) return 'Nenhum território frio identificado nos indicadores atuais.'
  return `**${n}** território${n > 1 ? 's' : ''} frio${n > 1 ? 's' : ''} — priorize presença de campo e capilaridade nessas cidades.`
}

function toolAjuda(context?: AgentContextPayload): string {
  if (context?.pageKind === 'campo') {
    return [
      '**Jarvis — Campo & Agenda**',
      '',
      '› últimas visitas de campo',
      '› visitas em Teresina',
      '› quantas viagens em maio de 2026',
      '› descrição da visita a Picos',
      '› cidades visitadas',
      '',
      'Compromissos do Google Calendar: diga «agenda de hoje».',
    ].join('\n')
  }
  if (context?.pageKind === 'resumo-eleicoes') {
    return [
      '**Jarvis — Resumo Eleições**',
      '',
      '› Buscar município: «Buscar Teresina» ou só «Picos»',
      '› Abrir demandas, lideranças ou histórico de pesquisas',
      '› Fechar modais: «fechar»',
      '',
      'Em outras telas: pesquisas, território, Instagram, chapa federal, alertas.',
    ].join('\n')
  }
  if (context?.pageKind === 'pesquisa') {
    return [
      '**Jarvis — Pesquisa & Relato**',
      '',
      '› como evoluiu a intenção do Jadyel',
      '› tendência em Teresina (por município)',
      '› depois da tendência geral: «em Picos»',
      '› ranking estimulada dep federal',
      '› pesquisa em Picos (intenção pontual)',
      '',
      'Use o candidato padrão selecionado nesta página ou cite o nome na pergunta.',
    ].join('\n')
  }
  return [
    '**O que posso fazer:**',
    '',
    '**Por cidade:** expectativa, lideranças, visitas de campo, agendas (Google), demandas',
    '**Pesquisas:** intenção por município, tendência temporal, ranking estimulada dep. federal',
    '**Redes:** métricas e posts do Instagram',
    '**Geral:** chapa federal, notícias em destaque, alertas, territórios frios',
    '**WhatsApp:** «envia o resumo operacional para o CEO», «manda briefing de Teresina para os executivos»',
    '',
    'Fale em linguagem natural — a IA interpreta e executa.',
  ].join('\n')
}

export type ServerToolResult =
  | string
  | {
      content: string
      speechSegments?: string[]
      pesquisaTipoPending?: PesquisaTipoChoicePending
      agendaScopePending?: AgendaScopePending
    }

export async function executeServerTool(
  classified: AgentClassifiedIntent,
  origin: string,
  cookie: string,
  context?: AgentContextPayload,
  auth?: AgentToolAuth,
  queryHint?: string,
): Promise<ServerToolResult | null> {
  switch (classified.intent) {
    case 'enviar_whatsapp': {
      if (!auth) return 'Não foi possível autenticar o envio WhatsApp.'
      return toolEnviarWhatsApp(classified.args, origin, cookie, auth.supabase, auth.user)
    }
    case 'consultar_pesquisas':
      return toolConsultarPesquisas(origin, cookie, classified.args)
    case 'consultar_pesquisa_tendencia':
      return toolConsultarPesquisaTendencia(
        origin,
        cookie,
        classified.args,
        context,
        queryHint ?? classified.args.termo
      )
    case 'consultar_comparativo_expectativa_2022':
      return toolConsultarComparativoExpectativa2022(origin, cookie, classified.args)
    case 'consultar_ranking_estimulada_federal':
      return toolConsultarRankingEstimuladaFederal(
        origin,
        cookie,
        classified.args,
        context,
        queryHint ?? classified.args.termo
      )
    case 'consultar_agendas':
      return toolConsultarAgendas(origin, cookie, classified.args)
    case 'consultar_visitas_campo':
      return toolConsultarVisitasCampo(
        origin,
        cookie,
        classified.args,
        queryHint ?? classified.args.termo ?? ''
      )
    case 'consultar_demandas':
      return toolConsultarDemandas(origin, cookie, classified.args)
    case 'consultar_noticias_destaque':
      return toolConsultarNoticiasDestaque(origin, cookie)
    case 'consultar_noticias_criticas':
      return toolConsultarNoticiasCriticas(origin, cookie)
    case 'consultar_noticias_resumo':
      return toolConsultarNoticiasResumo(origin, cookie, classified.args)
    case 'consultar_noticias_filtradas':
      return toolConsultarNoticiasFiltradas(origin, cookie, classified.args)
    case 'consultar_instagram_seguidores_diario':
      return toolConsultarInstagramSeguidoresDiario(
        origin,
        cookie,
        classified.args,
        queryHint ?? classified.args.termo
      )
    case 'consultar_instagram_posts': {
      if (!auth?.user?.id) {
        return 'Não foi possível autenticar a consulta de posts do Instagram.'
      }
      const content = await toolConsultarInstagramPosts(
        auth.user.id,
        classified.args,
        queryHint ?? classified.args.termo,
        {
          token: context?.instagramToken,
          businessAccountId: context?.instagramBusinessAccountId,
        }
      )
      return content
    }
    case 'consultar_alertas':
      return toolConsultarAlertas(context)
    case 'consultar_territorios_frios':
      return toolConsultarTerritoriosFrios(context)
    case 'ajuda':
      return toolAjuda(context)
    case 'navegar': {
      const resolved =
        resolveSidebarNavigateFromGroqArgs(queryHint ?? '', classified.args) ??
        detectSidebarNavigate(queryHint ?? '', undefined)
      if (!resolved) {
        return 'Não identifiquei qual página abrir. Diga, por exemplo: «abrir agenda» ou «ir para território».'
      }
      if (resolved.kind === 'ambiguous') {
        return `Encontrei mais de uma página: ${resolved.candidates.map((c) => c.label).join(', ')}. Seja mais específico.`
      }
      return buildSidebarNavigateReply(resolved)
    }
    default:
      return null
  }
}

export function buildNavigateAction(
  classified: AgentClassifiedIntent
): { type: 'navigate'; url: string; label: string } | undefined {
  if (classified.intent === 'consultar_noticias_destaque') {
    return {
      type: 'navigate',
      url: '/dashboard/noticias',
      label: 'Ver Notícias & Crises',
    }
  }

  if (classified.intent === 'consultar_noticias_criticas') {
    return {
      type: 'navigate',
      url: '/dashboard/noticias',
      label: 'Ver Notícias com Risco Alto',
    }
  }

  if (
    classified.intent === 'consultar_noticias_resumo' ||
    classified.intent === 'consultar_noticias_filtradas'
  ) {
    return {
      type: 'navigate',
      url: '/dashboard/noticias',
      label: 'Ver Notícias & Crises',
    }
  }

  if (classified.intent === 'consultar_instagram_seguidores_diario') {
    return {
      type: 'navigate',
      url: '/dashboard/conteudo/redes',
      label: 'Ver Histórico de Seguidores',
    }
  }

  if (classified.intent === 'consultar_instagram_posts') {
    return {
      type: 'navigate',
      url: '/dashboard/conteudo/redes',
      label: 'Ver Posts & Insights',
    }
  }

  if (classified.intent === 'consultar_comparativo_expectativa_2022') {
    return {
      type: 'navigate',
      url: '/dashboard/territorio',
      label: 'Ver Mapa 2026 × 2022',
    }
  }

  if (
    classified.intent === 'consultar_pesquisa_tendencia' ||
    classified.intent === 'consultar_ranking_estimulada_federal' ||
    classified.intent === 'consultar_pesquisas'
  ) {
    return {
      type: 'navigate',
      url: '/dashboard/pesquisa',
      label: 'Ver Pesquisas & Relato',
    }
  }

  if (classified.intent === 'consultar_visitas_campo') {
    const modo = classified.args?.modo?.trim()
    if (modo === 'prioridade_visitas') {
      return {
        type: 'navigate',
        url: '/dashboard/resumo-operacional',
        label: 'Ver Resumo Operacional',
      }
    }
    return {
      type: 'navigate',
      url: '/dashboard/campo',
      label: 'Ver Campo & Agenda',
    }
  }

  if (classified.intent !== 'navegar') return undefined

  const resolved = resolveSidebarNavigateFromGroqArgs('', classified.args)
  if (resolved?.kind === 'navigate' || resolved?.kind === 'home') {
    return {
      type: 'navigate',
      url: resolved.target.href,
      label: resolved.target.label,
    }
  }

  const url = classified.args.url?.trim()
  if (!url || !url.startsWith('/')) return undefined
  return {
    type: 'navigate',
    url,
    label: classified.args.label?.trim() || 'Abrir página',
  }
}
