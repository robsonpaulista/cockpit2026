import type { InstagramPostWithComments, InstagramStoredComment } from '@/lib/instagramApi'
import type { MandatoInstagramEnriquecido } from '@/lib/mandatos-instagram-piaui'
import {
  buildMandatosHandleSet,
  mandatosToCoberturaDto,
  type ExercitoDigitalAudience,
} from '@/lib/mandatos-instagram-piaui'
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
import {
  formatMonthLabelLong,
  getCurrentReferenceMonth,
  getMonthWindow,
  isTimestampInMonth,
  parseReferenceMonth,
  startOfMonthMs,
  endOfMonthMs,
  type MonthRef,
} from '@/lib/mapa-exercito-digital-month'

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

function postsInCalendarMonth(posts: InstagramPostWithComments[], ref: MonthRef): InstagramPostWithComments[] {
  const start = startOfMonthMs(ref)
  const end = endOfMonthMs(ref)
  return posts.filter((p) => {
    const t = timestampMediaPostedAt(p)
    return t >= start && t <= end
  })
}

function monthlyCommentCountsForHandles(
  posts: InstagramPostWithComments[],
  handles: Set<string>,
  referenceMonth: string
): number[] {
  const months = getMonthWindow(referenceMonth, 5)
  return months.map((ref) => {
    let count = 0
    for (const post of posts) {
      for (const c of post.comments) {
        const h = normalizeInstagramHandle(c.commenter_username)
        if (!h || !handles.has(h)) continue
        const t = timestampComment(c)
        if (isTimestampInMonth(t, ref)) count += 1
      }
    }
    return count
  })
}

