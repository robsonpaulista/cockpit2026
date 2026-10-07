import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import type { GoogleTrendsCompareRow, GoogleTrendsSeries } from '@/lib/google-trends-types'
import type { InstagramRadarCollectStatus, InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import { readResponseJson } from '@/lib/parse-response-json'
import type { PoliticalActorType, PoliticalActorWithTerms, YoutubeMentionWithActor } from '@/lib/youtube-radar-types'
import type { NewsItem } from '@/types'

/** Resposta das listagens do radar: Supabase pode responder 503 "retryable" ou pedir setup das tabelas. */
export type RadarLeitura<T> = {
  dados: T
  setupRequired: boolean
  instavel: boolean
}

type RespostaBase = {
  error?: string
  retryable?: boolean
  setupRequired?: boolean
}

const SEM_CACHE: RequestInit = { cache: 'no-store' }

function postJson(url: string, body: unknown = {}): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function lerLista<T>(
  url: string,
  extrair: (json: RespostaBase & Record<string, unknown>) => T,
  vazio: T,
  erroPadrao: string,
): Promise<RadarLeitura<T>> {
  const res = await fetch(url, SEM_CACHE)
  const json = (await res.json()) as RespostaBase & Record<string, unknown>
  if (res.ok) {
    return { dados: extrair(json), setupRequired: Boolean(json.setupRequired), instavel: false }
  }
  if (json.setupRequired) return { dados: vazio, setupRequired: true, instavel: false }
  if (json.retryable) return { dados: vazio, setupRequired: false, instavel: true }
  throw new Error(json.error ?? erroPadrao)
}

/* Candidatos monitorados (tabela compartilhada por todas as abas) */

export type RadarAtoresLeitura = RadarLeitura<PoliticalActorWithTerms[]> & {
  youtubeConfigurado: boolean | null
}

export async function fetchRadarAtores(): Promise<RadarAtoresLeitura> {
  const res = await fetch('/api/monitoramento/actors', SEM_CACHE)
  const json = (await res.json()) as RespostaBase & {
    configured?: boolean
    actors?: PoliticalActorWithTerms[]
  }
  if (res.ok) {
    return {
      dados: json.actors ?? [],
      setupRequired: Boolean(json.setupRequired),
      instavel: false,
      youtubeConfigurado: Boolean(json.configured),
    }
  }
  return {
    dados: [],
    setupRequired: Boolean(json.setupRequired),
    instavel: Boolean(json.retryable),
    youtubeConfigurado: null,
  }
}

async function exigirOk(res: Response, erroPadrao: string): Promise<Record<string, unknown>> {
  const texto = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = texto.trim() ? (JSON.parse(texto) as Record<string, unknown>) : {}
  } catch {
    if (!res.ok) throw new Error(erroPadrao)
  }
  if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : erroPadrao)
  return json
}

export async function criarRadarAtor(input: {
  name: string
  actor_type: PoliticalActorType
  terms: string[]
}): Promise<void> {
  await exigirOk(await postJson('/api/youtube/actors', input), 'Falha ao criar candidato.')
}

