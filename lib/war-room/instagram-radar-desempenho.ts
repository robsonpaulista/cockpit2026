import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

export type InstagramRankingMovimentacaoRow = {
  slug: string
  name: string
  username: string | null
  /** Posição no início do período (1 = 1º). */
  rankInicio: number
  /** Posição no ranking acumulado do período (= Engajamento). */
  rankFim: number
  /** rankInicio − rankFim (positivo = subiu). */
  deltaPosicoes: number
  avgInicio: number
  /** Eng. médio acumulado no período (mesmo do ranking Engajamento). */
  avgFim: number
  postsInicio: number
  postsFim: number
}

function parseDay(iso: string | null | undefined): string | null {
  if (!iso) return null
  const s = iso.trim()
  if (!s) return null
  return s.includes('T') ? (s.split('T')[0] ?? null) : s.slice(0, 10)
}

function todayKeyLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function daysBetween(dayKey: string, todayKey: string): number | null {
  const [y1, m1, d1] = dayKey.split('-').map(Number)
  const [y2, m2, d2] = todayKey.split('-').map(Number)
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return null
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  return Math.round((b - a) / 86_400_000)
}

function engagementOf(post: InstagramRadarPostWithActor): number {
  return (post.likes_count ?? 0) + (post.comments_count ?? 0)
}

function avgEngagement(posts: InstagramRadarPostWithActor[]): number {
  if (posts.length === 0) return 0
  const sum = posts.reduce((s, p) => s + engagementOf(p), 0)
  return Math.round(sum / posts.length)
}

/** Ranking 1-based único (sem empate compartilhado): 1º, 2º, 3º… */
function rankByValue(items: Array<{ slug: string; value: number }>): Map<string, number> {
  const sorted = [...items].sort(
    (a, b) => b.value - a.value || a.slug.localeCompare(b.slug, 'pt-BR'),
  )
  const ranks = new Map<string, number>()
  for (let i = 0; i < sorted.length; i += 1) {
    ranks.set(sorted[i].slug, i + 1)
  }
  return ranks
}

export function formatRankPosicao(rank: number): string {
  return `${rank}º`
}

export function formatDeltaPosicoes(delta: number): string {
  if (delta === 0) return '0'
  if (delta > 0) return `↑${delta}`
  return `↓${Math.abs(delta)}`
}

/**
 * Movimentação de ranking no período:
 * - **Início** = eng. médio só nos primeiros dias (metade antiga da janela)
 * - **Fim** = eng. médio **acumulado** dos N dias (= mesmo ranking da aba Engajamento)
 *
 * Assim o “Fim” casa com o ranking acumulado; a Var mostra de onde veio.
 */
export function buildInstagramRankingMovimentacao(
  actors: PoliticalActorWithTerms[],
  posts: InstagramRadarPostWithActor[],
  lookbackDays: number,
): InstagramRankingMovimentacaoRow[] {
  const today = todayKeyLocal()
  const window = Math.max(2, lookbackDays)
  /** Dias mais antigos da janela = “início da semana”. */
  const mid = Math.floor(window / 2)

  const active = actors.filter((a) => a.active)
  const bySlug = new Map<
    string,
    { inicio: InstagramRadarPostWithActor[]; periodo: InstagramRadarPostWithActor[] }
  >()

  for (const actor of active) {
    bySlug.set(actor.slug, { inicio: [], periodo: [] })
  }

  for (const post of posts) {
    const slug = post.political_actors?.slug
    if (!slug || !bySlug.has(slug)) continue
    const day = parseDay(post.posted_at) ?? parseDay(post.collected_at)
    if (!day) continue
    const ago = daysBetween(day, today)
    if (ago == null || ago < 0 || ago >= window) continue

    const bucket = bySlug.get(slug)!
    bucket.periodo.push(post)
    // Início = só a metade antiga (ex.: há 4–6 dias em janela de 7)
    if (ago >= mid) bucket.inicio.push(post)
  }

  const candidates = active
    .map((actor) => {
      const bucket = bySlug.get(actor.slug) ?? { inicio: [], periodo: [] }
      return {
        actor,
        avgInicio: avgEngagement(bucket.inicio),
        avgFim: avgEngagement(bucket.periodo),
        postsInicio: bucket.inicio.length,
        postsFim: bucket.periodo.length,
      }
    })
    // Mesmo universo do Engajamento: quem tem post no período acumulado
    .filter((row) => row.postsFim > 0)

  if (candidates.length === 0) return []

  const rankInicio = rankByValue(
    candidates.map((c) => ({
      slug: c.actor.slug,
      // Sem post no início: cai para o fundo do ranking de partida
      value: c.postsInicio > 0 ? c.avgInicio : -1,
    })),
  )
  const rankFim = rankByValue(
    candidates.map((c) => ({
      slug: c.actor.slug,
      value: c.avgFim,
    })),
  )

  return candidates
    .map((c) => {
      const inicio = rankInicio.get(c.actor.slug) ?? candidates.length
      const fim = rankFim.get(c.actor.slug) ?? candidates.length
      return {
        slug: c.actor.slug,
        name: c.actor.name,
        username: c.actor.instagram_username ?? null,
        rankInicio: inicio,
        rankFim: fim,
        deltaPosicoes: inicio - fim,
        avgInicio: c.avgInicio,
        avgFim: c.avgFim,
        postsInicio: c.postsInicio,
        postsFim: c.postsFim,
      }
    })
    // Mesma ordem do ranking acumulado (Engajamento)
    .sort(
      (a, b) =>
        a.rankFim - b.rankFim ||
        b.avgFim - a.avgFim ||
        a.name.localeCompare(b.name, 'pt-BR'),
    )
}
