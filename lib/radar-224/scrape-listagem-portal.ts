/**
 * Scrape de listagens de portais regionais (Grande Picos, WordPress/Penci, etc.).
 * Usado no Atendimento para notícias da cidade sem depender do Google News RSS.
 */

export type PortalNoticiaItem = {
  articleId: string
  title: string
  url: string
  summary: string | null
  /** ISO quando disponível (ex.: datetime do WordPress). */
  publishedAt: string | null
  publishedLabel: string | null
  category: string | null
  fonteId: string
  fonteNome: string
  fonteDominio: string
  fonteUrl: string
}

type FonteOpts = {
  fonteId: string
  fonteNome: string
  fonteDominio: string
  fonteUrl: string
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function articleIdFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '')
    const slug = path.split('/').filter(Boolean).pop()
    return slug || fallback
  } catch {
    return fallback
  }
}

/** Extrai cards `listagem-interna` (Portal Grande Picos e clones do tema). */
export function parseListagemInterna(html: string, opts: FonteOpts): PortalNoticiaItem[] {
  const itens: PortalNoticiaItem[] = []
  const seen = new Set<string>()
  const re =
    /<a\s+href="(https?:\/\/[^"]+\/noticia\/(\d+)\/[^"]+)"[^>]*class="[^"]*listagem-interna[^"]*"[^>]*>([\s\S]*?)<\/a>/gi

  for (const match of html.matchAll(re)) {
    const url = match[1]
    const articleId = match[2]
    const bloco = match[3]
    if (seen.has(url)) continue
    seen.add(url)

    const descMatch = bloco.match(/<div class="desc-lista-interna">([\s\S]*?)<\/div>/i)
    const desc = descMatch?.[1] ?? bloco

    const titleMatch = desc.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    const title = titleMatch ? stripTags(titleMatch[1]) : ''
    if (!title) continue

    const catMatch = desc.match(/<span[^>]*>([\s\S]*?)<\/span>/i)
    // Sem flag `i`: `/i` case-insensitive casaria `<img` como `<i`.
    const timeMatch = desc.match(/<i(?:\s[^>]*)?>([\s\S]*?)<\/i>/)
    const summaryMatch =
      desc.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || desc.match(/<p[^>]*>([\s\S]*?)<\/p>/i)

    itens.push({
      articleId,
      title,
      url,
      summary: summaryMatch ? stripTags(summaryMatch[1]) || null : null,
      publishedAt: null,
      publishedLabel: timeMatch ? stripTags(timeMatch[1]) || null : null,
      category: catMatch ? stripTags(catMatch[1]) || null : null,
      ...opts,
    })
  }

  return itens
}

function extractTimeFromBlock(block: string): { publishedAt: string | null; publishedLabel: string | null } {
  for (const tm of block.matchAll(/<time([^>]*)>([\s\S]*?)<\/time>/gi)) {
    const attrs = tm[1]
    if (!/entry-date|td-module-date|published/i.test(attrs)) continue
    return {
      publishedAt: attrs.match(/datetime="([^"]+)"/i)?.[1]?.trim() || null,
      publishedLabel: stripTags(tm[2]) || null,
    }
  }
  return { publishedAt: null, publishedLabel: null }
}

