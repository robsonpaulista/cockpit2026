import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchInstagramPostsForThemeStats,
  resolveInstagramClassMap,
} from '@/lib/resumo-operacional-instagram'
import {
  aggregateThemeStatsByClassification,
  buildDigitalTemaResumoItens,
  sortThemesByAvgEngagement,
} from '@/lib/conteudo-redes-theme-stats'
import {
  normalizeTerritorioExpectativaCityKey,
} from '@/lib/territorio-expectativa-sheet'
import { buildCitySummariesFromDb } from '@/lib/territorio-liderancas-db'
import { resolverNomeMunicipioPIOficial } from '@/lib/piaui-territorio-desenvolvimento'
import {
  buildPesquisasResumoItens,
  fetchPollsNoPeriodo,
} from '@/lib/resumo-operacional-pesquisas'
import {
  buildNoticiasResumoSecao,
  fetchNoticiasDestaquePainel,
  type ResumoNoticiaDestaque,
} from '@/lib/resumo-operacional-noticias'
import { buildResumoOperacionalWhatsAppText } from '@/lib/resumo-operacional-whatsapp'

const PAGE_SIZE = 1000

export type PeriodoResumo = {
  dias: number
  inicio: string
  fim: string
  inicioAnterior: string
  fimAnterior: string
}

export type { ResumoNoticiaDestaque }

export type ResumoSecao = {
  titulo: string
  itens: string[]
  /** Itens de notícias com URL para exibição em links na página. */
  noticiasLinks?: ResumoNoticiaDestaque[]
}

export type ResumoOperacionalResponse = {
  periodo: PeriodoResumo
  cabecalho: string
  secoes: ResumoSecao[]
  alertas: string[]
  textoCompleto: string
  /** Texto formatado para copiar/enviar pelo WhatsApp. */
  textoWhatsApp: string
  geradoEm: string
}

/** Mesmas credenciais usadas em Redes & Instagram (localStorage ou env no servidor). */
export type InstagramCredentials = {
  token: string
  businessAccountId: string
}

type LeadRow = {
  id: string
  cidade: string | null
  origem: string
  created_at: string
}

type LeaderRow = {
  id: string
  municipio: string | null
  cidade: string | null
  created_at: string
}

type CoordinatorRow = {
  id: string
  created_at: string
}

type AgendaRow = {
  id: string
  city_id: string | null
  status: string
  date: string
  type: string
  cities: { name: string } | { name: string }[] | null
}

type ExpectativaCidade = {
  cidade: string
  /** Expectativa de votos 2026 — cenário anterior (legado), padrão Território & Base. */
  expectativaVotos2026: number
  /** Quantidade de lideranças na planilha. */
  liderancas: number
}

type VisitaCidadeStats = {
  cidade: string
  visitasTotal: number
  ultimaVisita: string | null
  visitasNoPeriodo: number
}

export function buildPeriodoResumo(days: number): PeriodoResumo {
  const dias = Math.min(90, Math.max(1, Math.floor(days) || 7))

  const fim = new Date()
  fim.setHours(23, 59, 59, 999)

  const inicio = new Date(fim)
  inicio.setDate(inicio.getDate() - (dias - 1))
  inicio.setHours(0, 0, 0, 0)

  const fimAnterior = new Date(inicio)
  fimAnterior.setDate(fimAnterior.getDate() - 1)
  fimAnterior.setHours(23, 59, 59, 999)

  const inicioAnterior = new Date(fimAnterior)
  inicioAnterior.setDate(inicioAnterior.getDate() - (dias - 1))
  inicioAnterior.setHours(0, 0, 0, 0)

  return {
    dias,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    inicioAnterior: inicioAnterior.toISOString(),
    fimAnterior: fimAnterior.toISOString(),
  }
}

function isInPeriod(iso: string, inicio: string, fim: string): boolean {
  const t = new Date(iso).getTime()
  return t >= new Date(inicio).getTime() && t <= new Date(fim).getTime()
}

function cityKey(name: string): string {
  return normalizeTerritorioExpectativaCityKey(name)
}

function resolveCidadeCanon(input: string): string {
  const t = input.trim()
  if (!t) return t
  return resolverNomeMunicipioPIOficial(t) ?? t
}

function extractCityName(agenda: AgendaRow): string | null {
  const cities = agenda.cities
  if (!cities) return null
  if (Array.isArray(cities)) return cities[0]?.name ?? null
  return cities.name ?? null
}

