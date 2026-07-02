#!/usr/bin/env node
/**
 * Coleta Google Vídeos (Playwright, aba udm=7) → Supabase.
 * Piloto: tema castração / causa animal (Teresina).
 *
 * Uso:
 *   node scripts/collect-google-videos.mjs
 *   node scripts/collect-google-videos.mjs --slug instagram-causa-animal
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import { createSupabaseClient as createSupabase } from './lib/supabase-client.mjs'
import {
  extractVideoDateHint,
  parseGoogleVideosDateHint,
  parseMetadataRow,
} from './lib/google-videos-date.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const VIDEO_QUERIES = [
  'busão da castração teresina',
  'ônibus da castração teresina',
  'castração teresina piauí',
  'pacto pelos animais piaui teresina',
]

const PAUSE_BETWEEN_QUERIES_MS = 2_500
const PAGE_TIMEOUT_MS = 45_000
const SETTLE_MS = 1_500

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const LOCAL_MARKERS =
  /teresina|piau[ií]|piaui|dirceu|parque piau[ií]|zona sul teresina|meio ambiente piau[ií]/i

const SOCIAL_HOST =
  /instagram\.com|facebook\.com|fb\.watch|youtube\.com|youtu\.be|tiktok\.com|twitter\.com|(?:^|\.)x\.com/i

function logProgress(message) {
  console.error(`[google-videos] ${message}`)
}

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

function emit(result) {
  console.log(JSON.stringify(result))
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseArgs() {
  const args = process.argv.slice(2)
  let politicoSlug = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slug' && args[i + 1]) politicoSlug = args[++i]
  }
  return { politicoSlug }
}

function getMaxItems() {
  const raw = process.env.GOOGLE_VIDEOS_MAX_ITEMS?.trim()
  const n = raw ? Number(raw) : 30
  return Number.isFinite(n) && n > 0 ? Math.min(50, Math.floor(n)) : 30
}

function getMaxScrolls() {
  const raw = process.env.GOOGLE_VIDEOS_MAX_SCROLLS?.trim()
  const n = raw ? Number(raw) : 10
  return Number.isFinite(n) && n > 0 ? Math.min(20, Math.floor(n)) : 10
}

function isSocialOnly() {
  const raw = process.env.GOOGLE_VIDEOS_SOCIAL_ONLY?.trim().toLowerCase()
  return !(raw === '0' || raw === 'false' || raw === 'no')
}

function isLocalFilterEnabled() {
  const raw = process.env.GOOGLE_VIDEOS_LOCAL_FILTER?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function unwrapGoogleRedirectUrl(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('google.') && (u.pathname === '/url' || u.pathname === '/imgres')) {
      const target = u.searchParams.get('q') || u.searchParams.get('url')
      if (target?.startsWith('http')) return target
    }
  } catch {
    /* ignore */
  }
  return url
}

function inferPlatform(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
    if (host.includes('instagram.com')) return 'instagram'
    if (host.includes('facebook.com') || host === 'fb.watch') return 'facebook'
    if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube'
    if (host === 'twitter.com' || host === 'x.com') return 'twitter'
    if (host.includes('tiktok.com')) return 'tiktok'
    return 'website'
  } catch {
    return 'other'
  }
}

function articleIdFromUrl(url) {
  return normalizeVideoUrl(url).slice(0, 500)
}

function extractDateHintFromText(text) {
  return extractVideoDateHint(text)
}

function parseRelativeDate(raw) {
  return parseGoogleVideosDateHint(raw)
}

function authorFromTitle(title) {
  const ig = title.match(/^(.+?)\s+on\s+Instagram:/i)
  if (ig?.[1] && ig[1].length <= 80) return ig[1].trim()
  const yt = title.match(/^(.+?)\s+-\s+YouTube$/i)
  if (yt?.[1] && yt[1].length <= 80) return yt[1].trim()
  return null
}

