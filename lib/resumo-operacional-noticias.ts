import type { SupabaseClient } from '@supabase/supabase-js'
import { DASHBOARD_HIGHLIGHT_MAX } from '@/lib/news-dashboard-highlight'

const LIMITE_DESTAQUES = DASHBOARD_HIGHLIGHT_MAX

export type ResumoNoticiaDestaque = {
  dataFmt: string
  source: string
  title: string
  url: string | null
  meta: string | null
}

type NewsRow = {
  id: string
  title: string
  source: string
  url: string | null
  sentiment: string | null
  risk_level: string | null
  theme: string | null
  published_at: string | null
  collected_at: string | null
}

const SENTIMENTO_LABEL: Record<string, string> = {
  positive: 'positivo',
  negative: 'negativo',
  neutral: 'neutro',
}

const RISCO_LABEL: Record<string, string> = {
  high: 'alto',
  medium: 'médio',
  low: 'baixo',
}

export function formatDataNoticia(publishedAt: string | null, collectedAt: string | null): string {
  const raw = publishedAt || collectedAt
  if (!raw) return ''
  const iso = raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10)
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function buildMeta(row: NewsRow): string | null {
  const meta: string[] = []
  if (row.sentiment && SENTIMENTO_LABEL[row.sentiment]) {
    meta.push(`tom ${SENTIMENTO_LABEL[row.sentiment]}`)
  }
  if (row.risk_level && RISCO_LABEL[row.risk_level]) {
    meta.push(`risco ${RISCO_LABEL[row.risk_level]}`)
  }
  if (row.theme?.trim()) meta.push(row.theme.trim())
  return meta.length > 0 ? meta.join(', ') : null
}

export function mapNoticiaDestaque(row: NewsRow): ResumoNoticiaDestaque {
  return {
    dataFmt: formatDataNoticia(row.published_at, row.collected_at),
    source: (row.source || 'Fonte').trim(),
    title: (row.title || 'Sem título').trim(),
    url: row.url?.trim() || null,
    meta: buildMeta(row),
  }
}

export function formatNoticiaTextoPlano(n: ResumoNoticiaDestaque): string {
  const cabecalho = [n.dataFmt, n.source].filter(Boolean).join(' · ')
  const meta = n.meta ? ` (${n.meta})` : ''
  const linhas = [`${cabecalho}${meta}`, n.title]
  if (n.url) linhas.push(n.url)
  return linhas.join('\n')
}

export async function fetchNoticiasDestaquePainel(
  admin: SupabaseClient,
  limit = LIMITE_DESTAQUES
): Promise<NewsRow[]> {
  const { data, error } = await admin
    .from('news')
    .select('id, title, source, url, sentiment, risk_level, theme, published_at, collected_at')
    .eq('dashboard_highlight', true)
    .order('collected_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.message?.includes('dashboard_highlight')) {
      console.warn('[resumo-operacional] coluna dashboard_highlight ausente')
      return []
    }
    console.error('[resumo-operacional] notícias destaque', error)
    return []
  }

  return (data ?? []) as NewsRow[]
}

export function buildNoticiasResumoSecao(noticias: NewsRow[]): {
  itens: string[]
  noticiasLinks: ResumoNoticiaDestaque[]
} {
  if (noticias.length === 0) {
    return {
      itens: [
        'Nenhuma notícia em destaque no painel — marque em Notícias & Crises (filtro «Destaque painel» / ícone de rádio)',
      ],
      noticiasLinks: [],
    }
  }

  const noticiasLinks = noticias.map(mapNoticiaDestaque)
  const itens = [
    `${noticias.length} ${noticias.length === 1 ? 'notícia destacada' : 'últimas notícias destacadas'} no painel`,
    ...noticiasLinks.map(formatNoticiaTextoPlano),
  ]

  return { itens, noticiasLinks }
}

/** @deprecated Use buildNoticiasResumoSecao */
export function buildNoticiasResumoItens(noticias: NewsRow[]): string[] {
  return buildNoticiasResumoSecao(noticias).itens
}
