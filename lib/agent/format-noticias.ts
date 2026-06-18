import {
  buildNoticiasResumoSecao,
  mapNoticiaDestaque,
  type ResumoNoticiaDestaque,
} from '@/lib/resumo-operacional-noticias'

import {
  computeNoticiasJarvisStats,
  type NoticiasJarvisStats,
} from '@/lib/noticias-jarvis-stats'
import type { NewsItem } from '@/types'

export type NoticiaDestaqueRow = {
  id: string
  title: string
  source: string
  url: string | null
  sentiment: string | null
  risk_level: string | null
  theme: string | null
  published_at: string | null
  collected_at: string | null
  dashboard_highlight?: boolean | null
}

/** Detecta pedido de notícias marcadas como destaque no painel. */
export function queryAsksNoticiasDestaque(queryLower: string): boolean {
  const norm = queryLower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (/\bnoticias?\s+em\s+destaque\b/.test(norm)) return true
  if (/\bdestaques?\s+(da|de|no|na)\s+(imprensa|noticias?|painel|monitor)\b/.test(norm)) {
    return true
  }
  if (/\b(quais|que)\s+(sao|estao)\s+as\s+noticias?\b/.test(norm) && /\bdestaque/.test(norm)) {
    return true
  }
  if (/\bnoticias?\s+destacadas?\b/.test(norm)) return true
  if (/\bimprensa\s+em\s+destaque\b/.test(norm)) return true

  const hasNoticia = /\b(noticias?|imprensa|manchete|materias?)\b/.test(norm)
  const hasDestaque = /\b(destaque|destaques|painel|monitor)\b/.test(norm)
  return hasNoticia && hasDestaque
}

/**
 * Notícias classificadas com risco alto / alerta crítico na base (risk_level=high).
 * Diferente de destaque manual no painel (dashboard_highlight).
 */
export function queryAsksNoticiasCriticas(queryLower: string): boolean {
  const norm = queryLower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (queryAsksNoticiasDestaque(norm)) return false

  const hasNoticia =
    /\b(noticias?|materias?|manchete|imprensa|feed|coletad)\b/.test(norm) ||
    /\balguma\s+noticia\b/.test(norm)

  const hasCriticalSignal =
    /\balerta\s*crit/i.test(norm) ||
    /\brisco\s+alt/i.test(norm) ||
    /\b(noticias?|materias?)\s+critic/i.test(norm) ||
    /\bnoticia\s+com\s+(alerta|risco)/i.test(norm) ||
    (/\bcritic[ao]s?\b/.test(norm) && hasNoticia)

  return hasNoticia && hasCriticalSignal
}

export function formatNoticiasCriticasReply(rows: NoticiaDestaqueRow[]): {
  content: string
  speechSegments: string[]
  links: ResumoNoticiaDestaque[]
} {
  const highRisk = rows.filter((row) => row.risk_level === 'high')
  const { noticiasLinks } = buildNoticiasResumoSecao(highRisk.length > 0 ? highRisk : rows)

  if (noticiasLinks.length === 0) {
    const empty =
      '**Notícias com alerta crítico**\n\nNenhuma notícia classificada com **risco alto** no momento. O monitor está sem alertas críticos na base.'
    return {
      content: empty,
      speechSegments: [
        'Não há notícias classificadas com alerta crítico no momento.',
        'O radar de imprensa está sem risco alto.',
      ],
      links: [],
    }
  }

  let content = `**Notícias com alerta crítico (risco alto)** — ${noticiasLinks.length}\n\n`
  const speechSegments = [
    `${noticiasLinks.length} ${
      noticiasLinks.length === 1
        ? 'notícia classificada com alerta crítico'
        : 'notícias classificadas com alerta crítico'
    }.`,
  ]

  noticiasLinks.forEach((n, index) => {
    content += `${index + 1}. **${n.title}**\n`
    const meta = [n.dataFmt, n.source, n.meta].filter(Boolean).join(' · ')
    if (meta) content += `   ${meta}\n`
    if (n.url) content += `   ${n.url}\n`
    content += '\n'
    speechSegments.push(n.title)
  })

  content +=
    '_Classificação automática/manual em **Notícias & Crises** (risco alto). Diferente do filtro «Destaque painel»._'

  return { content: content.trim(), speechSegments, links: noticiasLinks }
}

export function formatNoticiasDestaqueReply(rows: NoticiaDestaqueRow[]): {
  content: string
  speechSegments: string[]
  links: ResumoNoticiaDestaque[]
} {
  const { noticiasLinks } = buildNoticiasResumoSecao(rows)

  if (noticiasLinks.length === 0) {
    const empty =
      '**Notícias em destaque**\n\nNenhuma notícia marcada como destaque no painel. Marque em **Notícias & Crises** (filtro «Destaque painel» ou ícone de rádio na notícia).'
    return {
      content: empty,
      speechSegments: [
        'Não há notícias em destaque no painel no momento.',
        'Marque notícias em Notícias e Crises, no filtro destaque painel.',
      ],
      links: [],
    }
  }

  let content = `**Notícias em destaque no painel** (${noticiasLinks.length})\n\n`
  const speechSegments = [
    `${noticiasLinks.length} ${noticiasLinks.length === 1 ? 'notícia em destaque' : 'notícias em destaque'} no painel.`,
  ]

  noticiasLinks.forEach((n, index) => {
    content += `${index + 1}. **${n.title}**\n`
    const meta = [n.dataFmt, n.source, n.meta].filter(Boolean).join(' · ')
    if (meta) content += `   ${meta}\n`
    if (n.url) content += `   ${n.url}\n`
    content += '\n'

    speechSegments.push(n.title)
  })

  return { content: content.trim(), speechSegments, links: noticiasLinks }
}