function extractCategoryFromBlock(block: string): string | null {
  const tdCat = block.match(/class="[^"]*td-post-category[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
  if (tdCat) return stripTags(tdCat[1]) || null
  const cats = [...block.matchAll(/class="[^"]*penci-cat-name[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean)
  return (
    cats.find((c) => /pol[ií]tica/i.test(c)) ||
    cats.find((c) => /editorial/i.test(c)) ||
    cats[0] ||
    null
  )
}

/** Cards Newspaper/tagDiv (`tdb_module_loop`) — Portal Cidade Luz. */
export function parseTagDivModuleLoop(html: string, opts: FonteOpts): PortalNoticiaItem[] {
  const itens: PortalNoticiaItem[] = []
  const seen = new Set<string>()
  const re =
    /<div class="[^"]*(?:tdb_module_loop|td_module_wrap)[^"]*"[^>]*>([\s\S]*?)(?=<div class="[^"]*(?:tdb_module_loop|td_module_wrap)|$)/gi

  for (const match of html.matchAll(re)) {
    const bloco = match[1]
    const titleMatch = bloco.match(
      /<h([23])[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h\1>/i,
    )
    if (!titleMatch) continue
    const url = titleMatch[2].split('#')[0]
    const title = stripTags(titleMatch[3])
    if (!title || seen.has(url)) continue
    seen.add(url)
    const { publishedAt, publishedLabel } = extractTimeFromBlock(bloco)
    itens.push({
      articleId: articleIdFromUrl(url, String(itens.length + 1)),
      title,
      url,
      summary: null,
      publishedAt,
      publishedLabel,
      category: extractCategoryFromBlock(bloco) || 'Cidades',
      ...opts,
    })
  }

  return itens
}

/** Extrai títulos `entry-title` (WordPress / tema Penci — Tribuna de Parnaíba). */
export function parseWordPressEntryTitles(html: string, opts: FonteOpts): PortalNoticiaItem[] {
  const tagDiv = parseTagDivModuleLoop(html, opts)
  if (tagDiv.length > 0) return tagDiv

  const itens: PortalNoticiaItem[] = []
  const seen = new Set<string>()
  const re =
    /<h([23])[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h\1>/gi

  for (const match of html.matchAll(re)) {
    const url = match[2].split('#')[0]
    const title = stripTags(match[3])
    if (!title || seen.has(url)) continue
    seen.add(url)

    const idx = match.index ?? 0
    // Datas do Newspaper/tagDiv ficam ~700–800 chars após o </h3>.
    const around = html.slice(Math.max(0, idx - 200), idx + match[0].length + 1600)
    const { publishedAt, publishedLabel } = extractTimeFromBlock(around)

    itens.push({
      articleId: articleIdFromUrl(url, String(itens.length + 1)),
      title,
      url,
      summary: null,
      publishedAt,
      publishedLabel,
      category: extractCategoryFromBlock(around) || 'Política',
      ...opts,
    })
  }

  return itens
}

/**
 * Listagem Next.js (O Oeirense): cards `<a class="group flex gap-4" href="/politica/...">`.
 */
export function parseNextCategoryCards(html: string, opts: FonteOpts): PortalNoticiaItem[] {
  let origin = 'https://' + opts.fonteDominio.replace(/^www\./, '')
  try {
    origin = new URL(opts.fonteUrl).origin
  } catch {
    /* keep fallback */
  }

  const itens: PortalNoticiaItem[] = []
  const seen = new Set<string>()
  const re = /<a class="[^"]*group flex gap-4[^"]*" href="(\/[^"]+)">([\s\S]*?)<\/a>/gi

  for (const match of html.matchAll(re)) {
    const href = match[1]
    const bloco = match[2]
    const url = new URL(href, origin).href
    if (seen.has(url)) continue
    seen.add(url)

    const titleMatch =
      bloco.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i) ||
      bloco.match(/<img[^>]+alt="([^"]+)"/i)
    const title = titleMatch ? stripTags(titleMatch[1]) : ''
    if (!title) continue

    const summaryMatch = bloco.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    const dateMatch = bloco.match(
      /(\d{1,2}\s+de\s+[a-zà-ú]+(?:\s+de\s+\d{4})?)/i,
    )
    const catFromPath = href.split('/').filter(Boolean)[0]
    const category =
      catFromPath && !/^(noticia|noticias|post|posts)$/i.test(catFromPath)
        ? catFromPath.charAt(0).toUpperCase() + catFromPath.slice(1)
        : 'Política'

    itens.push({
      articleId: articleIdFromUrl(url, String(itens.length + 1)),
      title,
      url,
      summary: summaryMatch ? stripTags(summaryMatch[1]) || null : null,
      publishedAt: null,
      publishedLabel: dateMatch ? dateMatch[1].trim() : null,
      category,
      ...opts,
    })
  }

  return itens
}

/**
 * Diário de Campo Maior: `/noticia/1234-slug` em `h2.post-title` (listagem sem data).
 */
export function parseDiarioNoticiaCards(html: string, opts: FonteOpts): PortalNoticiaItem[] {
  let origin = 'https://' + opts.fonteDominio.replace(/^www\./, '')
  try {
    origin = new URL(opts.fonteUrl).origin
  } catch {
    /* keep */
  }

  const itens: PortalNoticiaItem[] = []
  const seen = new Set<string>()
  const re =
    /<h2 class="post-title[^"]*"[^>]*>\s*<a href="(\/noticia\/(\d+)-[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi

  for (const match of html.matchAll(re)) {
    const href = match[1]
    const articleId = match[2]
    const title = stripTags(match[3])
    const url = new URL(href, origin).href
    if (!title || seen.has(url)) continue
    seen.add(url)
    itens.push({
      articleId,
      title,
      url,
      summary: null,
      publishedAt: null,
      publishedLabel: null,
      category: 'Política',
      ...opts,
    })
  }

  return itens
}

/** Extrai `05 / 11 / 2026 às 14h31` das páginas internas do Diário de Campo Maior. */
export function parseDiarioArticleDate(html: string): {
  publishedAt: string | null
  publishedLabel: string | null
} {
  const m = html.match(/(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})(?:\s*<span>\s*às\s*(\d{1,2})h(\d{2}))?/i)
  if (!m) return { publishedAt: null, publishedLabel: null }
  const dia = m[1]
  const mes = m[2]
  const ano = m[3]
  const hora = m[4] ? Number(m[4]) : 12
  const minuto = m[5] ? Number(m[5]) : 0
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia), hora, minuto, 0, 0)
  return {
    publishedAt: Number.isFinite(d.getTime()) ? d.toISOString() : null,
    publishedLabel: `${dia}/${mes}/${ano}`,
  }
}

