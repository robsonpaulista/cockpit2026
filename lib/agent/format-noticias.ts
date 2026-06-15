import {
  buildNoticiasResumoSecao,
  mapNoticiaDestaque,
  type ResumoNoticiaDestaque,
} from '@/lib/resumo-operacional-noticias'

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
    }))
    .filter((row) => row.id.length > 0)
}

export { mapNoticiaDestaque }