function monthlyCommentCountsForMunicipio(
  posts: InstagramPostWithComments[],
  handleToMunicipio: Map<string, string>,
  municipio: string,
  referenceMonth: string
): number[] {
  const months = getMonthWindow(referenceMonth, 5)
  return months.map((ref) => {
    let count = 0
    for (const post of posts) {
      for (const c of post.comments) {
        const h = normalizeInstagramHandle(c.commenter_username)
        if (!h) continue
        if (handleToMunicipio.get(h) !== municipio) continue
        const t = timestampComment(c)
        if (isTimestampInMonth(t, ref)) count += 1
      }
    }
    return count
  })
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function computeMonthlyTrend(monthly: number[]): {
  kind: LeaderTrendKind
  label: string
  deltaPct: number | null
  inactiveMonths: number
} {
  const current = monthly[4] ?? 0
  const previous = monthly[3] ?? 0
  const delta = pctChange(current, previous)

  let inactiveMonths = 0
  for (let i = monthly.length - 1; i >= 0; i--) {
    if ((monthly[i] ?? 0) === 0) inactiveMonths += 1
    else break
  }

  if (inactiveMonths >= 2) {
    return {
      kind: 'inactive',
      label: `Inativo há ${inactiveMonths} ${inactiveMonths === 1 ? 'mês' : 'meses'}`,
      deltaPct: delta,
      inactiveMonths,
    }
  }

  const m2 = monthly[2] ?? 0
  const m1 = monthly[1] ?? 0
  const m0 = monthly[0] ?? 0
  if (m0 < m1 && m1 < m2 && m2 < previous && previous < current) {
    return { kind: 'accelerating', label: 'Crescendo', deltaPct: delta, inactiveMonths: 0 }
  }

  if (delta != null && delta >= 15) {
    return { kind: 'growing', label: `+${Math.round(delta)}% mês`, deltaPct: delta, inactiveMonths: 0 }
  }
  if (delta != null && delta <= -15) {
    return { kind: 'falling', label: `-${Math.abs(Math.round(delta))}% mês`, deltaPct: delta, inactiveMonths: 0 }
  }
  return { kind: 'stable', label: 'Estável', deltaPct: delta, inactiveMonths: 0 }
}

function computeStatusDot(
  ativacaoPct: number,
  trendKind: LeaderTrendKind,
  inactiveMonths: number
): LeaderStatusDot {
  if (inactiveMonths >= 2 || ativacaoPct < 5) return 'red'
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

function countCommentsForHandlesInMonth(
  posts: InstagramPostWithComments[],
  handles: Set<string>,
  ref: MonthRef
): number {
  let count = 0
  for (const post of posts) {
    for (const c of post.comments) {
      const h = normalizeInstagramHandle(c.commenter_username)
      if (!h || !handles.has(h)) continue
      if (isTimestampInMonth(timestampComment(c), ref)) count += 1
    }
  }
  return count
}

function postsComentadosByHandlesInMonth(
  posts: InstagramPostWithComments[],
  handles: Set<string>,
  ref: MonthRef
): number {
  const medias = new Set<string>()
  for (const post of posts) {
    for (const c of post.comments) {
      const h = normalizeInstagramHandle(c.commenter_username)
      if (!h || !handles.has(h)) continue
      if (isTimestampInMonth(timestampComment(c), ref)) {
        medias.add(post.instagram_media_id)
        break
      }
    }
  }
  return medias.size
}

function lideradosQueComentaramNoMes(
  posts: InstagramPostWithComments[],
  handles: string[],
  ref: MonthRef
): number {
  let count = 0
  for (const handle of handles) {
    const h = normalizeInstagramHandle(handle)
    if (!h) continue
    if (countCommentsForHandlesInMonth(posts, new Set([h]), ref) > 0) count += 1
  }
  return count
}

function buildCities(
  posts: InstagramPostWithComments[],
  handleToMunicipio: Map<string, string>,
  perfisPorMunicipio: Map<string, Set<string>>,
  referenceMonth: string
): { top: ExercitoDigitalCityRow[]; all: ExercitoDigitalCityRow[] } {
  const ref = parseReferenceMonth(referenceMonth)
  const comentariosPorMun = new Map<string, number>()
  const comentaramPorMun = new Map<string, Set<string>>()

  for (const mun of perfisPorMunicipio.keys()) {
    comentariosPorMun.set(mun, 0)
    comentaramPorMun.set(mun, new Set())
  }

  for (const post of posts) {
    for (const c of post.comments) {
      const h = normalizeInstagramHandle(c.commenter_username)
      if (!h) continue
      const mun = handleToMunicipio.get(h)
      if (!mun || !perfisPorMunicipio.has(mun)) continue
      if (!isTimestampInMonth(timestampComment(c), ref)) continue
      comentariosPorMun.set(mun, (comentariosPorMun.get(mun) ?? 0) + 1)
      comentaramPorMun.get(mun)?.add(h)
    }
  }

  const rows: ExercitoDigitalCityRow[] = []
  for (const [municipio, perfis] of perfisPorMunicipio) {
    const comentaram = comentaramPorMun.get(municipio)?.size ?? 0
    rows.push({
      rank: 0,
      municipio,
      comentarios: comentariosPorMun.get(municipio) ?? 0,
      ativacaoPct: perfis.size > 0 ? (comentaram / perfis.size) * 100 : 0,
      monthlyCounts: monthlyCommentCountsForMunicipio(posts, handleToMunicipio, municipio, referenceMonth),
    })
  }

  const withComments = rows.filter((r) => r.comentarios > 0).sort((a, b) => b.comentarios - a.comentarios)
  const zero = rows.filter((r) => r.comentarios === 0).sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'))
  const ordered = [...withComments, ...zero]
  ordered.forEach((row, index) => {
    row.rank = index + 1
  })
  return { all: rows, top: ordered.slice(0, 8) }
}

function buildMandatosMunicipioMaps(mandatos: MandatoInstagramEnriquecido[]): {
  handleToMunicipio: Map<string, string>
  perfisPorMunicipio: Map<string, Set<string>>
} {
  const handleToMunicipio = new Map<string, string>()
  const perfisPorMunicipio = new Map<string, Set<string>>()
  for (const m of mandatos) {
    handleToMunicipio.set(m.handle, m.municipioOficial)
    const set = perfisPorMunicipio.get(m.municipioOficial) ?? new Set<string>()
    set.add(m.handle)
    perfisPorMunicipio.set(m.municipioOficial, set)
  }
  return { handleToMunicipio, perfisPorMunicipio }
}

function buildLideradosMunicipioMaps(relatorio: RelatorioMapaDigitalIgTdPayload): {
  handleToMunicipio: Map<string, string>
  perfisPorMunicipio: Map<string, Set<string>>
} {
  const handleToMunicipio = new Map<string, string>()
  const perfisPorMunicipio = new Map<string, Set<string>>()
  for (const d of relatorio.detalhes) {
    const h = normalizeInstagramHandle(d.lideradoInstagram)
    if (!h || !d.municipio) continue
    handleToMunicipio.set(h, d.municipio)
    const set = perfisPorMunicipio.get(d.municipio) ?? new Set<string>()
    set.add(h)
    perfisPorMunicipio.set(d.municipio, set)
  }
  return { handleToMunicipio, perfisPorMunicipio }
}

function mergeMunicipioMaps(
  a: { handleToMunicipio: Map<string, string>; perfisPorMunicipio: Map<string, Set<string>> },
  b: { handleToMunicipio: Map<string, string>; perfisPorMunicipio: Map<string, Set<string>> }
): { handleToMunicipio: Map<string, string>; perfisPorMunicipio: Map<string, Set<string>> } {
  const handleToMunicipio = new Map(a.handleToMunicipio)
  const perfisPorMunicipio = new Map<string, Set<string>>()

  for (const [mun, handles] of a.perfisPorMunicipio) {
    perfisPorMunicipio.set(mun, new Set(handles))
  }
  for (const [mun, handles] of b.perfisPorMunicipio) {
    const set = perfisPorMunicipio.get(mun) ?? new Set<string>()
    for (const h of handles) set.add(h)
    perfisPorMunicipio.set(mun, set)
  }
  for (const [h, mun] of b.handleToMunicipio) {
    if (!handleToMunicipio.has(h)) handleToMunicipio.set(h, mun)
  }

  return { handleToMunicipio, perfisPorMunicipio }
}

function buildUnifiedHandleSet(
  lideres: LiderInstagramCoberturaDto[],
  mandatos: MandatoInstagramEnriquecido[]
): Set<string> {
  const handles = buildLideradosHandleSet(lideres)
  for (const m of mandatos) {
    if (m.handle) handles.add(m.handle)
  }
  return handles
}

function analisarCoberturaHandles(handles: Set<string>, commenters: Set<string>) {
  const comRede = [...handles]
  const comentaram = comRede.filter((h) => commenters.has(h))
  const nMedido = comRede.length
  const nOk = comentaram.length
  const pct = nMedido > 0 ? (nOk / nMedido) * 100 : 0
  return { nMedido, nOk, pct }
}

function buildLeaders(
  merged: MergedLeader[],
  posts: InstagramPostWithComments[],
  lideresCobertura: LiderInstagramCoberturaDto[],
  referenceMonth: string
): ExercitoDigitalLeaderRow[] {
  const ref = parseReferenceMonth(referenceMonth)
  const postsNoPeriodo = postsInCalendarMonth(posts, ref).length
  const coberturaById = new Map(lideresCobertura.map((l) => [l.id, l]))
  const rows: ExercitoDigitalLeaderRow[] = merged
    .filter((l) => l.lideradosComRede > 0)
    .map((l) => {
      const handles = new Set(l.lideradosInstagram.map((h) => normalizeInstagramHandle(h)).filter(Boolean) as string[])
      const monthlyCounts = monthlyCommentCountsForHandles(posts, handles, referenceMonth)
      const mesAtual = monthlyCounts[4] ?? 0
      const mesAnterior = monthlyCounts[3] ?? 0
      const publicacoes = postsComentadosByHandlesInMonth(posts, handles, ref)
      const comentarios = countCommentsForHandlesInMonth(posts, handles, ref)
      const ativacaoPct = postsNoPeriodo > 0 ? (publicacoes / postsNoPeriodo) * 100 : 0
      const trend = computeMonthlyTrend(monthlyCounts)
      const variacaoPct = pctChange(mesAtual, mesAnterior)
      const cobertura = coberturaById.get(l.id)
      const nome = cobertura?.nome ?? l.nome
      const lideradosQueComentaram = lideradosQueComentaramNoMes(posts, l.lideradosInstagram, ref)
      return {
        id: l.id,
        rank: 0,
        tipo: 'lider' as const,
        nome,
        comentarios,
        publicacoes,
        postsNoPeriodo,
        ativacaoPct,
        monthlyCounts,
        trendKind: trend.kind,
        trendLabel: trend.label,
        trendDeltaPct: trend.deltaPct,
        statusDot: computeStatusDot(ativacaoPct, trend.kind, trend.inactiveMonths),
        mesAtual,
        mesAnterior,
        variacaoPct,
        consistencia: computeConsistencia(trend.kind, variacaoPct),
        lideradosComRede: l.lideradosComRede,
        lideradosQueComentaram,
        inactiveMonths: trend.inactiveMonths,
        lideradosInstagram: l.lideradosInstagram ?? [],
        lideradosEngajamento: l.lideradosEngajamento ?? [],
      }
    })
    .sort((a, b) => b.mesAtual - a.mesAtual || b.comentarios - a.comentarios)

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
  if (tab === 'ativos') return leaders.filter((l) => l.mesAtual > 0)
  if (tab === 'inativos') return leaders.filter((l) => l.mesAtual === 0 || l.inactiveMonths >= 2)
  return leaders.filter((l) => {
    const delta = l.trendDeltaPct
    return delta != null && delta <= -15
  })
}

export function leaderTabCounts(leaders: ExercitoDigitalLeaderRow[]): Record<LeaderFilterTab, number> {
  return {
    todos: leaders.length,
    ativos: leaders.filter((l) => l.mesAtual > 0).length,
    'em-queda': filterLeadersByTab(leaders, 'em-queda').length,
    inativos: filterLeadersByTab(leaders, 'inativos').length,
  }
}

function buildMandatarios(
  mandatos: MandatoInstagramEnriquecido[],
  posts: InstagramPostWithComments[],
  referenceMonth: string
): ExercitoDigitalLeaderRow[] {
  const ref = parseReferenceMonth(referenceMonth)
  const postsNoPeriodo = postsInCalendarMonth(posts, ref).length
  const rows: ExercitoDigitalLeaderRow[] = mandatos.map((m) => {
    const handles = new Set([m.handle])
    const monthlyCounts = monthlyCommentCountsForHandles(posts, handles, referenceMonth)
    const mesAtual = monthlyCounts[4] ?? 0
    const mesAnterior = monthlyCounts[3] ?? 0
    const comentarios = countCommentsForHandlesInMonth(posts, handles, ref)
    const postsComentados = postsComentadosByHandlesInMonth(posts, handles, ref)
    const ativacaoPct = postsNoPeriodo > 0 ? (postsComentados / postsNoPeriodo) * 100 : 0
    const trend = computeMonthlyTrend(monthlyCounts)
    const variacaoPct = pctChange(mesAtual, mesAnterior)
    const nome = `${m.nome} · ${m.municipioOficial}${m.cargo === 'prefeito' ? ' (Pref.)' : ' (Ver.)'}`
    return {
      id: m.id,
      rank: 0,
      tipo: 'mandato' as const,
      nome,
      comentarios,
      publicacoes: postsComentados,
      postsNoPeriodo,
      ativacaoPct,
      monthlyCounts,
      trendKind: trend.kind,
      trendLabel: trend.label,
      trendDeltaPct: trend.deltaPct,
      statusDot: computeStatusDot(ativacaoPct, trend.kind, trend.inactiveMonths),
      mesAtual,
      mesAnterior,
      variacaoPct,
      consistencia: computeConsistencia(trend.kind, variacaoPct),
      lideradosComRede: 1,
      lideradosQueComentaram: mesAtual > 0 ? 1 : 0,
      inactiveMonths: trend.inactiveMonths,
    }
  })

  return rows
    .sort((a, b) => b.mesAtual - a.mesAtual || b.comentarios - a.comentarios || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

function buildUnifiedLeaders(
  merged: MergedLeader[],
  posts: InstagramPostWithComments[],
  lideresCobertura: LiderInstagramCoberturaDto[],
  mandatos: MandatoInstagramEnriquecido[],
  referenceMonth: string
): ExercitoDigitalLeaderRow[] {
  const lideres = buildLeaders(merged, posts, lideresCobertura, referenceMonth)
  const mandatarios = buildMandatarios(mandatos, posts, referenceMonth)
  return [...lideres, ...mandatarios]
    .sort(
      (a, b) =>
        b.mesAtual - a.mesAtual ||
        b.comentarios - a.comentarios ||
        a.nome.localeCompare(b.nome, 'pt-BR')
    )
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

export function aggregateExercitoDigitalViewModel(input: {
  lookbackDays: number
  referenceMonth?: string
  audience: ExercitoDigitalAudience
  posts: InstagramPostWithComments[]
  lideresCobertura: LiderInstagramCoberturaDto[]
  mergedLeaders: MergedLeader[]
  mandatos?: MandatoInstagramEnriquecido[]
  relatorioPi: RelatorioMapaDigitalIgTdPayload
}): ExercitoDigitalViewModel {
  const { lookbackDays, audience, lideresCobertura, mergedLeaders, relatorioPi } = input
  const referenceMonth = input.referenceMonth ?? getCurrentReferenceMonth()
  const ref = parseReferenceMonth(referenceMonth)
  const allPosts = input.posts
  const postsMes = postsInCalendarMonth(allPosts, ref)
  const isMandatos = audience === 'mandatos'
  const isUnificado = audience === 'unificado'
  const mandatos = input.mandatos ?? []

  const profileHandles = isUnificado
    ? buildUnifiedHandleSet(lideresCobertura, mandatos)
    : isMandatos
      ? buildMandatosHandleSet(mandatos)
      : buildLideradosHandleSet(lideresCobertura)

  const coberturaProfiles = isUnificado
    ? [...lideresCobertura, ...mandatosToCoberturaDto(mandatos)]
    : isMandatos
      ? mandatosToCoberturaDto(mandatos)
      : lideresCobertura

  const commentersNoMes = new Set<string>()
  for (const post of allPosts) {
    for (const c of post.comments) {
      const h = normalizeInstagramHandle(c.commenter_username)
      if (!h) continue
      if (isTimestampInMonth(timestampComment(c), ref)) commentersNoMes.add(h)
    }
  }

  const coberturaGeral = isUnificado
    ? analisarCoberturaHandles(profileHandles, commentersNoMes)
    : analisarCoberturaLideres(coberturaProfiles, commentersNoMes)

  let comentariosRede = 0
  let comentariosTotal = 0
  for (const post of allPosts) {
    for (const c of post.comments) {
      if (!isTimestampInMonth(timestampComment(c), ref)) continue
      comentariosTotal += 1
      const h = normalizeInstagramHandle(c.commenter_username)
      if (h && profileHandles.has(h)) comentariosRede += 1
    }
  }
  const organic = countOrganicTail(postsMes, profileHandles)

  const municipioMaps = isUnificado
    ? mergeMunicipioMaps(buildLideradosMunicipioMaps(relatorioPi), buildMandatosMunicipioMaps(mandatos))
    : isMandatos
      ? buildMandatosMunicipioMaps(mandatos)
      : buildLideradosMunicipioMaps(relatorioPi)
  const cityResult = buildCities(allPosts, municipioMaps.handleToMunicipio, municipioMaps.perfisPorMunicipio, referenceMonth)

  const municipiosCriticos = cityResult.all.filter((r) => r.comentarios === 0 || r.ativacaoPct === 0).length

  const kpis: ExercitoDigitalKpis = {
    ativacaoPct: coberturaGeral.pct,
    lideresAtivados: coberturaGeral.nOk,
    lideresMedidos: coberturaGeral.nMedido,
    metaPct: META_ATIVACAO,
    abaixoMeta: coberturaGeral.pct < META_ATIVACAO,
    comentariosTotal,
    comentariosLiderados: comentariosRede,
    comentariosOrganicos: comentariosTotal - comentariosRede,
    perfisOrganicos: organic.perfis.size,
    municipiosCriticos,
    publicacoesAnalisadas: postsMes.length,
  }

  return {
    audience,
    lookbackDays,
    referenceMonth,
    referenceMonthLabel: formatMonthLabelLong(ref),
    kpis,
    alertPosts: buildAlertPosts(postsMes, coberturaProfiles),
    leaders: isUnificado
      ? buildUnifiedLeaders(mergedLeaders, allPosts, lideresCobertura, mandatos, referenceMonth)
      : isMandatos
        ? buildMandatarios(mandatos, allPosts, referenceMonth)
        : buildLeaders(mergedLeaders, allPosts, lideresCobertura, referenceMonth),
    cities: cityResult.top,
    trend: buildTrendPoints(postsMes, profileHandles),
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