export async function atualizarRadarAtor(
  id: string,
  patch: { active?: boolean; instagram_username?: string | null },
): Promise<void> {
  const res = await fetch(`/api/youtube/actors/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  await exigirOk(res, 'Falha ao atualizar candidato.')
}

export async function removerRadarAtor(id: string): Promise<void> {
  await exigirOk(await fetch(`/api/youtube/actors/${id}`, { method: 'DELETE' }), 'Falha ao remover candidato.')
}

export async function adicionarRadarTermo(actorId: string, term: string): Promise<void> {
  await exigirOk(await postJson(`/api/youtube/actors/${actorId}/terms`, { term }), 'Falha ao adicionar termo.')
}

export async function removerRadarTermo(termId: string): Promise<void> {
  await exigirOk(await fetch(`/api/youtube/search-terms/${termId}`, { method: 'DELETE' }), 'Falha ao remover termo.')
}

/* YouTube */

export function fetchYoutubeMencoes(dias: number): Promise<RadarLeitura<YoutubeMentionWithActor[]>> {
  return lerLista(
    `/api/youtube/mentions?politico=all&days=${dias}&limit=500`,
    (j) => (j.mentions as YoutubeMentionWithActor[] | undefined) ?? [],
    [],
    'Falha ao carregar vídeos.',
  )
}

export async function coletarYoutube(dias: number): Promise<string> {
  const res = await postJson('/api/youtube/collect', { lookbackDays: dias })
  const j = (await res.json()) as {
    error?: string
    totals?: { videosFound: number; videosInserted: number; videosUpdated: number; quotaEstimate: number }
  }
  if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')
  const t = j.totals
  return t
    ? `${t.videosFound} vídeos encontrados · ${t.videosInserted} novos · ${t.videosUpdated} atualizados · ~${t.quotaEstimate} un. de quota`
    : 'Coleta concluída.'
}

/* Google Notícias */

export function fetchNoticiasMencoes(dias: number): Promise<RadarLeitura<GoogleNewsMentionWithActor[]>> {
  return lerLista(
    `/api/google-news/mentions?politico=all&days=${dias}&limit=500&channel=news`,
    (j) => (j.mentions as GoogleNewsMentionWithActor[] | undefined) ?? [],
    [],
    'Falha ao carregar notícias.',
  )
}

/** Matérias de um candidato num dia (`data` em YYYY-MM-DD). */
export async function fetchNoticiasDoDia(slug: string, data: string): Promise<GoogleNewsMentionWithActor[]> {
  const params = new URLSearchParams({ politico: slug, date: data, limit: '100', channel: 'news' })
  const leitura = await lerLista(
    `/api/google-news/mentions?${params.toString()}`,
    (j) => (j.mentions as GoogleNewsMentionWithActor[] | undefined) ?? [],
    [],
    'Falha ao carregar matérias.',
  )
  return leitura.dados
}

export async function fetchNoticiasBuscaWebAtiva(): Promise<boolean> {
  try {
    const res = await fetch('/api/google-news/collect', SEM_CACHE)
    const j = (await res.json()) as { webSearchEnabled?: boolean }
    return Boolean(j.webSearchEnabled)
  } catch {
    return false
  }
}

export async function coletarNoticias(): Promise<string> {
  const res = await postJson('/api/google-news/collect')
  const j = (await res.json()) as {
    error?: string
    webSearchEnabled?: boolean
    totals?: { articlesFound: number; articlesInserted: number; articlesUpdated: number; webArticlesFound?: number }
  }
  if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')
  const t = j.totals
  if (!t) return 'Coleta concluída.'
  const web =
    j.webSearchEnabled && t.webArticlesFound != null && t.webArticlesFound > 0
      ? ` · ${t.webArticlesFound} na busca web`
      : ''
  return `${t.articlesFound} no Google Notícias${web} · ${t.articlesInserted} novas · ${t.articlesUpdated} atualizadas`
}

/* Instagram (concorrentes) */

export type InstagramRadarStatus = InstagramRadarCollectStatus & { message?: string }

export type InstagramRadarDados = {
  atores: PoliticalActorWithTerms[]
  posts: InstagramRadarPostWithActor[]
  status: InstagramRadarStatus | null
}

export async function fetchInstagramRadar(dias: number, tentativa = 0): Promise<RadarLeitura<InstagramRadarDados>> {
  const res = await fetch(`/api/instagram-radar/bootstrap?days=${dias}&limit=400`, SEM_CACHE)
  const json = (await res.json()) as RespostaBase & {
    actors?: PoliticalActorWithTerms[]
    posts?: InstagramRadarPostWithActor[]
    status?: InstagramRadarStatus
  }
  if ((res.status === 503 || json.retryable) && tentativa < 2) {
    await esperar(2500 * (tentativa + 1))
    return fetchInstagramRadar(dias, tentativa + 1)
  }
  if (!res.ok && !json.setupRequired) throw new Error(json.error ?? 'Falha ao carregar Instagram.')
  return {
    dados: { atores: json.actors ?? [], posts: res.ok ? (json.posts ?? []) : [], status: json.status ?? null },
    setupRequired: Boolean(json.setupRequired),
    instavel: false,
  }
}

export async function fetchInstagramRadarStatus(): Promise<InstagramRadarStatus | null> {
  const res = await fetch('/api/instagram-radar/status', SEM_CACHE)
  const json = (await res.json()) as InstagramRadarStatus & RespostaBase
  if (!res.ok && !json.setupRequired) return null
  return json
}

export async function coletarInstagramRadar(businessAccountId: string | undefined): Promise<{
  mensagem: string
  avisos: string[]
}> {
  const res = await postJson('/api/instagram-radar/collect', { instagramBusinessAccountId: businessAccountId })
  const j = (await res.json()) as {
    error?: string
    totals?: { postsFound: number; postsInserted: number; postsUpdated: number; errors?: string[] }
  }
  if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')
  const t = j.totals
  return {
    mensagem: t ? `${t.postsFound} posts · ${t.postsInserted} novos · ${t.postsUpdated} atualizados` : 'Coleta concluída.',
    avisos: (t?.errors ?? []).filter(Boolean),
  }
}

/* Meta Ads */

export function fetchMetaAdsMencoes(dias: number): Promise<RadarLeitura<MetaAdsMentionWithActor[]>> {
  return lerLista(
    `/api/meta-ads/mentions?politico=all&days=${dias}&limit=500`,
    (j) => (j.ads as MetaAdsMentionWithActor[] | undefined) ?? [],
    [],
    'Falha ao carregar anúncios.',
  )
}

export async function coletarMetaAds(): Promise<{ mensagem: string; avisos: string[] }> {
  const res = await postJson('/api/meta-ads/collect')
  const j = (await res.json()) as {
    error?: string
    totals?: { adsFound: number; adsInserted: number; adsUpdated: number; errors?: string[] }
  }
  if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')
  const t = j.totals
  return {
    mensagem: t
      ? `${t.adsFound} anúncios encontrados · ${t.adsInserted} novos · ${t.adsUpdated} atualizados`
      : 'Coleta concluída.',
    avisos: (t?.errors ?? []).filter(Boolean),
  }
}

/* Google Trends */

export type TrendsInteresse = {
  series: GoogleTrendsSeries[]
  compare: GoogleTrendsCompareRow[]
  chartData: Array<Record<string, string | number>>
  setupRequired: boolean
  collectedAt: string | null
  dateFrom: string | null
  dateTo: string | null
  seriesStale: boolean
}

export async function fetchTrendsInteresse(geo: string, timeframe: string): Promise<TrendsInteresse> {
  const res = await fetch(
    `/api/trends/interest?geo=${encodeURIComponent(geo)}&timeframe=${encodeURIComponent(timeframe)}`,
    SEM_CACHE,
  )
  const j = await readResponseJson<Partial<TrendsInteresse> & { error?: string }>(res)
  if (!res.ok) throw new Error(j.error ?? 'Falha ao carregar buscas.')
  return {
    series: j.series ?? [],
    compare: j.compare ?? [],
    chartData: j.chartData ?? [],
    setupRequired: Boolean(j.setupRequired),
    collectedAt: j.collectedAt ?? null,
    dateFrom: j.dateFrom ?? null,
    dateTo: j.dateTo ?? null,
    seriesStale: Boolean(j.seriesStale),
  }
}

export type TrendsStatus = {
  runnerAvailable?: boolean
  runnerMessage?: string | null
  setupRequired?: boolean
  collectInProgress?: boolean
  lastCollectResult?: {
    terms?: number
    termsSucceeded?: number
    rowsUpserted?: number
    relatedRowsUpserted?: number
    errors?: string[]
  } | null
  lastCollectError?: string | null
}

export async function fetchTrendsStatus(): Promise<TrendsStatus | null> {
  const res = await fetch('/api/trends/status', SEM_CACHE)
  const j = await readResponseJson<TrendsStatus>(res)
  return res.ok ? j : null
}

export async function iniciarColetaTrends(geo: string, timeframe: string): Promise<void> {
  const res = await postJson('/api/trends/collect', { geo, timeframe, skipRelated: true })
  const j = await readResponseJson<{ error?: string }>(res)
  if (res.status === 503) throw new Error(j.error ?? 'Coleta indisponível neste servidor.')
  if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')
}

/** Acompanha a coleta assíncrona do Trends até terminar (máx. 3 min) e devolve o resumo. */
export async function aguardarColetaTrends(): Promise<string | null> {
  const inicio = Date.now()
  while (Date.now() - inicio < 180_000) {
    const j = await fetchTrendsStatus()
    if (j && !j.collectInProgress) {
      if (j.lastCollectError) throw new Error(j.lastCollectError)
      const r = j.lastCollectResult
      if (!r) return null
      const ok = r.termsSucceeded ?? 0
      const total = r.terms ?? 0
      const rel = r.relatedRowsUpserted ?? 0
      const relTxt = rel > 0 ? ` · ${rel} relacionados` : ''
      return ok === total
        ? `${ok} nomes · ${r.rowsUpserted ?? 0} pontos${relTxt}`
        : `Coleta parcial: ${ok}/${total} nomes · ${r.rowsUpserted ?? 0} pontos${relTxt}${
            r.errors?.length ? `. Falhas: ${r.errors.join('; ')}` : ''
          }`
    }
    await esperar(2000)
  }
  throw new Error('Tempo esgotado na coleta do Google Trends.')
}

/* Alertas (inbox RSS) */

export type AlertaFeedTipo = 'user_feed' | 'adversary_feed'

export type AlertaFeed = {
  id: string
  name: string
  rss_url: string
  type: AlertaFeedTipo
  active?: boolean
  auto_classify?: boolean
  last_collected_at?: string
}

export type AlertaFeedForm = {
  name: string
  rss_url: string
  auto_classify: boolean
  type: AlertaFeedTipo
}

function putJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Cria ou atualiza um alerta: feed do candidato (`user_feed`) ou Google Alerts de adversário. */
export async function salvarAlertaFeed(form: AlertaFeedForm, id?: string): Promise<void> {
  const adversario = form.type === 'adversary_feed'
  const base = adversario ? '/api/noticias/adversarios' : '/api/noticias/feeds'
  const corpo = adversario
    ? { name: form.name, google_alerts_rss_url: form.rss_url, ...(id ? {} : { type: 'other' }) }
    : { name: form.name, rss_url: form.rss_url, auto_classify: form.auto_classify }
  const res = id ? await putJson(`${base}/${id}`, corpo) : await postJson(base, corpo)
  await exigirOk(res, 'Erro ao salvar alerta.')
}

export async function removerAlertaFeed(feed: AlertaFeed): Promise<void> {
  const base = feed.type === 'adversary_feed' ? '/api/noticias/adversarios' : '/api/noticias/feeds'
  await exigirOk(await fetch(`${base}/${feed.id}`, { method: 'DELETE' }), 'Erro ao remover alerta.')
}

export async function alternarAlertaFeedAtivo(feed: AlertaFeed): Promise<void> {
  await exigirOk(await putJson(`/api/noticias/feeds/${feed.id}`, { active: !feed.active }), 'Erro ao atualizar alerta.')
}

/** Coleta só deste alerta; devolve quantas notícias entraram. */
export async function coletarAlertaFeed(feed: AlertaFeed): Promise<number> {
  const res =
    feed.type === 'user_feed'
      ? await postJson('/api/noticias/collect/google-alerts', {
          rss_url: feed.rss_url,
          auto_classify: feed.auto_classify ?? true,
          feed_id: feed.id,
        })
      : await postJson('/api/noticias/adversarios/collect', { adversary_id: feed.id })
  const json = await exigirOk(res, 'Erro ao coletar notícias.')
  return typeof json.collected === 'number' ? json.collected : 0
}

export type AlertaClassificacao = {
  sentiment: string | null
  risk_level: string | null
  theme: string | null
  notes: string | null
}

export async function classificarAlerta(id: string, dados: AlertaClassificacao): Promise<void> {
  await exigirOk(await putJson(`/api/noticias/${id}`, { ...dados, reviewed: true }), 'Erro ao atualizar notícia.')
}

export async function fetchAlertasNoticias(): Promise<NewsItem[] | null> {
  try {
    const res = await fetch('/api/noticias?limit=100')
    return res.ok ? ((await res.json()) as NewsItem[]) : null
  } catch {
    return null
  }
}

export async function fetchAlertasFeeds(): Promise<AlertaFeed[] | null> {
  try {
    const res = await fetch('/api/noticias/all-feeds')
    return res.ok ? ((await res.json()) as AlertaFeed[]) : null
  } catch {
    return null
  }
}

type ResultadoColeta = { collected?: number; high_risk?: number }

/** Coleta todos os feeds do candidato e de adversários; devolve o total e quantas são de risco alto. */
export async function coletarAlertas(): Promise<{ coletadas: number; altoRisco: number }> {
  const respostas = await Promise.all([
    fetch('/api/noticias/collect/my-feeds', { method: 'POST' }),
    postJson('/api/noticias/adversarios/collect'),
  ])
  let coletadas = 0
  let altoRisco = 0
  for (const res of respostas) {
    if (!res.ok) continue
    const json = await readResponseJson<ResultadoColeta>(res).catch((): ResultadoColeta => ({}))
    coletadas += json.collected ?? 0
    altoRisco += json.high_risk ?? 0
  }
  return { coletadas, altoRisco }
}

export async function alternarDestaqueAlerta(
  id: string,
  destacar: boolean,
): Promise<{ rebaixadoId: string | null }> {
  const res = await fetch(`/api/noticias/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dashboard_highlight: destacar }),
  })
  if (!res.ok) throw new Error('Falha ao destacar notícia.')
  const data = (await res.json()) as { demoted_highlight_id?: string | null }
  return { rebaixadoId: data.demoted_highlight_id ?? null }
}