function platformLabel(platform) {
  if (platform === 'instagram') return 'Instagram'
  if (platform === 'facebook') return 'Facebook'
  if (platform === 'youtube') return 'YouTube'
  if (platform === 'tiktok') return 'TikTok'
  return null
}

function buildVideoSummary(row, meta, dateHint, platform, sourceName) {
  if (row.metaLine?.trim()) return row.metaLine.trim()
  const plat = platformLabel(platform)
  if (dateHint && plat) {
    return `${plat} · ${sourceName ?? plat} · ${dateHint}`
  }
  const parts = [row.duration, dateHint].filter(Boolean)
  if (parts.length) return parts.join(' · ')
  return row.blockText?.slice(0, 300) || null
}

function matchesLocalRelevance(item) {
  const text = `${item.title} ${item.summary ?? ''} ${item.url}`
  return LOCAL_MARKERS.test(text)
}

function actorHasVideoTheme(actor) {
  const slug = (actor.slug ?? '').toLowerCase().replace(/-/g, ' ')
  const name = (actor.name ?? '').toLowerCase()
  if (slug.includes('causa animal') || name.includes('causa animal')) return true
  if (slug.includes('instagram') && (slug.includes('causa animal') || name.includes('causa animal'))) {
    return true
  }
  return slug.includes('instagram causa animal')
}

function buildVideosSearchUrl(query, mode = 'vid') {
  const hl = process.env.GOOGLE_VIDEOS_LANGUAGE?.trim() || 'pt-BR'
  const gl = process.env.GOOGLE_VIDEOS_COUNTRY?.trim() || 'br'
  const params = new URLSearchParams({
    q: query,
    hl,
    gl,
  })
  if (mode === 'udm7') params.set('udm', '7')
  else params.set('tbm', 'vid')
  return `https://www.google.com/search?${params.toString()}`
}

function normalizeVideoUrl(url) {
  try {
    const u = new URL(url)
    u.hash = ''
    let path = u.pathname.replace(/\/+$/, '') || '/'
    if (u.hostname.includes('instagram.com') && path.startsWith('/reel/')) {
      path = path.split('/').slice(0, 3).join('/')
    }
    if (u.hostname.includes('youtube.com') && path === '/watch') {
      const v = u.searchParams.get('v')
      if (v) return `youtube.com/watch?v=${v}`
    }
    if (u.hostname === 'youtu.be') {
      return `youtu.be${path}`
    }
    return `${u.hostname.replace(/^www\./i, '')}${path}`
  } catch {
    return url.slice(0, 500)
  }
}

function isSocialHostUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
    return (
      host.includes('instagram.com') ||
      host.includes('facebook.com') ||
      host === 'fb.watch' ||
      host.includes('youtube.com') ||
      host === 'youtu.be' ||
      host.includes('tiktok.com') ||
      host === 'twitter.com' ||
      host === 'x.com'
    )
  } catch {
    return false
  }
}

async function dismissGoogleConsent(page) {
  const selectors = [
    'button:has-text("Aceitar tudo")',
    'button:has-text("Accept all")',
    'button:has-text("Rejeitar tudo")',
    'button:has-text("Reject all")',
    '#L2AGLb',
  ]
  for (const sel of selectors) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
      await btn.click().catch(() => {})
      await sleep(600)
      return
    }
  }
}

async function scrollVideoResults(page) {
  const maxScrolls = getMaxScrolls()
  let prevCount = 0
  let stable = 0

  for (let i = 0; i < maxScrolls; i++) {
    try {
      await page.evaluate(() => {
        const root = document.querySelector('#search') || document.querySelector('#rso')
        if (root && typeof root.scrollHeight === 'number') {
          root.scrollTop = root.scrollHeight
        }
        const body = document.body
        if (body && typeof body.scrollHeight === 'number') {
          window.scrollTo(0, body.scrollHeight)
        } else {
          window.scrollBy(0, 900)
        }
      })
    } catch {
      await page.mouse.wheel(0, 1200).catch(() => {})
    }
    await page.mouse.wheel(0, 1400)
    await sleep(450)

    const count = await page
      .evaluate(() => {
        const root = document.querySelector('#search') || document.querySelector('#rso') || document.body
        if (!root) return 0
        return root.querySelectorAll(
          'a[href*="instagram.com"], a[href*="youtube.com"], a[href*="youtu.be"], a[href*="facebook.com"], a[href*="fb.watch"], a[href*="tiktok.com"]'
        ).length
      })
      .catch(() => 0)

    logProgress(`scroll ${i + 1}/${maxScrolls} — ${count} link(s) de vídeo no DOM`)
    if (count <= prevCount) stable += 1
    else {
      stable = 0
      prevCount = count
    }
    if (stable >= 2 && prevCount > 0) break
    if (i >= 4 && stable >= 3 && prevCount === 0) break
  }
}

