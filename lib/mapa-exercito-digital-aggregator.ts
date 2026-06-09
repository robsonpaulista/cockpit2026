import type { InstagramPostWithComments, InstagramStoredComment } from '@/lib/instagramApi'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import type { LiderInstagramCoberturaDto } from '@/lib/mobilizacao-lideres-instagram-cobertura-client'
import {
  mergeLideradosEngajamentoPorHandle,
  type LiderDesempenhoIgLinha,
} from '@/lib/mobilizacao-lideres-desempenho-ig-por-td-client'
import type { RelatorioMapaDigitalIgTdPayload } from '@/lib/relatorio-mapa-digital-ig-td-types'
import type {
  AlertPostStatus,
  ExercitoDigitalAlertPost,
  ExercitoDigitalCityRow,
  ExercitoDigitalKpis,
  ExercitoDigitalLeaderRow,
  ExercitoDigitalTrendPoint,
  ExercitoDigitalViewModel,
  LeaderFilterTab,
  LeaderStatusDot,
  LeaderTrendKind,
} from '@/lib/mapa-exercito-digital-types'

const META_ATIVACAO = 70
const fmtPct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmtInt = new Intl.NumberFormat('pt-BR')

type MergedLeader = LiderDesempenhoIgLinha

function timestampMediaPostedAt(p: InstagramPostWithComments): number {
  const raw = p.media_posted_at
  if (!raw) return 0
  const t = Date.parse(raw)
  return Number.isNaN(t) ? 0 : t
}

function timestampComment(c: InstagramStoredComment): number {
  const raw = c.commented_at || c.synced_at
  if (!raw) return 0
  const t = Date.parse(raw)
  return Number.isNaN(t) ? 0 : t
}

function filterPostsByLookback(posts: InstagramPostWithComments[], lookbackDays: number): InstagramPostWithComments[] {
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000
  return posts.filter((p) => {
    const t = timestampMediaPostedAt(p)
    return t === 0 || t >= cutoff
  })
}

function buildLideradosHandleSet(lideres: LiderInstagramCoberturaDto[]): Set<string> {
  const handles = new Set<string>()
  for (const lider of lideres) {
    for (const handle of lider.handles) {
      const normalized = normalizeInstagramHandle(handle)
      if (normalized) handles.add(normalized)
    }
  }
  return handles
}

function commentersNormalizados(comments: InstagramStoredComment[]): Set<string> {
  const s = new Set<string>()
  for (const c of comments) {
    const h = normalizeInstagramHandle(c.commenter_username)
    if (h) s.add(h)
  }
  return s
}

function analisarCoberturaLideres(lideres: LiderInstagramCoberturaDto[], commenters: Set<string>) {
  const comRede = lideres.filter((l) => l.handles.length > 0)
  const comentaram = comRede.filter((l) => l.handles.some((h) => commenters.has(h)))
  const nMedido = comRede.length
  const nOk = comentaram.length
  const pct = nMedido > 0 ? (nOk / nMedido) * 100 : 0
  return { comRede, comentaram, nMedido, nOk, pct }
}

function mergeLeadersAcrossTds(rows: LiderDesempenhoIgLinha[]): MergedLeader[] {
  const map = new Map<string, MergedLeader>()
  for (const row of rows) {
    const cur = map.get(row.id)
    if (!cur) {
      map.set(row.id, { ...row, lideradosEngajamento: row.lideradosEngajamento ? [...row.lideradosEngajamento] : [] })
      continue
    }
    cur.lideradosComRede = Math.max(cur.lideradosComRede, row.lideradosComRede)
    cur.publicacoes = Math.max(cur.publicacoes, row.publicacoes)
    cur.comentarios += row.comentarios
    cur.lideradosQueComentaram = Math.max(cur.lideradosQueComentaram, row.lideradosQueComentaram)
    cur.pctParticipacao = cur.lideradosComRede > 0 ? (cur.lideradosQueComentaram / cur.lideradosComRede) * 100 : 0
    const mergedHandles = new Set([...cur.lideradosInstagram, ...row.lideradosInstagram])
    cur.lideradosInstagram = [...mergedHandles]
    cur.lideradosEngajamento = mergeLideradosEngajamentoPorHandle(cur.lideradosEngajamento, row.lideradosEngajamento)
  }
  return [...map.values()]
}

