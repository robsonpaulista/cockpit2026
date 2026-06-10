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
  formatNoticiasDestaqueReply,
  mapNoticiasApiRows,
} from '@/lib/agent/format-noticias'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toolEnviarWhatsApp } from '@/lib/agent/tool-enviar-whatsapp'
import {
  resolveVisitasCampoReply,
  type CampoAgendaRow,
  type VisitasCampoModo,
} from '@/lib/agent/format-visitas-campo'
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

async function fetchWithCookies(origin: string, path: string, cookie: string): Promise<Response> {
  return fetch(`${origin}${path}`, {
    headers: { cookie },
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
  return [
    '**O que posso fazer:**',
    '',
    '**Por cidade:** expectativa, lideranças, visitas de campo, agendas (Google), demandas',
    '**Pesquisas:** intenção de voto por candidato ou município',
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

  if (classified.intent === 'consultar_visitas_campo') {
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