function daysSince(dateStr: string | null, ref = new Date()): number | null {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const refLocal = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  return Math.floor((refLocal.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function formatNum(n: number): string {
  return n.toLocaleString('pt-BR')
}

async function fetchPaginated<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = data ?? []
    if (page.length === 0) break
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function fetchLeads(admin: SupabaseClient): Promise<LeadRow[]> {
  return fetchPaginated(async (from, to) =>
    admin
      .from('leads_militancia')
      .select('id, cidade, origem, created_at')
      .order('created_at', { ascending: true })
      .range(from, to)
  )
}

async function fetchLeaders(admin: SupabaseClient): Promise<LeaderRow[]> {
  return fetchPaginated(async (from, to) =>
    admin
      .from('leaders')
      .select('id, municipio, cidade, created_at')
      .order('created_at', { ascending: true })
      .range(from, to)
  )
}

async function fetchCoordinators(admin: SupabaseClient): Promise<CoordinatorRow[]> {
  return fetchPaginated(async (from, to) =>
    admin
      .from('coordinators')
      .select('id, created_at')
      .order('created_at', { ascending: true })
      .range(from, to)
  )
}

async function fetchAgendas(supabase: SupabaseClient): Promise<AgendaRow[]> {
  return fetchPaginated(async (from, to) =>
    supabase
      .from('agendas')
      .select('id, city_id, status, date, type, cities ( name )')
      .not('city_id', 'is', null)
      .order('date', { ascending: false })
      .range(from, to)
  )
}

async function fetchVisitAgendaIds(supabase: SupabaseClient, agendaIds: string[]): Promise<Set<string>> {
  const withCheckin = new Set<string>()
  for (let i = 0; i < agendaIds.length; i += PAGE_SIZE) {
    const chunk = agendaIds.slice(i, i + PAGE_SIZE)
    const { data, error } = await supabase
      .from('visits')
      .select('agenda_id')
      .in('agenda_id', chunk)
      .not('checkin_time', 'is', null)
    if (error) throw error
    for (const row of data ?? []) withCheckin.add(row.agenda_id as string)
  }
  return withCheckin
}

async function loadExpectativaPorCidade(): Promise<Map<string, ExpectativaCidade>> {
  const map = new Map<string, ExpectativaCidade>()

  try {
    const { summaries } = await buildCitySummariesFromDb()
    for (const [key, summary] of summaries) {
      map.set(key, {
        cidade: resolveCidadeCanon(key) || key,
        // Padrão do sistema: Legado (Expectativa de Votos 2026)
        expectativaVotos2026: Math.round(summary.expectativaLegadoVotos),
        liderancas: Math.round(summary.liderancas),
      })
    }
  } catch (error) {
    console.error('[resumo-operacional] expectativa db', error)
  }
  return map
}

function buildVisitStats(
  agendas: AgendaRow[],
  visitAgendaIds: Set<string>,
  inicioDate: string,
  fimDate: string
): Map<string, VisitaCidadeStats> {
  const stats = new Map<string, VisitaCidadeStats>()

  for (const agenda of agendas) {
    if (!visitAgendaIds.has(agenda.id)) continue
    const rawName = extractCityName(agenda)
    if (!rawName) continue
    const key = cityKey(rawName)
    const cidade = resolveCidadeCanon(rawName)
    const prev = stats.get(key) ?? {
      cidade,
      visitasTotal: 0,
      ultimaVisita: null,
      visitasNoPeriodo: 0,
    }
    prev.visitasTotal += 1
    if (!prev.ultimaVisita || agenda.date > prev.ultimaVisita) {
      prev.ultimaVisita = agenda.date
    }
    if (agenda.date >= inicioDate && agenda.date <= fimDate) {
      prev.visitasNoPeriodo += 1
    }
    stats.set(key, prev)
  }

  return stats
}

function coberturaLeadersPct(leaders: LeaderRow[], ateIso: string): number {
  const ate = new Date(ateIso).getTime()
  const municipios = new Set<string>()
  for (const leader of leaders) {
    if (new Date(leader.created_at).getTime() > ate) continue
    const canon = resolveCidadeCanon(leader.municipio ?? leader.cidade ?? '')
    if (canon) municipios.add(cityKey(canon))
  }
  const total = 224
  return total > 0 ? Math.round((municipios.size / total) * 1000) / 10 : 0
}

function countByCityInPeriod(
  leads: LeadRow[],
  inicio: string,
  fim: string
): Array<{ cidade: string; novos: number }> {
  const map = new Map<string, { cidade: string; novos: number }>()
  for (const lead of leads) {
    if (!isInPeriod(lead.created_at, inicio, fim)) continue
    const canon = resolveCidadeCanon(lead.cidade ?? '')
    if (!canon) continue
    const key = cityKey(canon)
    const prev = map.get(key)
    if (prev) prev.novos += 1
    else map.set(key, { cidade: canon, novos: 1 })
  }
  return Array.from(map.values()).sort((a, b) => b.novos - a.novos)
}

function countMunicipiosComLiderancaMobilizacao(leaders: LeaderRow[]): number {
  const municipios = new Set<string>()
  for (const leader of leaders) {
    const canon = resolveCidadeCanon(leader.municipio ?? leader.cidade ?? '')
    if (canon) municipios.add(cityKey(canon))
  }
  return municipios.size
}

function buildLiderancasItens(
  leads: LeadRow[],
  leaders: LeaderRow[],
  coordinators: CoordinatorRow[],
  expectativaMap: Map<string, ExpectativaCidade>,
  periodo: PeriodoResumo
): string[] {
  const itens: string[] = []

  const municipiosComLiderancaPlanilha = [...expectativaMap.values()].filter((e) => e.liderancas > 0).length
  const municipiosExpectativa2026 = [...expectativaMap.values()].filter((e) => e.expectativaVotos2026 > 0).length
  const municipiosMobilizacao = countMunicipiosComLiderancaMobilizacao(leaders)

  if (expectativaMap.size > 0) {
    itens.push(`${formatNum(municipiosComLiderancaPlanilha)} municípios com lideranças`)
    itens.push(`${formatNum(municipiosExpectativa2026)} municípios com expectativa de votos 2026 > 0`)
  } else if (municipiosMobilizacao > 0) {
    itens.push(`${formatNum(municipiosMobilizacao)} municípios com liderança na mobilização`)
  }

  const novosCadastros = leads.filter((l) => isInPeriod(l.created_at, periodo.inicio, periodo.fim)).length
  const novosCoordenadores = coordinators.filter((c) =>
    isInPeriod(c.created_at, periodo.inicio, periodo.fim)
  ).length
  const coberturaAtual = coberturaLeadersPct(leaders, periodo.fim)
  const coberturaAnterior = coberturaLeadersPct(leaders, periodo.fimAnterior)
  const topCidades = countByCityInPeriod(leads, periodo.inicio, periodo.fim)

  if (novosCadastros > 0) {
    itens.push(`+${formatNum(novosCadastros)} novos cadastros`)
  }
  if (novosCoordenadores > 0) {
    itens.push(`${formatNum(novosCoordenadores)} novos coordenadores`)
  }
  if (coberturaAtual !== coberturaAnterior) {
    itens.push(`Cobertura passou de ${coberturaAnterior}% para ${coberturaAtual}%`)
  } else if (coberturaAtual > 0) {
    itens.push(`Cobertura municipal em ${coberturaAtual}%`)
  }
  if (topCidades[0]) {
    itens.push(`${topCidades[0].cidade} liderou crescimento de base (+${topCidades[0].novos})`)
  }
  if (itens.length === 0) {
    itens.push('Nenhum movimento relevante de mobilização no período')
  }
  return itens
}

function buildTerritorioItens(
  expectativaMap: Map<string, ExpectativaCidade>,
  visitStats: Map<string, VisitaCidadeStats>,
  periodo: PeriodoResumo
): string[] {
  const itens: string[] = []
  const inicioDate = periodo.inicio.slice(0, 10)
  const fimDate = periodo.fim.slice(0, 10)

  const visitasNoPeriodo = [...visitStats.values()].filter((v) => v.visitasNoPeriodo > 0)
  const municipiosVisitados = new Set(
    visitasNoPeriodo.map((v) => cityKey(v.cidade))
  ).size

  if (municipiosVisitados > 0) {
    itens.push(`${formatNum(municipiosVisitados)} municípios receberam visitas no período`)
  }

  const recentes = [...visitStats.values()]
    .filter((v) => v.ultimaVisita && v.ultimaVisita >= inicioDate && v.ultimaVisita <= fimDate)
    .sort((a, b) => (b.ultimaVisita ?? '').localeCompare(a.ultimaVisita ?? ''))
    .slice(0, 5)
    .map((v) => v.cidade)

  if (recentes.length > 0) {
    itens.push(`Visitas recentes: ${recentes.join(', ')}`)
  }

  type GapRow = {
    cidade: string
    expectativa: number
    visitas: number
    diasSemVisita: number | null
    score: number
  }

  const gaps: GapRow[] = []
  const expectativas = [...expectativaMap.values()]
    .map((e) => e.expectativaVotos2026)
    .filter((v) => v > 0)
  const mediana =
    expectativas.length > 0
      ? [...expectativas].sort((a, b) => a - b)[Math.floor(expectativas.length / 2)]
      : 0
  const limiar = Math.max(mediana, 200)

  for (const [key, exp] of expectativaMap) {
    if (exp.expectativaVotos2026 < limiar) continue
    const visita = visitStats.get(key)
    const visitas = visita?.visitasTotal ?? 0
    const diasSemVisita = daysSince(visita?.ultimaVisita ?? null)
    const score = exp.expectativaVotos2026 / Math.max(visitas, 0.25)
    gaps.push({
      cidade: exp.cidade,
      expectativa: exp.expectativaVotos2026,
      visitas,
      diasSemVisita,
      score,
    })
  }

  gaps.sort((a, b) => b.score - a.score)

  const semVisita = gaps.filter((g) => g.visitas === 0).slice(0, 3)
  for (const g of semVisita) {
    itens.push(
      `${g.cidade} concentra ${formatNum(g.expectativa)} votos (expectativa anterior 2026) e nenhuma visita registrada`
    )
  }

  const poucasVisitas = gaps.filter((g) => g.visitas > 0 && g.visitas <= 1).slice(0, 2)
  for (const g of poucasVisitas) {
    itens.push(
      `${g.cidade} tem ${formatNum(g.expectativa)} votos de expectativa anterior 2026 com apenas ${g.visitas} visita registrada`
    )
  }

  const inativos60 = gaps.filter((g) => g.diasSemVisita !== null && g.diasSemVisita >= 60)
  if (inativos60.length > 0) {
    itens.push(
      `${formatNum(inativos60.length)} municípios com alta expectativa estão há mais de 60 dias sem visita`
    )
  }

  if (expectativaMap.size === 0 && itens.length === 0) {
    itens.push('Configure a planilha de Território & Base para cruzar expectativa de votos com visitas')
  } else if (itens.length === 0) {
    itens.push('Nenhuma visita registrada no período — priorize municípios com maior expectativa')
  }

  return itens
}

function appendDigitalSemTemas(
  itens: string[],
  posts: { id: string }[],
  classCount: number,
  postsError?: string
): void {
  if (posts.length > 0 && classCount > 0) {
    itens.push(
      `${formatNum(posts.length)} publicações na API, ${formatNum(classCount)} temas salvos — verifique se os IDs coincidem com as classificações em Redes & Instagram`
    )
    return
  }
  if (posts.length > 0) {
    itens.push(
      `${formatNum(posts.length)} publicações no Instagram — classifique os temas em Redes & Instagram (Posts & Insights)`
    )
    return
  }
  if (classCount > 0) {
    itens.push(
      `${formatNum(classCount)} temas classificados no sistema, mas a API do Instagram não retornou publicações${postsError ? `: ${postsError}` : ''}`
    )
    return
  }
  if (postsError) {
    itens.push(postsError)
    return
  }
  itens.push(
    'Não foi possível carregar publicações do Instagram — abra Redes & Instagram e confirme que os dados carregam antes de gerar o resumo'
  )
}

async function buildDigitalItens(
  admin: SupabaseClient,
  supabase: SupabaseClient,
  userId: string,
  _periodo: PeriodoResumo,
  instagram?: InstagramCredentials | null
): Promise<string[]> {
  const itens: string[] = []
  const inicioDate = _periodo.inicio.slice(0, 10)

  const [historyRes, classRes] = await Promise.all([
    supabase
      .from('instagram_metrics_history')
      .select('snapshot_date, followers_count, reach, total_interactions')
      .eq('user_id', userId)
      .gte('snapshot_date', inicioDate)
      .order('snapshot_date', { ascending: true }),
    admin
      .from('instagram_post_classifications')
      .select('identifier, theme')
      .eq('user_id', userId),
  ])

  const classMap = resolveInstagramClassMap(classRes.data)
  const classCount = Object.keys(classMap).length

  const { posts, error: postsError } = await fetchInstagramPostsForThemeStats({
    mediaLimit: 50,
    insightsPostLimit: 20,
    token: instagram?.token,
    businessAccountId: instagram?.businessAccountId,
  })

  const history = historyRes.data ?? []
  if (history.length >= 2) {
    const growth = history[history.length - 1].followers_count - history[0].followers_count
    const total = history[history.length - 1].followers_count
    if (growth !== 0) {
      itens.push(
        `${growth > 0 ? '+' : ''}${formatNum(growth)} seguidores no período (${formatNum(total)} total)`
      )
    }
  } else if (history.length === 1) {
    itens.push(`${formatNum(history[0].followers_count)} seguidores`)
  }

  const themeStats = aggregateThemeStatsByClassification(posts, classMap)
  const sortedThemes = sortThemesByAvgEngagement(themeStats)

  if (sortedThemes.length > 0) {
    itens.push(...buildDigitalTemaResumoItens(sortedThemes))
  } else {
    appendDigitalSemTemas(itens, posts, classCount, postsError)
  }

  if (itens.length === 0) {
    itens.push(
      'Configure o Instagram em Redes & Instagram (token salvo no navegador) ou INSTAGRAM_TOKEN e INSTAGRAM_BUSINESS_ID no servidor'
    )
  }

  return itens
}

export function buildTextoCompleto(cabecalho: string, secoes: ResumoSecao[]): string {
  const linhas = [cabecalho, '']
  for (const secao of secoes) {
    linhas.push(secao.titulo)
    if (secao.titulo === 'Notícias' && secao.noticiasLinks && secao.noticiasLinks.length > 0) {
      const intro = secao.itens[0]
      if (intro) linhas.push(`• ${intro}`)
      for (const n of secao.noticiasLinks) {
        const bloco = [
          [n.dataFmt, n.source].filter(Boolean).join(' · ') + (n.meta ? ` (${n.meta})` : ''),
          n.title,
          n.url,
        ]
          .filter(Boolean)
          .join('\n')
        linhas.push(`• ${bloco}`)
      }
    } else {
      for (const item of secao.itens) {
        linhas.push(`• ${item}`)
      }
    }
    linhas.push('')
  }
  return linhas.join('\n').trim()
}

export async function buildResumoOperacional(
  admin: SupabaseClient,
  supabase: SupabaseClient,
  periodo: PeriodoResumo,
  userId: string,
  instagram?: InstagramCredentials | null
): Promise<ResumoOperacionalResponse> {
  const inicioDate = periodo.inicio.slice(0, 10)
  const fimDate = periodo.fim.slice(0, 10)

  const [leads, leaders, coordinators, agendas, expectativaMap, pollsPeriodo, noticiasDestaque] =
    await Promise.all([
      fetchLeads(admin),
      fetchLeaders(admin),
      fetchCoordinators(admin),
      fetchAgendas(supabase),
      loadExpectativaPorCidade(),
      fetchPollsNoPeriodo(admin, periodo),
      fetchNoticiasDestaquePainel(admin),
    ])

  const digitalItens = await buildDigitalItens(admin, supabase, userId, periodo, instagram)
  const pesquisasItens = buildPesquisasResumoItens(pollsPeriodo, periodo)
  const noticiasSecao = buildNoticiasResumoSecao(noticiasDestaque)

  const visitAgendaIds = await fetchVisitAgendaIds(
    supabase,
    agendas.map((a) => a.id)
  )
  const visitStats = buildVisitStats(agendas, visitAgendaIds, inicioDate, fimDate)

  const liderancasItens = buildLiderancasItens(leads, leaders, coordinators, expectativaMap, periodo)
  const territorioItens = buildTerritorioItens(expectativaMap, visitStats, periodo)

  const cabecalho = `COCKPIT | RESUMO DA SEMANA (${periodo.dias} DIAS)`
  const secoes: ResumoSecao[] = [
    { titulo: 'Lideranças', itens: liderancasItens },
    { titulo: 'Território', itens: territorioItens },
    { titulo: 'Pesquisas', itens: pesquisasItens },
    { titulo: 'Digital', itens: digitalItens },
    {
      titulo: 'Notícias',
      itens: noticiasSecao.itens,
      noticiasLinks: noticiasSecao.noticiasLinks,
    },
  ]

  const alertas: string[] = []
  const gapsCriticos = [...expectativaMap.entries()].filter(([key, exp]) => {
    const visita = visitStats.get(key)
    return exp.expectativaVotos2026 >= 200 && (visita?.visitasTotal ?? 0) === 0
  })
  if (gapsCriticos.length > 0) {
    alertas.push(
      `${gapsCriticos.length} municípios com expectativa relevante ainda sem nenhuma visita registrada`
    )
  }

  const payload: ResumoOperacionalResponse = {
    periodo,
    cabecalho,
    secoes,
    alertas,
    textoCompleto: buildTextoCompleto(cabecalho, secoes),
    textoWhatsApp: '',
    geradoEm: new Date().toISOString(),
  }
  payload.textoWhatsApp = buildResumoOperacionalWhatsAppText(payload)
  return payload
}