async function extractVideosFromPage(page, maxItems) {
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

    function hasDateSignal(text) {
      return (
        /(?:Instagram|Facebook|YouTube|TikTok)\s*·/i.test(text) ||
        /\d+\s+(?:minuto|minutos|hora|horas|dia|dias|semana|semanas|mês|meses)\s+atrás/i.test(text) ||
        /\d{1,2}\s+de\s+[\wçãéíóú.]+\s+de\s+\d{4}/i.test(text)
      )
    }

    function findResultContainer(anchor) {
      let best = null
      let tight = anchor.parentElement
      for (let depth = 0; depth < 12 && tight; depth++) {
        const links = tight.querySelectorAll(
          'a[href*="instagram.com"], a[href*="youtube.com"], a[href*="youtu.be"], a[href*="facebook.com"], a[href*="fb.watch"]'
        )
        const textLen = cardVisibleText(tight).length
        if (links.length >= 1 && links.length <= 3 && textLen >= 40 && textLen <= 1200) {
          const text = cardVisibleText(tight)
          if (hasDateSignal(text)) return tight
          if (!best && textLen <= 900) best = tight
        }
        tight = tight.parentElement
      }
      return best ?? anchor.closest('.MjjYud') ?? anchor.closest('div.g') ?? anchor.parentElement ?? anchor
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
      if (idx >= 0) return cardText.slice(idx, idx + 140).trim()
      const dateOnly = cardText.match(
        /\d+\s+(?:minuto|minutos|hora|horas|dia|dias|semana|semanas|mês|meses)\s+atrás/i
      )
      if (dateOnly?.index != null && dateOnly.index > 0) {
        return cardText.slice(Math.max(0, dateOnly.index - 80), dateOnly.index + dateOnly[0].length).trim()
      }
      return ''
    }

    function extractDateHintFallback(text) {
      if (!text) return null
      const patterns = [
        /\d+\s+(?:minuto|minutos|hora|horas|dia|dias|semana|semanas|mês|meses|ano|anos)\s+atrás/i,
        /\d{1,2}\s+de\s+[\wçãéíóú.]+\s+de\s+\d{4}/i,
        /\bhá\s+\d+\s+(?:minuto|minutos|hora|horas|dia|dias|semana|semanas)/i,
      ]
      for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match?.[0]) return match[0].trim()
      }
      return null
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
      const dateHint = extractDateHint(metaLine) || extractDateHintFallback(cardText)
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
    }

    out.sort((a, b) => {
      const score = (row) =>
        Number(row.hasDuration) * 4 +
        Number(/instagram|youtube|facebook/i.test(row.url)) * 2 +
        Math.min(row.title.length, 80) / 80
      return score(b) - score(a)
    })

    return out.slice(0, max * 2)
  }, { max: maxItems })
}

