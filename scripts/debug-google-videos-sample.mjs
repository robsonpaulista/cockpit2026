#!/usr/bin/env node
/**
 * Dump de 1 registro completo do scraping Google Vídeos (sem gravar no Supabase).
 * Uso: node scripts/debug-google-videos-sample.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import {
  extractVideoDateHint,
  parseGoogleVideosDateHint,
  parseMetadataRow,
} from './lib/google-videos-date.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const QUERY = process.argv[2] || 'busão da castração teresina'

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const value = m[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function inferPlatform(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
    if (host.includes('instagram.com')) return 'instagram'
    if (host.includes('facebook.com') || host === 'fb.watch') return 'facebook'
    if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube'
    return 'website'
  } catch {
    return 'other'
  }
}

function articleIdFromUrl(url) {
  try {
    const u = new URL(url)
    u.hash = ''
    return `${u.hostname.replace(/^www\./i, '')}${u.pathname}`.slice(0, 500)
  } catch {
    return url.slice(0, 500)
  }
}

// Copia da extração em collect-google-videos.mjs (page.evaluate)
async function extractVideosFromPage(page, maxItems = 5) {
  return page.evaluate(({ max }) => {
    function unwrap(href) {
      try {
        const u = new URL(href)
        if (u.hostname.includes('google.') && (u.pathname === '/url' || u.pathname === '/imgres')) {
          const target = u.searchParams.get('q') || u.searchParams.get('url')
          if (target?.startsWith('http')) return target
        }
      } catch {
        /* ignore */
      }
      return href
    }

    function hostOf(href) {
      try {
        return new URL(href).hostname.replace(/^www\./i, '').toLowerCase()
      } catch {
        return ''
      }
    }

    function isSocialVideoLink(href) {
      const host = hostOf(href)
      if (!host) return false
      if (host.includes('instagram.com')) return /\/(reel|reels|p|tv)\//i.test(href)
      if (host.includes('youtube.com') || host === 'youtu.be') return true
      if (host.includes('facebook.com') || host === 'fb.watch') {
        return /\/(videos|watch|reel|reels)\//i.test(href) || host === 'fb.watch'
      }
      if (host.includes('tiktok.com')) return true
      return false
    }

    function cardVisibleText(card) {
      if (!card) return ''
      const clone = card.cloneNode(true)
      clone.querySelectorAll('script, style, noscript').forEach((el) => el.remove())
      return clone.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    }

    function findResultContainer(anchor) {
      let tight = anchor.parentElement
      for (let depth = 0; depth < 10 && tight; depth++) {
        const links = tight.querySelectorAll(
          'a[href*="instagram.com"], a[href*="youtube.com"], a[href*="youtu.be"], a[href*="facebook.com"], a[href*="fb.watch"]'
        )
        const textLen = cardVisibleText(tight).length
        if (links.length >= 1 && links.length <= 2 && textLen >= 40 && textLen <= 650) {
          return tight
        }
        tight = tight.parentElement
      }
      return anchor.closest('.MjjYud') ?? anchor.closest('div.g') ?? anchor.parentElement ?? anchor
    }

    function isCleanTitle(text) {
      if (!text) return false
      const t = text.trim()
      if (t.length < 8 || t.length > 320) return false
      if (/function\s*\(|setAttribute|document\.|Date\.now|javascript:/i.test(t)) return false
      if (/www\.\w+[\w.-]*\s*›/i.test(t)) return false
      if (/\.com\s*›/i.test(t)) return false
      if ((t.match(/https?:\/\//gi) || []).length > 0) return false
      if (/^\d{1,2}:\d{2}$/.test(t)) return false
      return true
    }

    function pickTitle(anchor) {
      const h3 = anchor.querySelector('h3')?.textContent?.trim()
      if (isCleanTitle(h3)) return h3
      const aria = anchor.getAttribute('aria-label')?.trim()
      if (isCleanTitle(aria)) return aria
      const candidates = []
      for (const line of (anchor.innerText ?? '').split('\n')) {
        const t = line.trim()
        if (isCleanTitle(t)) candidates.push(t)
      }
      const card = findResultContainer(anchor)
      const cardText = cardVisibleText(card)
      const igMatch = cardText.match(
        /[\w\sÀ-ú.'-]{4,80}\s+on\s+Instagram:\s*['"]([^'"]{8,})['"]?/i
      )
      if (igMatch?.[0] && isCleanTitle(igMatch[0])) candidates.push(igMatch[0].trim())
      if (igMatch?.[1] && isCleanTitle(igMatch[1])) candidates.push(igMatch[1].trim())
      const beforeDot = cardText.split(/\s+Instagram\s*·/i)[0]?.trim()
      if (isCleanTitle(beforeDot)) candidates.push(beforeDot)
      const best = candidates.sort((a, b) => b.length - a.length).find(isCleanTitle)
      if (best) return best
      if (isCleanTitle(h3)) return h3
      if (isCleanTitle(aria)) return aria
      return ''
    }

    function extractMetaLine(cardText) {
      if (!cardText) return ''
      const idx = cardText.search(/(?:Instagram|Facebook|YouTube|TikTok)\s*·/i)
      if (idx < 0) return ''
      return cardText.slice(idx, idx + 100).trim()
    }

    function extractDateHint(metaLine) {
      if (!metaLine) return null
      const meta = metaLine.match(
        /(Instagram|Facebook|YouTube|TikTok|Twitter)\s*·\s*([^·]+?)\s*·\s*([^·]{2,40})/i
      )
      if (meta?.[3]) {
        const seg = meta[3].trim()
        if (
          /atrás|ago|\bhá\s+\d|^\d+\s+(hora|horas|dia|dias|semana|semanas)/i.test(seg) &&
          seg.split(/\s+/).length <= 6
        ) {
          return seg
        }
      }
      for (const seg of metaLine.split('·')) {
        const s = seg.trim()
        if (
          s.length >= 2 &&
          s.length <= 40 &&
          s.split(/\s+/).length <= 6 &&
          !/^(Instagram|Facebook|YouTube|TikTok|Twitter)$/i.test(s) &&
          (/atrás|ago|\bhá\s+\d|^\d+\s+(hora|horas|dia|dias|semana|semanas)/i.test(s) ||
            /^\d{1,2}\s+de\s+[a-zç]/i.test(s))
        ) {
          return s
        }
      }
      return null
    }

    function extractAuthor(metaLine) {
      const meta = metaLine.match(
        /(Instagram|Facebook|YouTube|TikTok|Twitter)\s*·\s*([^·]+?)\s*·/i
      )
      if (!meta?.[2]) return null
      const author = meta[2].trim()
      if (author.toLowerCase() === meta[1].trim().toLowerCase()) return null
      if (author.length > 60) return null
      return author
    }

    const root = document.querySelector('#search') || document.querySelector('#rso') || document.body
    const seen = new Set()
    const out = []

    for (const anchor of root.querySelectorAll('a[href*="http"]')) {
      const href = unwrap(anchor.href)
      if (!href || seen.has(href)) continue
      if (href.includes('google.com/search') || href.includes('accounts.google')) continue
      if (!isSocialVideoLink(href)) continue

      const card = findResultContainer(anchor)
      const cardText = cardVisibleText(card)
      const metaLine = extractMetaLine(cardText)
      const title = pickTitle(anchor)
      if (!title || title.length < 8) continue

      const durationMatch = cardText.match(/\b(\d{1,2}:\d{2})\b/)
      const dateHint = extractDateHint(metaLine)
      const author = extractAuthor(metaLine)
      seen.add(href)
      out.push({
        title: title.slice(0, 500),
        url: href,
        blockText: cardText.slice(0, 400),
        metaLine,
        duration: durationMatch?.[1] ?? null,
        hasDuration: Boolean(durationMatch),
        dateHint,
        author,
      })
      if (out.length >= max) break
    }
    return out
  }, { max: maxItems })
}

function buildProcessedItem(row, query) {
  const meta = parseMetadataRow(row.metaLine || row.blockText)
  const dateHint = row.dateHint || meta.dateHint || extractVideoDateHint(row.metaLine || '')
  const publishedAt = parseGoogleVideosDateHint(dateHint)
  const summaryParts = [row.duration, dateHint].filter(Boolean)
  const platform = inferPlatform(row.url)
  const sourceName =
    row.author?.trim() ||
    meta.author ||
    (platform === 'instagram'
      ? 'Instagram'
      : platform === 'facebook'
        ? 'Facebook'
        : platform === 'youtube'
          ? 'YouTube'
          : null)

  return {
    articleId: articleIdFromUrl(row.url),
    title: row.title,
    sourceName,
    url: row.url,
    summary: summaryParts.length ? summaryParts.join(' · ') : row.blockText.slice(0, 300) || null,
    publishedAt,
    platform,
    searchQuery: query,
  }
}

function buildDbRow(politicoId, searchTerm, item) {
  return {
    politico_id: politicoId,
    search_term: searchTerm,
    collect_channel: 'google_videos',
    platform: item.platform,
    article_id: item.articleId,
    title: item.title,
    source_name: item.sourceName,
    url: item.url,
    summary: item.summary,
    published_at: item.publishedAt,
    collected_at: new Date().toISOString(),
  }
}

function buildUiLine(dbRow) {
  const dateHint = extractVideoDateHint(dbRow.summary)
  const effectiveDate = dbRow.published_at || parseGoogleVideosDateHint(dateHint)
  const displayDate = dateHint?.trim() || (effectiveDate
    ? new Date(effectiveDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'data indisponível')

  return {
    title: dbRow.title,
    subtitleLine: `${dbRow.platform} · ${dbRow.source_name} · Google Vídeos · ${displayDate}`,
    dateHintFromSummary: dateHint,
    published_at: dbRow.published_at,
    effectiveDate,
  }
}

async function main() {
  loadEnvLocal()
  const modes = [
    `https://www.google.com/search?q=${encodeURIComponent(QUERY)}&hl=pt-BR&gl=br&tbm=vid`,
    `https://www.google.com/search?q=${encodeURIComponent(QUERY)}&hl=pt-BR&gl=br&udm=7`,
  ]

  let browser
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'pt-BR',
      viewport: { width: 1280, height: 900 },
    })

    let rawRows = []
    for (const searchUrl of modes) {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await page.waitForTimeout(3000)
      const blocked = await page.evaluate(() =>
        /tráfego incomum|unusual traffic|sorry\/index/i.test(document.body?.innerText ?? '')
      )
      if (blocked) continue
      rawRows = await extractVideosFromPage(page, 3)
      if (rawRows.length > 0) break
    }
    if (rawRows.length === 0) {
      console.log(JSON.stringify({ ok: false, error: 'Nenhum vídeo extraído', query: QUERY }, null, 2))
      process.exit(1)
    }

    const sample = rawRows[0]
    const processed = buildProcessedItem(sample, QUERY)
    const dbRow = buildDbRow('00000000-0000-0000-0000-000000000001', QUERY, processed)
    const ui = buildUiLine(dbRow)

    console.log(
      JSON.stringify(
        {
          ok: true,
          query: QUERY,
          pipeline: {
            '1_dom_bruto': {
              descricao: 'O que o Playwright lê de cada card na SERP',
              campos: sample,
            },
            '2_processado_coleta': {
              descricao: 'Após parseMetadataRow + inferPlatform (antes do Supabase)',
              campos: processed,
            },
            '3_linha_supabase': {
              descricao: 'Objeto gravado em google_news_mentions',
              campos: dbRow,
            },
            '4_exibicao_ui': {
              descricao: 'Como o compare-board monta a linha de metadados',
              campos: ui,
            },
          },
          todos_extraidos: rawRows.length,
          amostra_extra: rawRows.map((r) => ({
            title: r.title?.slice(0, 60),
            metaLine: r.metaLine,
            dateHint: r.dateHint,
            author: r.author,
          })),
        },
        null,
        2
      )
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/Executable doesn't exist|playwright install/i.test(msg)) {
      console.log(JSON.stringify({ ok: false, error: 'Rode: npx playwright install chromium' }, null, 2))
      process.exit(1)
    }
    console.log(JSON.stringify({ ok: false, error: msg }, null, 2))
    process.exit(1)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

main()