export function mapNoticiasApiRows(data: unknown[]): NoticiaDestaqueRow[] {
  return data
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => ({
      id: String(row.id ?? ''),
      title: String(row.title ?? 'Sem título'),
      source: String(row.source ?? 'Fonte'),
      url: typeof row.url === 'string' ? row.url : null,
      sentiment: typeof row.sentiment === 'string' ? row.sentiment : null,
      risk_level: typeof row.risk_level === 'string' ? row.risk_level : null,
      theme: typeof row.theme === 'string' ? row.theme : null,
      published_at: typeof row.published_at === 'string' ? row.published_at : null,
      collected_at: typeof row.collected_at === 'string' ? row.collected_at : null,
      dashboard_highlight: row.dashboard_highlight === true,
    }))
    .filter((row) => row.id.length > 0)
}

function rowAsNewsItem(row: NoticiaDestaqueRow): NewsItem {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    url: row.url ?? undefined,
    sentiment: row.sentiment as NewsItem['sentiment'],
    risk_level: row.risk_level as NewsItem['risk_level'],
    theme: row.theme ?? undefined,
    published_at: row.published_at ?? undefined,
    collected_at: row.collected_at ?? undefined,
    dashboard_highlight: row.dashboard_highlight === true,
  }
}

export function formatNoticiasResumoReply(
  rows: NoticiaDestaqueRow[],
  foco?: string
): { content: string; speechSegments: string[] } {
  const stats = computeNoticiasJarvisStats(rows.map(rowAsNewsItem))

  let content = '**Monitor de notícias**\n\n'
  const speechSegments: string[] = []

  if (foco === 'hoje') {
    content += `**Notícias hoje:** ${stats.hoje}\n\n`
    speechSegments.push(
      stats.hoje === 0
        ? 'Nenhuma notícia coletada hoje no monitor.'
        : `${stats.hoje} ${stats.hoje === 1 ? 'notícia hoje' : 'notícias hoje'}.`
    )
  } else if (foco === 'risco_alto') {
    content += `**Risco alto:** ${stats.riscoAlto}\n\n`
    speechSegments.push(
      stats.riscoAlto === 0
        ? 'Nenhuma notícia com risco alto no momento.'
        : `${stats.riscoAlto} com risco alto.`
    )
  } else if (foco === 'destacadas') {
    content += `**Destacadas no painel:** ${stats.destacadas}\n\n`
    speechSegments.push(
      stats.destacadas === 0
        ? 'Nenhuma notícia destacada no painel.'
        : `${stats.destacadas} destacadas no painel.`
    )
  } else {
    content += `- **${stats.hoje}** notícias hoje\n`
    content += `- **${stats.riscoAlto}** com risco alto\n`
    content += `- **${stats.destacadas}** destacadas no painel\n\n`
    speechSegments.push(
      `Hoje ${stats.hoje} notícias.`,
      `${stats.riscoAlto} com risco alto.`,
      `${stats.destacadas} destacadas no painel.`
    )
  }

  content += '_Indicadores da barra superior em **Notícias & Crises** (após filtros de sentimento/risco/destaque)._'

  if (foco === 'geral' || !foco) {
    content += `\n\n**No recorte atual (${stats.totalVisivel} itens):**`
    content += `\n- Sentimento: ${stats.negativas} negativas · ${stats.positivas} positivas · ${stats.neutras} neutras`
    content += `\n- Risco: ${stats.riscoMedio} médio · ${stats.riscoBaixo} baixo`
  }

  return { content: content.trim(), speechSegments }
}

function filtroLabelFromArgs(args: Record<string, string>): string {
  if (args.filtro === 'sentimento') {
    if (args.sentimento === 'negative') return 'sentimento negativo'
    if (args.sentimento === 'positive') return 'sentimento positivo'
    return 'sentimento neutro'
  }
  if (args.filtro === 'risco') {
    if (args.risco === 'medium') return 'risco médio'
    return 'risco baixo'
  }
  if (args.filtro === 'busca' && args.termo_busca) {
    return `busca «${args.termo_busca}»`
  }
  return 'últimas notícias'
}

export function formatNoticiasFiltradasReply(
  rows: NoticiaDestaqueRow[],
  args: Record<string, string>
): { content: string; speechSegments: string[]; links: ResumoNoticiaDestaque[] } {
  const label = filtroLabelFromArgs(args)
  const { noticiasLinks } = buildNoticiasResumoSecao(rows)

  if (noticiasLinks.length === 0) {
    const empty = `**Notícias — ${label}**\n\nNenhuma matéria encontrada com esse filtro. Ajuste em **Notícias & Crises** ou amplie a busca.`
    return {
      content: empty,
      speechSegments: [`Não encontrei notícias com ${label}.`],
      links: [],
    }
  }

  let content = `**Notícias — ${label}** (${noticiasLinks.length})\n\n`
  const speechSegments = [
    `${noticiasLinks.length} ${
      noticiasLinks.length === 1 ? 'notícia encontrada' : 'notícias encontradas'
    } com ${label}.`,
  ]

  noticiasLinks.forEach((n, index) => {
    content += `${index + 1}. **${n.title}**\n`
    const meta = [n.dataFmt, n.source, n.meta].filter(Boolean).join(' · ')
    if (meta) content += `   ${meta}\n`
    if (n.url) content += `   ${n.url}\n`
    content += '\n'
    speechSegments.push(n.title)
  })

  return { content: content.trim(), speechSegments, links: noticiasLinks }
}

export type { NoticiasJarvisStats }

export { mapNoticiaDestaque }