async function scrapeVideosForQuery(page, query, maxItems) {
  const modes = ['vid', 'udm7']
  const seenUrls = new Set()
  const allRaw = []

  for (const mode of modes) {
    const searchUrl = buildVideosSearchUrl(query, mode === 'udm7' ? 'udm7' : 'vid')
    logProgress(`Buscando (${mode}): ${query}`)
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
    await dismissGoogleConsent(page)
    await sleep(SETTLE_MS)

    const blocked = await page.evaluate(() =>
      /tráfego incomum|unusual traffic|sorry\/index/i.test(document.body?.innerText ?? '')
    )
    if (blocked) {
      throw new Error('Google bloqueou a busca (CAPTCHA). Tente novamente em alguns minutos ou rode o script localmente.')
    }

    await scrollVideoResults(page)
    await sleep(600)

    const batch = await extractVideosFromPage(page, maxItems)
    let added = 0
    for (const row of batch) {
      const url = unwrapGoogleRedirectUrl(row.url)
      const key = normalizeVideoUrl(url)
      if (seenUrls.has(key)) continue
      seenUrls.add(key)
      allRaw.push({ ...row, url })
      added += 1
    }

    logProgress(`${query} (${mode}): ${added} vídeo(s) novos no lote · ${allRaw.length} total`)
    if (allRaw.length >= maxItems) break
    if (mode === 'vid' && allRaw.length >= 8) break
  }
  const socialOnly = isSocialOnly()
  const localFilter = isLocalFilterEnabled()
  const filtered = []

  for (const row of allRaw) {
    const url = unwrapGoogleRedirectUrl(row.url)
    if (!isSocialHostUrl(url)) continue

    const meta = parseMetadataRow(row.metaLine || row.blockText)
    const dateHint =
      row.dateHint ||
      meta.dateHint ||
      extractDateHintFromText(row.metaLine || row.blockText || '')
    const publishedAt = parseRelativeDate(dateHint)

    const platform = inferPlatform(url)
    const sourceName =
      row.author?.trim() ||
      meta.author ||
      authorFromTitle(row.title) ||
      null

    const item = {
      articleId: articleIdFromUrl(url),
      title: row.title,
      sourceName:
        sourceName ||
        (platform === 'instagram'
          ? 'Instagram'
          : platform === 'facebook'
            ? 'Facebook'
            : platform === 'youtube'
              ? 'YouTube'
              : null),
      url,
      summary: buildVideoSummary(row, meta, dateHint, platform, sourceName),
      publishedAt,
      platform,
      searchQuery: query,
    }

    if (socialOnly && !['instagram', 'facebook', 'youtube', 'tiktok', 'twitter'].includes(platform)) {
      continue
    }

    if (localFilter && !matchesLocalRelevance(item)) continue
    filtered.push(item)
    if (filtered.length >= maxItems) break
  }

  logProgress(
    `${query}: ${filtered.length} vídeo(s) após filtros — ${filtered.filter((i) => i.publishedAt).length} com data`
  )
  return filtered
}

async function upsertVideos(supabase, politicoId, searchTerm, items) {
  if (items.length === 0) return { inserted: 0, updated: 0 }

  const articleIds = items.map((i) => i.articleId)
  const { data: existing } = await supabase
    .from('google_news_mentions')
    .select('article_id')
    .eq('politico_id', politicoId)
    .in('article_id', articleIds)

  const existingSet = new Set((existing ?? []).map((r) => r.article_id))
  const collectedAt = new Date().toISOString()

  const rows = items.map((item) => ({
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
    collected_at: collectedAt,
  }))

  const { error } = await supabase.from('google_news_mentions').upsert(rows, {
    onConflict: 'politico_id,article_id',
  })
  if (error) throw new Error(error.message)

  let inserted = 0
  let updated = 0
  for (const item of items) {
    if (existingSet.has(item.articleId)) updated += 1
    else inserted += 1
  }
  return { inserted, updated }
}

async function purgeStaleTerms(supabase, politicoId, searchTerms) {
  const inList = `(${searchTerms.map((t) => `"${t.replace(/"/g, '""')}"`).join(',')})`
  const { error } = await supabase
    .from('google_news_mentions')
    .delete()
    .eq('politico_id', politicoId)
    .eq('collect_channel', 'google_videos')
    .not('search_term', 'in', inList)
  if (error) throw new Error(error.message)
}

