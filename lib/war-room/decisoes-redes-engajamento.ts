import { instagramCaptionHeader } from '@/lib/instagram-caption-municipio'
import type { WarRoomDecisao, WarRoomDecisaoPrioridade } from '@/lib/war-room/decisoes'

/** Post mínimo para o builder (alinhado a `InstagramMetrics.posts`). */
export type WarRoomRedesEngajamentoPost = {
  id: string
  caption?: string | null
  postedAt?: string | null
  url?: string | null
  metrics?: {
    engagement?: number | null
    likes?: number | null
    comments?: number | null
  } | null
}

const MIN_POSTS = 4
/** Múltiplo da mediana (leave-one-out) para prioridade média. */
const RATIO_MEDIA = 1.5
/** Múltiplo da mediana para prioridade alta / destaque. */
const RATIO_ALTA = 2
/** Engajamento mínimo absoluto para evitar outlier em amostra fraca. */
const MIN_ENGAGEMENT = 50

function mediana(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  )
  return sorted[idx]!
}

function engagementOf(post: WarRoomRedesEngajamentoPost): number {
  const raw = post.metrics?.engagement
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  const likes = Number(post.metrics?.likes) || 0
  const comments = Number(post.metrics?.comments) || 0
  const sum = likes + comments
  return sum > 0 ? sum : 0
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function formatHora(iso: string | null | undefined): string {
  if (!iso) return '7 dias'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '7 dias'
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

function prioridadePorRatio(ratio: number): WarRoomDecisaoPrioridade {
  if (ratio >= RATIO_ALTA) return 'alta'
  if (ratio >= RATIO_MEDIA) return 'media'
  return 'baixa'
}

/**
 * Alerta único: postagem que destoa positivamente em engajamento
 * (likes + comments) vs as demais na janela — para priorizar conteúdo.
 *
 * Regra: leave-one-out mediana; ratio ≥ 1,5× (média) ou ≥ 2× (alta),
 * com piso de engajamento vs P75 / mínimo absoluto.
 */
export function buildDecisaoPostEngajamentoDestaque(
  posts: WarRoomRedesEngajamentoPost[],
  opts?: { href?: string },
): WarRoomDecisao | null {
  const href = opts?.href ?? '/dashboard/conteudo/redes'

  const scored = posts
    .map((post) => ({ post, engagement: engagementOf(post) }))
    .filter((row) => row.engagement > 0 && Boolean(row.post.id))

  if (scored.length < MIN_POSTS) return null

  const allEng = scored.map((r) => r.engagement)
  const p75 = percentile(allEng, 75)
  const floor = Math.max(MIN_ENGAGEMENT, p75)

  let best: {
    post: WarRoomRedesEngajamentoPost
    engagement: number
    ratio: number
    median: number
  } | null = null

  for (let i = 0; i < scored.length; i++) {
    const { post, engagement } = scored[i]!
    if (engagement < floor) continue

    const others = scored
      .filter((_, j) => j !== i)
      .map((r) => r.engagement)
    const med = mediana(others)
    if (med <= 0) continue

    const ratio = engagement / med
    if (ratio < RATIO_MEDIA) continue

    if (!best || ratio > best.ratio || (ratio === best.ratio && engagement > best.engagement)) {
      best = { post, engagement, ratio, median: med }
    }
  }

  if (!best) return null

  const prioridade = prioridadePorRatio(best.ratio)
  const header =
    truncate(instagramCaptionHeader(best.post.caption) || 'Postagem', 48) ||
    'Postagem'
  const ratioTxt = best.ratio.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const engTxt = Math.round(best.engagement).toLocaleString('pt-BR')

  return {
    id: `redes-outlier:${best.post.id}`,
    prioridade,
    problema: `Destaque: ${header}`,
    categoria: 'Redes sociais',
    hora: formatHora(best.post.postedAt),
    icone: 'mensagem',
    destaque: prioridade === 'alta',
    contexto: best.post.id,
    prazo: formatHora(best.post.postedAt),
    acao: `${ratioTxt}× mediana · ${engTxt} eng. · apostar neste conteúdo`,
    href,
    status: 'pendente',
    createdAt: best.post.postedAt || new Date().toISOString(),
  }
}