function startOfWeek(ref: Date): Date {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - ((day + 6) % 7))
  return d
}

function weeklyCommentCountsForHandles(
  posts: InstagramPostWithComments[],
  handles: Set<string>,
  now = new Date()
): number[] {
  const weekStarts: Date[] = []
  const monday = startOfWeek(now)
  for (let i = 4; i >= 0; i--) {
    const w = new Date(monday)
    w.setDate(monday.getDate() - i * 7)
    weekStarts.push(w)
  }

  const counts = [0, 0, 0, 0, 0]
  for (const post of posts) {
    for (const c of post.comments) {
      const h = normalizeInstagramHandle(c.commenter_username)
      if (!h || !handles.has(h)) continue
      const t = timestampComment(c)
      if (t <= 0) continue
      for (let i = 0; i < weekStarts.length; i++) {
        const start = weekStarts[i]!.getTime()
        const end = start + 7 * 24 * 60 * 60 * 1000
        if (t >= start && t < end) {
          counts[i]! += 1
          break
        }
      }
    }
  }
  return counts
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function computeTrend(weekly: number[]): {
  kind: LeaderTrendKind
  label: string
  deltaPct: number | null
  inactiveWeeks: number
} {
  const current = weekly[4] ?? 0
  const previous = weekly[3] ?? 0
  const delta = pctChange(current, previous)

  let inactiveWeeks = 0
  for (let i = weekly.length - 1; i >= 0; i--) {
    if ((weekly[i] ?? 0) === 0) inactiveWeeks += 1
    else break
  }

  if (inactiveWeeks >= 2) {
    return {
      kind: 'inactive',
      label: `Inativo há ${inactiveWeeks}sem`,
      deltaPct: delta,
      inactiveWeeks,
    }
  }

  const w2 = weekly[2] ?? 0
  const w1 = weekly[1] ?? 0
  const w0 = weekly[0] ?? 0
  if (w0 < w1 && w1 < w2 && w2 < previous && previous < current) {
    return { kind: 'accelerating', label: 'Crescendo', deltaPct: delta, inactiveWeeks: 0 }
  }

  if (delta != null && delta >= 15) {
    return { kind: 'growing', label: `+${Math.round(delta)}% semana`, deltaPct: delta, inactiveWeeks: 0 }
  }
  if (delta != null && delta <= -15) {
    return { kind: 'falling', label: `-${Math.abs(Math.round(delta))}% semana`, deltaPct: delta, inactiveWeeks: 0 }
  }
  return { kind: 'stable', label: 'Estável', deltaPct: delta, inactiveWeeks: 0 }
}

function computeStatusDot(
  ativacaoPct: number,
  trendKind: LeaderTrendKind,
  inactiveWeeks: number
): LeaderStatusDot {
  if (inactiveWeeks >= 2 || ativacaoPct < 5) return 'red'
  if (ativacaoPct > 30 && (trendKind === 'growing' || trendKind === 'accelerating' || trendKind === 'stable')) {
    return 'green'
  }
  if (ativacaoPct >= 5 && ativacaoPct <= 30) return 'amber'
  if (ativacaoPct > 30 && trendKind === 'falling') return 'amber'
  return 'gray'
}

function computeConsistencia(trendKind: LeaderTrendKind, variacaoPct: number | null): string {
  if (trendKind === 'accelerating') return 'Em aceleração'
  if (trendKind === 'inactive') return 'Inconsistente'
  if (trendKind === 'falling' && variacaoPct != null && variacaoPct <= -30) return 'Queda abrupta'
  if (trendKind === 'growing' || trendKind === 'stable') return 'Alta'
  if (trendKind === 'falling') return 'Baixa, regular'
  return 'Inconsistente'
}

function formatPostMeta(post: InstagramPostWithComments): string {
  const raw = post.media_posted_at
  const total = post.comments.length
  if (!raw) return `${fmtInt.format(total)} comentários`
  const d = new Date(raw)
  const date = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time} · ${fmtInt.format(total)} comentários`
}

function truncateCaption(caption: string | null | undefined, max = 72): string {
  const t = (caption ?? '').trim() || 'Sem legenda'
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function postAlertStatus(pct: number): AlertPostStatus | null {
  if (pct < 30) return 'Crítico'
  if (pct < 60) return 'Atenção'
  return null
}

function buildAlertPosts(
  posts: InstagramPostWithComments[],
  lideres: LiderInstagramCoberturaDto[]
): ExercitoDigitalAlertPost[] {
  const alerts: ExercitoDigitalAlertPost[] = []
  for (const post of posts) {
    const commenters = commentersNormalizados(post.comments)
    const { comentaram, nMedido, nOk, pct } = analisarCoberturaLideres(lideres, commenters)
    const status = postAlertStatus(pct)
    if (!status) continue
    alerts.push({
      id: post.instagram_media_id,
      status,
      title: truncateCaption(post.media_caption),
      meta: formatPostMeta(post),
      ativados: comentaram.length,
      naoAtivados: nMedido - nOk,
    })
  }
  const order = { Crítico: 0, Atenção: 1 }
  return alerts.sort((a, b) => order[a.status] - order[b.status] || b.naoAtivados - a.naoAtivados)
}

function buildTrendPoints(
  posts: InstagramPostWithComments[],
  lideradosHandles: Set<string>
): ExercitoDigitalTrendPoint[] {
  const linhas = posts
    .map((post) => {
      const total = post.comments.length
      let liderados = 0
      for (const c of post.comments) {
        const h = normalizeInstagramHandle(c.commenter_username)
        if (h && lideradosHandles.has(h)) liderados += 1
      }
      const organico = total - liderados
      const sortMs = timestampMediaPostedAt(post)
      const label =
        sortMs > 0
          ? new Date(sortMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : 'Sem data'
      return {
        label,
        pctLiderados: total > 0 ? (liderados / total) * 100 : 0,
        pctOrganicos: total > 0 ? (organico / total) * 100 : 0,
        sortMs,
      }
    })
    .sort((a, b) => a.sortMs - b.sortMs)

  return linhas.slice(-14)
}

function buildCities(relatorio: RelatorioMapaDigitalIgTdPayload): ExercitoDigitalCityRow[] {
  const rows = relatorio.resumoPorMunicipio.map((m) => ({
    municipio: m.municipio,
    comentarios: m.comentarios,
    ativacaoPct: m.pctEngajamento,
  }))
  const withComments = rows.filter((r) => r.comentarios > 0).sort((a, b) => b.comentarios - a.comentarios)
  const zero = rows.filter((r) => r.comentarios === 0).sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'))
  return [...withComments, ...zero].slice(0, 8)
}

function buildLeaders(
  merged: MergedLeader[],
  posts: InstagramPostWithComments[],
  lideresCobertura: LiderInstagramCoberturaDto[]
): ExercitoDigitalLeaderRow[] {
  const coberturaById = new Map(lideresCobertura.map((l) => [l.id, l]))
  const rows: ExercitoDigitalLeaderRow[] = merged
    .filter((l) => l.lideradosComRede > 0)
    .map((l) => {
      const handles = new Set(l.lideradosInstagram.map((h) => normalizeInstagramHandle(h)).filter(Boolean) as string[])
      const weeklyCounts = weeklyCommentCountsForHandles(posts, handles)
      const ativacaoPct = l.lideradosComRede > 0 ? (l.lideradosQueComentaram / l.lideradosComRede) * 100 : 0
      const trend = computeTrend(weeklyCounts)
      const semanaAtual = weeklyCounts[4] ?? 0
      const semanaAnterior = weeklyCounts[3] ?? 0
      const variacaoPct = pctChange(semanaAtual, semanaAnterior)
      const cobertura = coberturaById.get(l.id)
      const nome = cobertura?.nome ?? l.nome
      return {
        id: l.id,
        rank: 0,
        nome,
        comentarios: l.comentarios,
        publicacoes: l.publicacoes,
        ativacaoPct,
        weeklyCounts,
        trendKind: trend.kind,
        trendLabel: trend.label,
        trendDeltaPct: trend.deltaPct,
        statusDot: computeStatusDot(ativacaoPct, trend.kind, trend.inactiveWeeks),
        semanaAtual,
        semanaAnterior,
        variacaoPct,
        consistencia: computeConsistencia(trend.kind, variacaoPct),
        lideradosComRede: l.lideradosComRede,
        lideradosQueComentaram: l.lideradosQueComentaram,
        inactiveWeeks: trend.inactiveWeeks,
      }
    })
    .sort((a, b) => b.ativacaoPct - a.ativacaoPct || b.comentarios - a.comentarios)

  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

function countOrganicTail(
  posts: InstagramPostWithComments[],
  lideradosHandles: Set<string>
): { comentarios: number; perfis: Set<string> } {
  let comentarios = 0
  const perfis = new Set<string>()
  for (const post of posts) {
    for (const c of post.comments) {
      const h = normalizeInstagramHandle(c.commenter_username)
      if (!h || lideradosHandles.has(h)) continue
      comentarios += 1
      perfis.add(h)
    }
  }
  return { comentarios, perfis }
}

export function filterLeadersByTab(leaders: ExercitoDigitalLeaderRow[], tab: LeaderFilterTab): ExercitoDigitalLeaderRow[] {
  if (tab === 'todos') return leaders
  if (tab === 'ativos') return leaders.filter((l) => l.lideradosQueComentaram > 0)
  if (tab === 'inativos') return leaders.filter((l) => l.lideradosQueComentaram === 0 || l.inactiveWeeks >= 2)
  return leaders.filter((l) => {
    const delta = l.trendDeltaPct
    return delta != null && delta <= -15
  })
}

export function leaderTabCounts(leaders: ExercitoDigitalLeaderRow[]): Record<LeaderFilterTab, number> {
  return {
    todos: leaders.length,
    ativos: leaders.filter((l) => l.lideradosQueComentaram > 0).length,
    'em-queda': filterLeadersByTab(leaders, 'em-queda').length,
    inativos: filterLeadersByTab(leaders, 'inativos').length,
  }
}

export function aggregateExercitoDigitalViewModel(input: {
  lookbackDays: number
  posts: InstagramPostWithComments[]
  lideresCobertura: LiderInstagramCoberturaDto[]
  mergedLeaders: MergedLeader[]
  relatorioPi: RelatorioMapaDigitalIgTdPayload
}): ExercitoDigitalViewModel {
  const { lookbackDays, lideresCobertura, mergedLeaders, relatorioPi } = input
  const posts = filterPostsByLookback(input.posts, lookbackDays)
  const lideradosHandles = buildLideradosHandleSet(lideresCobertura)

  const allCommenters = new Set<string>()
  for (const post of posts) {
    for (const h of commentersNormalizados(post.comments)) allCommenters.add(h)
  }

  const coberturaGeral = analisarCoberturaLideres(lideresCobertura, allCommenters)
  const organic = countOrganicTail(posts, lideradosHandles)

  let comentariosLiderados = 0
  for (const post of posts) {
    for (const c of post.comments) {
      const h = normalizeInstagramHandle(c.commenter_username)
      if (h && lideradosHandles.has(h)) comentariosLiderados += 1
    }
  }
  const comentariosTotal = posts.reduce((acc, p) => acc + p.comments.length, 0)
  const comentariosOrganicos = comentariosTotal - comentariosLiderados

  const municipiosCriticos = relatorioPi.resumoPorMunicipio.filter(
    (m) => m.comentarios === 0 || m.pctEngajamento === 0
  ).length

  const kpis: ExercitoDigitalKpis = {
    ativacaoPct: coberturaGeral.pct,
    lideresAtivados: coberturaGeral.nOk,
    lideresMedidos: coberturaGeral.nMedido,
    metaPct: META_ATIVACAO,
    abaixoMeta: coberturaGeral.pct < META_ATIVACAO,
    comentariosTotal,
    comentariosLiderados,
    comentariosOrganicos,
    perfisOrganicos: organic.perfis.size,
    municipiosCriticos,
    publicacoesAnalisadas: posts.length,
  }

  return {
    lookbackDays,
    kpis,
    alertPosts: buildAlertPosts(posts, lideresCobertura),
    leaders: buildLeaders(mergedLeaders, input.posts, lideresCobertura),
    cities: buildCities(relatorioPi),
    trend: buildTrendPoints(posts, lideradosHandles),
    organicTail: { comentarios: organic.comentarios, perfis: organic.perfis.size },
  }
}

export function formatPct(value: number): string {
  return `${fmtPct.format(value)}%`
}

export function formatInt(value: number): string {
  return fmtInt.format(value)
}

export { mergeLeadersAcrossTds, META_ATIVACAO }