async function main() {
  loadEnvLocal()
  const { politicoSlug } = parseArgs()
  const maxItems = getMaxItems()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    emit({ ok: false, error: 'NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.' })
    process.exit(1)
  }

  const supabase = createSupabase(url, key, { auth: { persistSession: false } })

  let actorsQuery = supabase
    .from('political_actors')
    .select('id, name, slug, active')
    .eq('active', true)
    .order('name', { ascending: true })

  if (politicoSlug) {
    actorsQuery = actorsQuery.eq('slug', politicoSlug)
  }

  const { data: actors, error: actorsErr } = await actorsQuery
  if (actorsErr) {
    emit({ ok: false, error: actorsErr.message })
    process.exit(1)
  }

  const videoActors = (actors ?? []).filter(actorHasVideoTheme)
  if (videoActors.length === 0) {
    emit({
      ok: true,
      results: [],
      totals: { videosFound: 0, videosInserted: 0, videosUpdated: 0, errors: [] },
    })
    return
  }

  let browser
  const results = []
  const allErrors = []
  let totalFound = 0
  let totalInserted = 0
  let totalUpdated = 0

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    })

    const context = await browser.newContext({
      userAgent: CHROME_UA,
      locale: 'pt-BR',
      viewport: { width: 1280, height: 900 },
    })
    const page = await context.newPage()

    for (const actor of videoActors) {
      const actorResult = {
        politicoId: actor.id,
        politicoName: actor.name,
        videosFound: 0,
        videosInserted: 0,
        videosUpdated: 0,
        errors: [],
      }

      const seenArticleIds = new Set()
      const collectedByQuery = []

      for (let qi = 0; qi < VIDEO_QUERIES.length; qi++) {
        const query = VIDEO_QUERIES[qi]
        try {
          const items = await scrapeVideosForQuery(page, query, maxItems)
          const unique = items.filter((item) => {
            if (seenArticleIds.has(item.articleId)) return false
            seenArticleIds.add(item.articleId)
            return true
          })

          actorResult.videosFound += unique.length
          collectedByQuery.push({ query, items: unique })
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Erro desconhecido'
          actorResult.errors.push(`${query}: ${msg}`)
        }

        if (qi < VIDEO_QUERIES.length - 1) await sleep(PAUSE_BETWEEN_QUERIES_MS)
      }

      if (actorResult.videosFound === 0) {
        actorResult.errors.push(
          'Nenhum vídeo encontrado (Google pode ter bloqueado ou a página veio vazia). Dados anteriores mantidos.'
        )
        allErrors.push(...actorResult.errors)
        results.push(actorResult)
        continue
      }

      await supabase
        .from('google_news_mentions')
        .delete()
        .eq('politico_id', actor.id)
        .eq('collect_channel', 'google_videos')

      for (const batch of collectedByQuery) {
        if (batch.items.length === 0) continue
        const { inserted, updated } = await upsertVideos(supabase, actor.id, batch.query, batch.items)
        actorResult.videosInserted += inserted
        actorResult.videosUpdated += updated
      }

      try {
        await purgeStaleTerms(supabase, actor.id, VIDEO_QUERIES)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao limpar termos antigos'
        actorResult.errors.push(msg)
      }

      totalFound += actorResult.videosFound
      totalInserted += actorResult.videosInserted
      totalUpdated += actorResult.videosUpdated
      allErrors.push(...actorResult.errors)
      results.push(actorResult)
    }

    await context.close()

    emit({
      ok: true,
      results,
      totals: {
        videosFound: totalFound,
        videosInserted: totalInserted,
        videosUpdated: totalUpdated,
        errors: allErrors,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta Google Vídeos'
    if (/Executable doesn't exist|playwright install/i.test(msg)) {
      emit({
        ok: false,
        error: 'Chromium do Playwright não instalado. Rode: npx playwright install chromium',
      })
      process.exit(1)
    }
    emit({ ok: false, error: msg })
    process.exit(1)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

main().catch((e) => {
  emit({ ok: false, error: e instanceof Error ? e.message : String(e) })
  process.exit(1)
})
