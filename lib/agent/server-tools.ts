import {
  filterPesquisasByTermo,
  parsePesquisaTipoFromQuery,
  resolvePesquisasReply,
  type PesquisaTipo,
} from '@/lib/agent/format-pesquisas'
import type {
  AgentClassifiedIntent,
  AgentContextPayload,
  PesquisaTipoChoicePending,
} from '@/lib/agent/types'

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

type AgendaRow = {
  date?: string
  type?: string
  status?: string
  description?: string
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
  const filtered = termoExibicao
    ? filterPesquisasByTermo(polls as Array<Record<string, unknown>>, termoExibicao)
    : (polls as Array<Record<string, unknown>>)

  if (filtered.length === 0) {
    return { content: `Não encontrei pesquisas para «${termoExibicao}».` }
  }

  const tipoFilter = parseTipoArg(args)
  const result = resolvePesquisasReply(filtered, {
    termo: termoExibicao || undefined,
    tipoFilter,
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
): Promise<string> {
  const res = await fetchWithCookies(origin, '/api/campo/agendas', cookie)
  if (!res.ok) return 'Não consegui acessar as agendas.'

  const agendas = (await res.json()) as AgendaRow[]
  if (!Array.isArray(agendas) || agendas.length === 0) {
    return 'Não há agendas cadastradas.'
  }

  const cidadeNorm = args.cidade ? norm(args.cidade) : ''
  const filtered = cidadeNorm
    ? agendas.filter((a) => norm(a.cities?.name || '').includes(cidadeNorm))
    : agendas

  const upcoming = [...filtered]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 8)

  if (upcoming.length === 0) {
    return args.cidade
      ? `Não encontrei agendas para **${args.cidade}**.`
      : 'Não há agendas no período.'
  }

  let out = args.cidade
    ? `**Agendas em ${args.cidade}**\n\n`
    : `**Próximas agendas**\n\n`

  upcoming.forEach((a, i) => {
    const city = a.cities?.name || '—'
    out += `${i + 1}. ${formatDatePt(a.date || '')} · ${city}\n`
    out += `   ${a.type || 'evento'} · ${a.status || 'planejada'}`
    if (a.description) out += ` — ${a.description.slice(0, 80)}`
    out += '\n'
  })
  return out.trim()
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
    '**Por cidade:** expectativa, lideranças, agendas, demandas',
    '**Pesquisas:** intenção de voto por candidato ou município',
    '**Redes:** métricas e posts do Instagram',
    '**Geral:** chapa federal, alertas, territórios frios',
    '',
    'Fale em linguagem natural — a IA interpreta e executa.',
  ].join('\n')
}

export type ServerToolResult =
  | string
  | { content: string; pesquisaTipoPending?: PesquisaTipoChoicePending }

export async function executeServerTool(
  classified: AgentClassifiedIntent,
  origin: string,
  cookie: string,
  context?: AgentContextPayload
): Promise<ServerToolResult | null> {
  switch (classified.intent) {
    case 'consultar_pesquisas':
      return toolConsultarPesquisas(origin, cookie, classified.args)
    case 'consultar_agendas':
      return toolConsultarAgendas(origin, cookie, classified.args)
    case 'consultar_demandas':
      return toolConsultarDemandas(origin, cookie, classified.args)
    case 'consultar_alertas':
      return toolConsultarAlertas(context)
    case 'consultar_territorios_frios':
      return toolConsultarTerritoriosFrios(context)
    case 'ajuda':
      return toolAjuda(context)
    case 'navegar': {
      const url = classified.args.url?.trim()
      const label = classified.args.label?.trim() || 'Abrir página'
      if (!url) return 'Não identifiquei para qual página navegar.'
      return `Posso abrir **${label}**. Use o botão abaixo da mensagem.`
    }
    default:
      return null
  }
}

export function buildNavigateAction(
  classified: AgentClassifiedIntent
): { type: 'navigate'; url: string; label: string } | undefined {
  if (classified.intent !== 'navegar') return undefined
  const url = classified.args.url?.trim()
  if (!url || !url.startsWith('/')) return undefined
  return {
    type: 'navigate',
    url,
    label: classified.args.label?.trim() || 'Abrir página',
  }
}