async function enrichDatesFromArticlePages(
  itens: PortalNoticiaItem[],
  limit = 16,
): Promise<PortalNoticiaItem[]> {
  const alvo = itens.filter((i) => !i.publishedAt && !i.publishedLabel).slice(0, limit)
  if (alvo.length === 0) return itens

  await Promise.all(
    alvo.map(async (item) => {
      try {
        const res = await fetch(item.url, {
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent':
              'Mozilla/5.0 (compatible; CockpitX-Atendimento/1.0; +noticias-municipio) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          },
          next: { revalidate: 0 },
        })
        if (!res.ok) return
        const html = await res.text()
        const parsed = parseDiarioArticleDate(html)
        if (parsed.publishedAt || parsed.publishedLabel) {
          item.publishedAt = parsed.publishedAt
          item.publishedLabel = parsed.publishedLabel
        }
      } catch {
        /* ignora artigo individual */
      }
    }),
  )

  return itens
}

/** GP1 últimas por cidade: `ultimas_box` + `/pi/piaui/noticia/AAAA/M/D/slug-id.html`. */
export function parseGp1UltimasBoxes(html: string, opts: FonteOpts): PortalNoticiaItem[] {
  let origin = 'https://www.gp1.com.br'
  try {
    origin = new URL(opts.fonteUrl).origin
  } catch {
    /* keep */
  }

  const itens: PortalNoticiaItem[] = []
  const seen = new Set<string>()
  const re =
    /<div class="clearfix ultimas_box">([\s\S]*?)(?=<div class="clearfix ultimas_box">|<\/ul>)/gi

  for (const match of html.matchAll(re)) {
    const bloco = match[1]
    const linkMatch = bloco.match(
      /<h3>\s*<a href="(\/pi\/piaui\/noticia\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i,
    )
    if (!linkMatch) continue
    const href = linkMatch[1]
    const title = stripTags(linkMatch[2])
    const url = new URL(href, origin).href
    if (!title || seen.has(url)) continue
    seen.add(url)

    const timeMatch = bloco.match(/<time class="date-ult">([\s\S]*?)<\/time>/i)
    const rawTime = timeMatch ? stripTags(timeMatch[1]) : ''
    const publishedLabel = rawTime.split('|')[0]?.trim() || null
    const summaryMatch = bloco.match(/<span>\s*([\s\S]*?)\s*<\/span>/i)

    itens.push({
      articleId: articleIdFromUrl(url, String(itens.length + 1)),
      title,
      url,
      summary: summaryMatch ? stripTags(summaryMatch[1]) || null : null,
      publishedAt: null,
      publishedLabel,
      category: 'Cidade',
      ...opts,
    })
  }

  return itens
}

export function parseListagemPortal(html: string, opts: FonteOpts): PortalNoticiaItem[] {
  const listagem = parseListagemInterna(html, opts)
  if (listagem.length > 0) return listagem
  const gp1 = parseGp1UltimasBoxes(html, opts)
  if (gp1.length > 0) return gp1
  const nextCards = parseNextCategoryCards(html, opts)
  if (nextCards.length > 0) return nextCards
  const diario = parseDiarioNoticiaCards(html, opts)
  if (diario.length > 0) return diario
  return parseWordPressEntryTitles(html, opts)
}

export async function fetchListagemPortal(opts: {
  listagemUrl: string
  fonteId: string
  fonteNome: string
  fonteDominio: string
}): Promise<PortalNoticiaItem[]> {
  const res = await fetch(opts.listagemUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (compatible; CockpitX-Atendimento/1.0; +noticias-municipio) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    throw new Error(`Falha ao buscar ${opts.listagemUrl} (${res.status})`)
  }
  const html = await res.text()
  const itens = parseListagemPortal(html, {
    fonteId: opts.fonteId,
    fonteNome: opts.fonteNome,
    fonteDominio: opts.fonteDominio,
    fonteUrl: opts.listagemUrl,
  })
  return enrichDatesFromArticlePages(itens)
}
