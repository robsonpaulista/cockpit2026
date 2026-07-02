#!/usr/bin/env node
/**
 * Coleta Meta Ads Library (Playwright) → Supabase.
 * Busca por nome do candidato em facebook.com/ads/library (anúncios políticos, BR).
 *
 * Uso:
 *   node scripts/collect-meta-ads.mjs
 *   node scripts/collect-meta-ads.mjs --slug jadyel-alencar
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import { createSupabaseClient as createSupabase } from './lib/supabase-client.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const MAX_ADS_PER_ACTOR = 200
const DETAIL_PAUSE_MS = 600
const DETAIL_TIMEOUT_MS = 35_000
const PAUSE_BETWEEN_ACTORS_MS = 2_000
const PAGE_TIMEOUT_MS = 45_000
const LISTING_SETTLE_MS = 2_000
const SCROLL_PAUSE_MS = 700

function getMaxScrolls() {
  const raw = process.env.META_ADS_MAX_SCROLLS?.trim()
  const n = raw ? Number(raw) : 14
  return Number.isFinite(n) && n > 0 ? Math.min(40, Math.floor(n)) : 14
}

function isDualSearchEnabled() {
  const v = process.env.META_ADS_DUAL_SEARCH?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function getSearchTypeOverride() {
  const override = process.env.META_ADS_SEARCH_TYPE?.trim().toLowerCase()
  if (override === 'keyword_exact_phrase' || override === 'exact' || override === 'exact_phrase') {
    return 'keyword_exact_phrase'
  }
  if (override === 'keyword_unordered' || override === 'unordered') {
    return 'keyword_unordered'
  }
  return null
}

function formatElapsed(ms) {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}min ${sec % 60}s`
}

function getActiveStatusFilter() {
  const raw = process.env.META_ADS_ACTIVE_STATUS?.trim().toLowerCase()
  if (raw === 'active' || raw === 'ativos') return 'active'
  if (raw === 'inactive' || raw === 'inativos') return 'inactive'
  return 'all'
}

function isGeoCollectionEnabled() {
  const enable = process.env.META_ADS_GEO_DETAILS?.trim().toLowerCase()
  if (enable === '1' || enable === 'true' || enable === 'yes') return true
  if (process.env.META_ADS_SKIP_DETAILS === '1' || process.env.META_ADS_SKIP_DETAILS === 'true') {
    return false
  }
  return false
}

const ENABLE_GEO_DETAILS = isGeoCollectionEnabled()
const MAX_AD_DETAILS = Number(process.env.META_ADS_MAX_DETAILS ?? 30)
const SKIP_GEO_DETAILS = !ENABLE_GEO_DETAILS

function logProgress(message) {
  console.error(`[meta-ads] ${message}`)
}

function calcCollectPercent(input) {
  const actorTotal = input.actorTotal ?? 1
  const actorIndex = Math.max(1, input.actorIndex ?? 1)
  const phase = input.phase ?? 'starting'

  let step = 0.02
  if (phase === 'browser') step = 0.06
  else if (phase === 'listing') step = SKIP_GEO_DETAILS ? 0.55 : 0.22
  else if (phase === 'geo') {
    const adTotal = Math.max(1, input.adTotal ?? 1)
    const adIndex = Math.max(0, input.adIndex ?? 0)
    step = 0.22 + (adIndex / adTotal) * 0.68
  } else if (phase === 'upsert') step = SKIP_GEO_DETAILS ? 0.85 : 0.94
  else if (phase === 'done') return 100

  const base = (actorIndex - 1) / actorTotal
  const slice = step / actorTotal
  return Math.min(99, Math.max(0, Math.round((base + slice) * 100)))
}

function createProgressReporter(supabase, logId) {
  if (!logId) {
    return async () => {}
  }

  const startedAt = new Date().toISOString()
  let last = { startedAt }

  return async (patch) => {
    last = {
      ...last,
      ...patch,
      startedAt,
      updatedAt: new Date().toISOString(),
    }
    if (last.percent === undefined) {
      last.percent = calcCollectPercent(last)
    }
    await supabase
      .from('meta_ads_collect_log')
      .update({ progress: last })
      .eq('id', logId)
      .then(() => {})
      .catch(() => {})
  }
}

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

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

function buildSearchUrl(searchTerm, opts = {}) {
  const params = new URLSearchParams({
    active_status: getActiveStatusFilter(),
    ad_type: 'political_and_issue_ads',
    country: 'BR',
    q: searchTerm,
    search_type: opts.searchType ?? 'keyword_unordered',
    media_type: 'all',
  })
  return `https://www.facebook.com/ads/library/?${params.toString()}`
}

function unixToIso(ts) {
  if (ts == null || ts === '') return null
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return null
  const ms = n > 1e12 ? n : n * 1000
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function formatInsightsRange(range) {
  if (!range || typeof range !== 'object') return null
  const lo = range.lower_bound ?? range.lower ?? ''
  const hi = range.upper_bound ?? range.upper ?? ''
  if (!lo && !hi) return null
  if (lo && hi && lo !== hi) return `${lo} – ${hi}`
  return String(lo || hi)
}

function parseMoneyFromRange(range, currency) {
  if (!range || typeof range !== 'object') {
    return { spendText: null, spendMinBrl: null, spendMaxBrl: null }
  }
  const text = formatInsightsRange(range)
  if (!text) return { spendText: null, spendMinBrl: null, spendMaxBrl: null }
  const spendText = currency === 'BRL' ? `R$ ${text}` : text
  const lo = parseMoneyToken(String(range.lower_bound ?? range.lower ?? ''))
  const hi = parseMoneyToken(String(range.upper_bound ?? range.upper ?? range.lower_bound ?? ''))
  if (currency !== 'BRL') return { spendText, spendMinBrl: null, spendMaxBrl: null }
  return { spendText, spendMinBrl: lo, spendMaxBrl: hi ?? lo }
}

function mapGraphqlAdNode(node) {
  if (!node || typeof node !== 'object') return null
  const collated = Array.isArray(node.collated_results) ? node.collated_results[0] : null
  const base = collated ?? node
  const libraryAdId = String(base.ad_archive_id ?? node.ad_archive_id ?? '').trim()
  if (!libraryAdId || !/^\d+$/.test(libraryAdId)) return null

  const snap = base.snapshot ?? base
  const bodyText =
    snap.body?.text ??
    snap.body ??
    (Array.isArray(snap.ad_creative_bodies) ? snap.ad_creative_bodies[0] : null) ??
    null

  const spendRaw = base.spend ?? snap.spend ?? node.spend
  const impressionsRaw = base.impressions ?? snap.impressions ?? node.impressions
  const currency = base.currency ?? snap.currency ?? node.currency ?? 'BRL'
  const spend = parseMoneyFromRange(spendRaw, currency)

  const platformsRaw =
    base.publisher_platform ??
    base.publisher_platforms ??
    snap.publisher_platform ??
    snap.publisher_platforms ??
    node.publisher_platform ??
    node.publisher_platforms
  const platforms = Array.isArray(platformsRaw)
    ? platformsRaw.join(', ')
    : typeof platformsRaw === 'string'
      ? platformsRaw
      : null

  const startedRunningAt =
    unixToIso(base.start_date ?? node.start_date ?? base.ad_delivery_start_time) ?? null
  const endedRunningAt =
    unixToIso(base.end_date ?? node.end_date ?? base.ad_delivery_stop_time) ?? null

  let isActive = base.is_active ?? node.is_active
  if (typeof isActive !== 'boolean') {
    isActive = endedRunningAt ? new Date(endedRunningAt).getTime() > Date.now() : true
  }

  const payerName =
    base.bylines ??
    snap.bylines ??
    base.paid_for_by ??
    snap.paid_for_by ??
    null

  const brReach = base.br_total_reach ?? snap.br_total_reach ?? node.br_total_reach
  const audienceSizeText =
    brReach != null
      ? `Alcance BR: ${Number(brReach).toLocaleString('pt-BR')}`
      : formatInsightsRange(base.estimated_audience_size ?? snap.estimated_audience_size)

  return {
    libraryAdId,
    pageName: snap.page_name ?? base.page_name ?? node.page_name ?? null,
    pageId: snap.page_id ?? base.page_id ?? node.page_id ?? null,
    payerName: typeof payerName === 'string' ? payerName.trim() : null,
    adBody: typeof bodyText === 'string' ? bodyText.trim() : null,
    libraryUrl: `https://www.facebook.com/ads/library/?id=${libraryAdId}`,
    isActive,
    startedRunningAt,
    endedRunningAt,
    spendText: spend.spendText,
    spendMinBrl: spend.spendMinBrl,
    spendMaxBrl: spend.spendMaxBrl,
    impressionsText: formatInsightsRange(impressionsRaw),
    audienceSizeText,
    adsInGroup: Array.isArray(node.collated_results) ? node.collated_results.length : null,
    targetLocations: [],
    targetLocationsText: null,
    deliveryByRegion: [],
    deliveryByRegionText: null,
  }
}

function ingestGraphqlPayload(json, adsById) {
  if (!json || typeof json !== 'object') return 0
  let added = 0

  const edges = json?.data?.ad_library_main?.search_results_connection?.edges
  if (Array.isArray(edges)) {
    for (const edge of edges) {
      const node = edge?.node
      if (!node) continue
      if (Array.isArray(node.collated_results)) {
        for (const item of node.collated_results) {
          const mapped = mapGraphqlAdNode({ ...node, ...item, collated_results: node.collated_results })
          if (mapped && !adsById.has(mapped.libraryAdId)) {
            adsById.set(mapped.libraryAdId, mapped)
            added += 1
          }
        }
        continue
      }
      const mapped = mapGraphqlAdNode(node)
      if (mapped && !adsById.has(mapped.libraryAdId)) {
        adsById.set(mapped.libraryAdId, mapped)
        added += 1
      }
    }
  }

  function walk(obj) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item)
      return
    }
    if (obj.ad_archive_id != null && (obj.snapshot || obj.page_name || obj.start_date != null)) {
      const mapped = mapGraphqlAdNode(obj)
      if (mapped && !adsById.has(mapped.libraryAdId)) {
        adsById.set(mapped.libraryAdId, mapped)
        added += 1
      }
    }
    for (const value of Object.values(obj)) walk(value)
  }

  walk(json)
  return added
}

function ingestGraphqlRawText(text, adsById) {
  if (!text || typeof text !== 'string') return 0
  let added = 0

  const tryParse = (chunk) => {
    const trimmed = chunk.replace(/^\s*for\s*\(\s*;;\s*\)\s*;\s*/, '').trim()
    if (!trimmed.startsWith('{')) return 0
    try {
      return ingestGraphqlPayload(JSON.parse(trimmed), adsById)
    } catch {
      return 0
    }
  }

  for (const line of text.split('\n')) {
    added += tryParse(line)
  }
  if (added === 0) {
    added += tryParse(text)
  }

  return added
}

function createGraphqlAdCollector() {
  const adsById = new Map()
  let attached = false

  function attachToPage(page) {
    if (attached) return
    attached = true

    page.on('response', async (response) => {
      const url = response.url()
      if (!url.includes('/api/graphql/')) return
      try {
        const text = await response.text()
        const before = adsById.size
        ingestGraphqlRawText(text, adsById)
        const added = adsById.size - before
        if (added > 0) {
          logProgress(`GraphQL: +${added} anúncio(s) (total ${adsById.size})`)
        }
      } catch {
        // stream indisponível
      }
    })
  }

  return {
    attachToPage,
    clear: () => adsById.clear(),
    size: () => adsById.size,
    getAds: () => [...adsById.values()],
  }
}

const LIBRARY_ID_RE = /(?:Identifica(?:ç|c)ão da biblioteca|Library ID)[:\s]*(\d+)/gi

function parsePtMonth(monthStr) {
  const key = monthStr.toLowerCase().slice(0, 3)
  const map = {
    jan: 0,
    fev: 1,
    mar: 2,
    abr: 3,
    mai: 4,
    jun: 5,
    jul: 6,
    ago: 7,
    set: 8,
    out: 9,
    nov: 10,
    dez: 11,
  }
  return map[key] ?? null
}

function parsePtDate(str) {
  const m = str.trim().match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
  if (!m) return null
  const month = parsePtMonth(m[2])
  if (month === null) return null
  const day = Number(m[1])
  const year = Number(m[3])
  const d = new Date(Date.UTC(year, month, day))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function normalizeText(text) {
  return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractMetricLine(block, labels) {
  for (const label of labels) {
    const re = new RegExp(`${label}:?\\s*\\n([^\\n]+)`, 'i')
    const m = block.match(re)
    if (m) return normalizeText(m[1])
  }
  return null
}

function parseMoneyToken(token) {
  if (!token) return null
  let t = normalizeText(token).replace(/^R\$\s*/i, '').replace(/^>\s*/, '')
  const m = t.match(/^([\d.,]+)\s*(mil|mi|k|milhão|milhões)?$/i)
  if (!m) return null
  let n = Number(m[1].replace(/\./g, '').replace(',', '.'))
  if (Number.isNaN(n)) n = Number(m[1].replace(',', '.'))
  if (Number.isNaN(n)) return null
  const unit = (m[2] || '').toLowerCase()
  if (unit === 'mil' || unit === 'k') n *= 1_000
  if (unit === 'mi' || unit.startsWith('milh')) n *= 1_000_000
  return n
}

function parseSpendRange(spendText) {
  if (!spendText) {
    return { spendText: null, spendMinBrl: null, spendMaxBrl: null }
  }
  const text = normalizeText(spendText)
  const rangeMatch = text.match(
    /R?\$?\s*([\d.,]+\s*(?:mil|mi)?)\s*(?:a|to|-)\s*R?\$?\s*([\d.,]+\s*(?:mil|mi)?)/i
  )
  if (rangeMatch) {
    return {
      spendText: text,
      spendMinBrl: parseMoneyToken(rangeMatch[1]),
      spendMaxBrl: parseMoneyToken(rangeMatch[2]),
    }
  }
  const single = parseMoneyToken(text)
  return { spendText: text, spendMinBrl: single, spendMaxBrl: single }
}

const SECTION_STOP_RE =
  /^(Demograf|Distribui|Impress|Valor gasto|Amount spent|Plataform|Platform|Categor|Patrocinado|Sponsored|Ativo|Inativo|Active|Inactive|Identifica|Library ID|Ver detalhes|See ad details|Tamanho estimado|Estimated audience|Idade|Age|Gênero|Gender)/i

const GEO_NOISE =
  /^(male|female|homem|mulher|unknown|desconhecido|brasil|brazil|todos|all|women|men|masculino|feminino|idade|gender|gênero|genero)$/i

function cleanGeoLocationName(name) {
  return normalizeText(name)
    .replace(/,\s*brasil\s*$/i, '')
    .replace(/,\s*brazil\s*$/i, '')
    .trim()
}

function isLikelyCityOrState(name) {
  const n = cleanGeoLocationName(name)
  if (n.length < 2 || n.length > 48) return false
  if (GEO_NOISE.test(n)) return false
  if (/^\d+([.,]\d+)?\s*%?$/.test(n)) return false
  if (/^\d+\s*[-–]\s*\d+/.test(n)) return false
  return true
}

function splitLocationNames(raw) {
  if (!raw) return []
  const normalized = normalizeText(raw)
  if (/,\s*brasil$/i.test(normalized) || /,\s*brazil$/i.test(normalized)) {
    const cleaned = cleanGeoLocationName(normalized)
    return cleaned ? [cleaned] : []
  }
  return normalized
    .split(/[,;·|]/)
    .map((part) => cleanGeoLocationName(part))
    .filter((part) => part.length > 1 && !/^(inclu[íi]do|exclu[íi]do|included|excluded)$/i.test(part))
}

const LOCATION_TYPE_RE =
  /^(estado|cidade|state|city|região|regiao|region|país|pais|country|condado|county|bairro|neighborhood|dma)$/i
const INCLUSION_RE = /^(inclu[íi]da?|exclu[íi]da?|included|excluded)$/i

function parseAudienceLocationTable(bodyText) {
  const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean)
  const locations = []
  const seen = new Set()

  function pushLocation(name, excluded = false) {
    const normalized = cleanGeoLocationName(name)
    if (!isLikelyCityOrState(normalized)) return
    const key = `${excluded ? '!' : ''}${normalized.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    locations.push({ name: normalized, excluded })
  }

  for (let i = 0; i < lines.length - 2; i++) {
    const loc = lines[i]
    const type = lines[i + 1]
    const incl = lines[i + 2]
    if (!LOCATION_TYPE_RE.test(type) || !INCLUSION_RE.test(incl)) continue
    if (/^(localização|location|tipo de localização|location type|incluiu ou excluiu|included or excluded)$/i.test(loc)) {
      continue
    }
    pushLocation(loc, /exclu/i.test(incl))
  }

  return locations
}

function extractMultilineSection(bodyText, startLabels) {
  const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean)
  let capturing = false
  const collected = []

  for (const line of lines) {
    if (!capturing) {
      const matched = startLabels.find((label) => {
        const re = new RegExp(`^${label}\\b`, 'i')
        return re.test(line) || line.toLowerCase() === label.toLowerCase()
      })
      if (!matched) continue
      capturing = true
      const afterColon = line.includes(':') ? line.split(':').slice(1).join(':').trim() : ''
      if (afterColon) collected.push(...splitLocationNames(afterColon))
      continue
    }
    if (SECTION_STOP_RE.test(line)) break
    if (/^\d+[.,]?\d*\s*%$/.test(line)) break
    collected.push(line)
  }

  return collected
}

function parseTargetLocations(bodyText) {
  const locations = []
  const seen = new Set()

  function pushLocation(name, excluded = false) {
    const normalized = cleanGeoLocationName(name)
    if (!isLikelyCityOrState(normalized)) return
    const key = `${excluded ? '!' : ''}${normalized.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    locations.push({ name: normalized, excluded })
  }

  for (const loc of parseAudienceLocationTable(bodyText)) {
    pushLocation(loc.name, loc.excluded)
  }

  for (const label of [
    'Localização incluída',
    'Localizações incluídas',
    'Included location',
    'Included locations',
    'Cidades incluídas',
    'Estados incluídos',
    'Location included',
  ]) {
    const raw = extractMetricLine(bodyText, [label])
    if (raw) {
      for (const name of splitLocationNames(raw)) pushLocation(name, false)
    }
  }

  for (const label of [
    'Localização excluída',
    'Localizações excluídas',
    'Excluded location',
    'Excluded locations',
  ]) {
    const raw = extractMetricLine(bodyText, [label])
    if (raw) {
      for (const name of splitLocationNames(raw)) pushLocation(name, true)
    }
  }

  for (const match of bodyText.matchAll(
    /(?:Localiza(?:ç|c)[õo]es?\s+inclu[íi]das?|Included locations?|Inclu[íi]do[s]?)\s*:?\s*([^\n]+)/gi
  )) {
    for (const name of splitLocationNames(match[1])) pushLocation(name, false)
  }

  for (const match of bodyText.matchAll(
    /(?:Localiza(?:ç|c)[õo]es?\s+exclu[íi]das?|Excluded locations?|Exclu[íi]do[s]?)\s*:?\s*([^\n]+)/gi
  )) {
    for (const name of splitLocationNames(match[1])) pushLocation(name, true)
  }

  const includedSection = extractMultilineSection(bodyText, [
    'Localizações incluídas',
    'Included locations',
    'Incluído',
    'Included',
  ])
  for (const line of includedSection) {
    if (/^exclu[íi]do|^excluded/i.test(line)) break
    for (const name of splitLocationNames(line)) pushLocation(name, false)
  }

  const excludedSection = extractMultilineSection(bodyText, [
    'Localizações excluídas',
    'Excluded locations',
    'Excluído',
    'Excluded',
  ])
  for (const line of excludedSection) {
    for (const name of splitLocationNames(line)) pushLocation(name, true)
  }

  const genericSection = extractMultilineSection(bodyText, [
    'Segmentação de localização',
    'Localização',
    'Location targeting',
    'Target locations',
    'Localizações',
  ])
  for (const line of genericSection) {
    for (const name of splitLocationNames(line)) pushLocation(name, false)
  }

  const targetLocationsText =
    locations.length > 0
      ? locations
          .map((loc) => (loc.excluded ? `exc. ${loc.name}` : loc.name))
          .join(' · ')
      : null

  return { targetLocations: locations, targetLocationsText }
}

function parseDeliveryByRegion(bodyText) {
  const regions = []
  const seen = new Set()

  function pushRegion(region, pct = null) {
    const name = cleanGeoLocationName(region)
    if (!isLikelyCityOrState(name)) return
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    regions.push({ region: name, pct })
  }

  const section = extractMultilineSection(bodyText, [
    'Distribuição por região',
    'Distribution by region',
    'Entrega por região',
    'Delivery by region',
    'Alcance por região',
  ])

  for (let i = 0; i < section.length; i++) {
    const line = section[i]
    const inline = line.match(/^(.+?)\s*[·:\-]\s*(\d+[.,]?\d*)\s*%?$/)
    if (inline) {
      pushRegion(inline[1], Number(inline[2].replace(',', '.')))
      continue
    }
    const pctInline = line.match(/^(.+?)\s+(\d+[.,]?\d*)\s*%$/)
    if (pctInline) {
      pushRegion(pctInline[1], Number(pctInline[2].replace(',', '.')))
      continue
    }
    const next = section[i + 1]
    if (next && /^\d+[.,]?\d*\s*%$/.test(next)) {
      pushRegion(line, Number(next.replace('%', '').replace(',', '.')))
      i += 1
      continue
    }
  }

  if (regions.length === 0) {
    for (const match of bodyText.matchAll(
      /([A-Za-zÀ-ú][A-Za-zÀ-ú\s.'-]{2,40}?)\s+(\d+[.,]?\d*)\s*%/g
    )) {
      const region = match[1].trim()
      if (/distribui|região|region/i.test(bodyText.slice(Math.max(0, match.index - 80), match.index))) {
        pushRegion(region, Number(match[2].replace(',', '.')))
      }
    }
  }

  const deliveryByRegionText =
    regions.length > 0
      ? regions
          .map((r) => (r.pct != null ? `${r.region} ${r.pct}%` : r.region))
          .join(' · ')
      : null

  return { deliveryByRegion: regions, deliveryByRegionText }
}

function parseAdDetailFromBodyText(bodyText) {
  const { targetLocations, targetLocationsText } = parseTargetLocations(bodyText)
  const { deliveryByRegion, deliveryByRegionText } = parseDeliveryByRegion(bodyText)
  return {
    targetLocations,
    targetLocationsText,
    deliveryByRegion,
    deliveryByRegionText,
  }
}

function parseAdBlock(libraryAdId, block, statusHint) {
  const isActive =
    statusHint != null
      ? /^Ativo|^Active/i.test(statusHint)
      : /\bAtivo\b/i.test(block.slice(0, 120)) && !/\bInativo\b/i.test(block.slice(0, 80))

  const dateRangeMatch = block.match(
    /(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})(?:\s+a\s+(\d{1,2}\s+de\s+\w+\s+de\s+\d{4}))?/i
  )
  const startedRunningAt = dateRangeMatch ? parsePtDate(dateRangeMatch[1]) : null
  const endedRunningAt = dateRangeMatch?.[2] ? parsePtDate(dateRangeMatch[2]) : null

  const spendRaw = extractMetricLine(block, [
    'Valor gasto \\(BRL\\)',
    'Valor gasto',
    'Amount spent \\(BRL\\)',
    'Amount spent',
  ])
  const impressionsText = extractMetricLine(block, ['Impressões', 'Impressions'])
  const { spendText, spendMinBrl, spendMaxBrl } = parseSpendRange(spendRaw)

  const groupMatch = block.match(/(\d+)\s+anúncios usam esse criativo/i)
  const adsInGroup = groupMatch ? Number(groupMatch[1]) : null

  let pageName = null
  let adBody = null
  let payerName = null

  const detailIdx = block.search(/Ver detalhes do anúncio|See ad details|Ver resumo|See summary/i)
  const afterDetail = detailIdx >= 0 ? block.slice(detailIdx) : block
  const lines = afterDetail
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^Ver (detalhes|resumo)|^See (ad details|summary)/i.test(line)) continue
    if (/^Patrocinado|^Sponsored/i.test(line)) {
      const payerMatch = line.match(/Pago por\s+(.+)$/i) || line.match(/Paid for by\s+(.+)$/i)
      payerName = payerMatch?.[1]?.trim() ?? null
      if (i > 0 && !/^Plataformas|^Platforms|^Categorias|^Abrir menu|^WWW\.|^http/i.test(lines[i - 1])) {
        pageName = lines[i - 1]
      }
      const bodyLines = []
      for (let j = i + 1; j < lines.length; j++) {
        const bl = lines[j]
        if (/^\d+:\d+\s*\/\s*\d+:\d+$/.test(bl)) break
        if (/^WWW\.|^HTTP/i.test(bl)) break
        if (/^Saiba mais|^Learn more|^Shop now|^Inscrever-se|^Sign up/i.test(bl)) break
        if (/^Plataformas|^Platforms|^Categorias|^Impressões|^Impressions|^Valor gasto|^Amount spent/i.test(bl)) {
          break
        }
        bodyLines.push(bl)
      }
      adBody = bodyLines.join('\n').trim() || null
      break
    }
  }

  return {
    libraryAdId,
    pageName,
    payerName,
    adBody,
    libraryUrl: `https://www.facebook.com/ads/library/?id=${libraryAdId}`,
    isActive,
    startedRunningAt,
    endedRunningAt,
    spendText,
    spendMinBrl,
    spendMaxBrl,
    impressionsText,
    audienceSizeText: null,
    adsInGroup,
    targetLocations: [],
    targetLocationsText: null,
    deliveryByRegion: [],
    deliveryByRegionText: null,
  }
}

function parseAdsFromBodyTextStrict(bodyText) {
  const ads = []
  const seen = new Set()
  const re =
    /(Ativo|Inativo|Active|Inactive)\s*\n\s*(?:Identifica(?:ç|c)ão da biblioteca|Library ID):\s*(\d+)\s*\n([\s\S]*?)(?=\n(?:Ativo|Inativo|Active|Inactive)\s*\n\s*(?:Identifica(?:ç|c)ão da biblioteca|Library ID):|$)/gi

  let match
  while ((match = re.exec(bodyText)) !== null) {
    const libraryAdId = match[2]
    if (seen.has(libraryAdId)) continue
    seen.add(libraryAdId)
    ads.push(parseAdBlock(libraryAdId, match[3], match[1]))
    if (ads.length >= MAX_ADS_PER_ACTOR) break
  }
  return ads
}

function parseAdsFromBodyTextRelaxed(bodyText) {
  const ads = []
  const seen = new Set()
  const re =
    /(Ativo|Inativo|Active|Inactive)[\s\S]{0,120}?(?:Identifica(?:ç|c)ão da biblioteca|Library ID)[:\s]*(\d+)([\s\S]*?)(?=(?:Ativo|Inativo|Active|Inactive)[\s\S]{0,120}?(?:Identifica(?:ç|c)ão da biblioteca|Library ID)|$)/gi

  let match
  while ((match = re.exec(bodyText)) !== null) {
    const libraryAdId = match[2]
    if (seen.has(libraryAdId)) continue
    seen.add(libraryAdId)
    ads.push(parseAdBlock(libraryAdId, match[3], match[1]))
    if (ads.length >= MAX_ADS_PER_ACTOR) break
  }
  return ads
}

function parseAdsFromBodyTextByIds(bodyText) {
  const markers = []
  let match
  LIBRARY_ID_RE.lastIndex = 0
  while ((match = LIBRARY_ID_RE.exec(bodyText)) !== null) {
    markers.push({ index: match.index, id: match[1] })
  }
  if (markers.length === 0) return []

  const ads = []
  const seen = new Set()
  for (let i = 0; i < markers.length; i++) {
    const { index, id } = markers[i]
    if (seen.has(id)) continue
    seen.add(id)
    const end = markers[i + 1]?.index ?? bodyText.length
    const before = bodyText.slice(Math.max(0, index - 180), index)
    const block = bodyText.slice(index, end)
    const statusMatch = before.match(/(Ativo|Inativo|Active|Inactive)\s*$/i)
    ads.push(parseAdBlock(id, block, statusMatch?.[1] ?? null))
    if (ads.length >= MAX_ADS_PER_ACTOR) break
  }
  return ads
}

function mergeAdsByLibraryId(...lists) {
  const byId = new Map()
  for (const list of lists) {
    for (const ad of list) {
      const prev = byId.get(ad.libraryAdId)
      if (!prev) {
        byId.set(ad.libraryAdId, ad)
        continue
      }
      byId.set(ad.libraryAdId, {
        ...prev,
        pageName: prev.pageName || ad.pageName,
        pageId: prev.pageId || ad.pageId,
        payerName: prev.payerName || ad.payerName,
        adBody: prev.adBody || ad.adBody,
        isActive: prev.isActive ?? ad.isActive,
        startedRunningAt: prev.startedRunningAt || ad.startedRunningAt,
        endedRunningAt: prev.endedRunningAt || ad.endedRunningAt,
        spendText: prev.spendText || ad.spendText,
        spendMinBrl: prev.spendMinBrl ?? ad.spendMinBrl,
        spendMaxBrl: prev.spendMaxBrl ?? ad.spendMaxBrl,
        impressionsText: prev.impressionsText || ad.impressionsText,
        audienceSizeText: prev.audienceSizeText || ad.audienceSizeText,
        adsInGroup: prev.adsInGroup ?? ad.adsInGroup,
        platforms: prev.platforms || ad.platforms,
      })
    }
  }
  return [...byId.values()].slice(0, MAX_ADS_PER_ACTOR)
}

function parseAdsFromBodyText(bodyText) {
  const strict = parseAdsFromBodyTextStrict(bodyText)
  const relaxed = parseAdsFromBodyTextRelaxed(bodyText)
  const byIds = parseAdsFromBodyTextByIds(bodyText)
  return mergeAdsByLibraryId(strict, relaxed, byIds)
}

async function extractAdsFromDom(page) {
  return page.evaluate(() => {
    const results = []
    const seen = new Set()

    for (const link of document.querySelectorAll('a[href*="ads/library/?id="]')) {
      const href = link.href
      const idMatch = href.match(/[?&]id=(\d+)/)
      if (!idMatch) continue
      const libraryAdId = idMatch[1]
      if (seen.has(libraryAdId)) continue
      seen.add(libraryAdId)

      let card = link.closest('div[data-testid]') ?? link.parentElement
      for (let depth = 0; depth < 10 && card; depth++) {
        const text = card.innerText?.trim() ?? ''
        if (text.length > 120) break
        card = card.parentElement
      }
      const text = card?.innerText ?? link.innerText ?? ''
      const head = text.slice(0, 250)
      const isActive = /\bAtivo\b/i.test(head) || /\bActive\b/i.test(head)
      const isInactive = /\bInativo\b/i.test(head) || /\bInactive\b/i.test(head)

      results.push({
        libraryAdId,
        pageName: null,
        payerName: null,
        adBody: text.slice(0, 500) || null,
        libraryUrl: `https://www.facebook.com/ads/library/?id=${libraryAdId}`,
        isActive: isActive && !isInactive,
        startedRunningAt: null,
        endedRunningAt: null,
        spendText: null,
        spendMinBrl: null,
        spendMaxBrl: null,
        impressionsText: null,
        audienceSizeText: null,
        adsInGroup: null,
        targetLocations: [],
        targetLocationsText: null,
        deliveryByRegion: [],
        deliveryByRegionText: null,
      })
    }

    return results
  })
}

async function countVisibleLibraryIds(page) {
  try {
    return await page.evaluate(() => {
      const body = document.body
      if (!body) return 0
      const fromText = (body.innerText.match(/(?:Identifica(?:ç|c)ão da biblioteca|Library ID)[:\s]*\d+/gi) || [])
        .length
      const fromLinks = document.querySelectorAll('a[href*="ads/library/?id="]').length
      return Math.max(fromText, fromLinks)
    })
  } catch {
    return 0
  }
}

async function clickLoadMoreIfPresent(page) {
  const patterns = [/ver mais/i, /see more/i, /carregar mais/i, /load more/i, /mostrar mais/i]
  for (const pattern of patterns) {
    const btn = page.getByRole('button', { name: pattern })
    if (await btn.count()) {
      await btn.first().click({ timeout: 2500 }).catch(() => {})
      await page.waitForTimeout(900)
      return true
    }
  }
  return false
}

async function scrollResultsContainer(page) {
  try {
    await page.evaluate(() => {
      function safeScroll(el) {
        if (!el || typeof el.scrollHeight !== 'number') return false
        try {
          el.scrollTop = el.scrollHeight
          return true
        } catch {
          return false
        }
      }

      const candidates = [...document.querySelectorAll('div')].filter((el) => {
        if (!el?.isConnected) return false
        try {
          const style = window.getComputedStyle(el)
          const overflowY = style.overflowY
          return (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight + 80 &&
            el.clientHeight > 200
          )
        } catch {
          return false
        }
      })
      candidates.sort((a, b) => b.clientHeight - a.clientHeight)

      if (safeScroll(candidates[0])) return
      if (safeScroll(document.documentElement)) return

      const body = document.body
      if (body && typeof body.scrollHeight === 'number') {
        window.scrollTo(0, body.scrollHeight)
        return
      }
      window.scrollBy(0, 900)
    })
  } catch {
    // DOM incompleto ou página em transição — wheel no Playwright compensa
  }
}

async function scrollAdListing(page, searchTerm, graphqlCollector) {
  const maxScrolls = getMaxScrolls()
  const minScrolls = 4
  let prevCount = 0
  let stableRounds = 0

  for (let i = 0; i < maxScrolls; i++) {
    await clickLoadMoreIfPresent(page)
    await scrollResultsContainer(page)
    await page.mouse.wheel(0, 2200)
    await page.waitForTimeout(SCROLL_PAUSE_MS)

    const gqlCount = graphqlCollector.size()
    const domCount = await countVisibleLibraryIds(page)
    const count = Math.max(gqlCount, domCount)

    logProgress(
      `${searchTerm}: scroll ${i + 1}/${maxScrolls} — ${count} anúncio(s) (GraphQL ${gqlCount}, DOM ${domCount})`
    )

    if (count <= prevCount) stableRounds += 1
    else {
      stableRounds = 0
      prevCount = count
    }

    if (i + 1 >= minScrolls && stableRounds >= 2 && prevCount > 0) break
    if (i + 1 >= 8 && stableRounds >= 3 && prevCount === 0) break
  }

  logProgress(`${searchTerm}: scroll concluído — ${prevCount} anúncio(s) visíveis`)
}

async function runListingSearch(page, searchTerm, searchType, ctx, graphqlCollector) {
  const override = getSearchTypeOverride()
  const effectiveType = override ?? searchType
  const label =
    effectiveType === 'keyword_exact_phrase'
      ? `${searchTerm} (frase exata)`
      : searchTerm

  graphqlCollector.clear()

  await ctx.report({
    phase: 'listing',
    message: `Abrindo biblioteca — ${label}`,
  })

  const url = buildSearchUrl(searchTerm, { searchType: effectiveType })
  logProgress(`Buscando: ${label}`)
  const navStarted = Date.now()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
  await dismissCookieBanner(page)
  await page.waitForTimeout(LISTING_SETTLE_MS)

  await ctx.report({
    phase: 'listing',
    message: `${label}: rolando listagem…`,
  })

  await scrollAdListing(page, label, graphqlCollector)
  await page.waitForTimeout(800)

  const graphqlAds = graphqlCollector.getAds()
  const bodyText = await page.evaluate(() => document.body.innerText)
  const domAds = await extractAdsFromDom(page)
  const textAds = parseAdsFromBodyText(bodyText)
  const ads = mergeAdsByLibraryId(graphqlAds, domAds, textAds)

  logProgress(
    `${label}: ${ads.length} anúncio(s) em ${formatElapsed(Date.now() - navStarted)} ` +
      `(${graphqlAds.length} GraphQL · ${domAds.length} DOM · ${textAds.length} texto)`
  )

  await ctx.report({
    phase: 'listing',
    message: `${label}: ${ads.length} anúncio(s) encontrados`,
    adsFound: ads.length,
  })

  return ads
}

async function dismissCookieBanner(page) {
  for (const label of ['Permitir todos os cookies', 'Allow all cookies', 'Aceitar', 'Accept']) {
    const btn = page.getByRole('button', { name: label })
    if (await btn.count()) {
      await btn.first().click({ timeout: 3000 }).catch(() => {})
      break
    }
  }
}

function adNeedsGeoDetail(ad) {
  return !(ad.targetLocations?.length || ad.deliveryByRegion?.length)
}

async function clickIfVisible(page, pattern) {
  const locators = [
    page.getByRole('button', { name: pattern }),
    page.getByRole('link', { name: pattern }),
    page.locator('[role="button"]').filter({ hasText: pattern }),
    page.locator('[role="tab"]').filter({ hasText: pattern }),
  ]
  for (const locator of locators) {
    if (await locator.count()) {
      await locator.first().click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(900)
      return true
    }
  }
  return false
}

async function expandAdDetailSections(page) {
  const patterns = [
    /Ver detalhes do anúncio/i,
    /See ad details/i,
    /Detalhes do anúncio/i,
    /Ad details/i,
    /Público do anúncio/i,
    /Ad audience/i,
    /Veiculação do anúncio/i,
    /Ad delivery/i,
    /Transparência por localização/i,
    /Transparency by location/i,
    /Ver resumo/i,
    /See summary/i,
  ]
  for (const pattern of patterns) {
    await clickIfVisible(page, pattern)
  }
}

async function extractGeoFromDom(page) {
  return page.evaluate(() => {
    function norm(text) {
      return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
    }
    function cleanLoc(raw) {
      return norm(raw)
        .replace(/,\s*brasil\s*$/i, '')
        .replace(/,\s*brazil\s*$/i, '')
        .trim()
    }

    const TYPE_RE =
      /^(estado|cidade|state|city|região|regiao|region|país|pais|country|condado|county|bairro|neighborhood|dma)$/i
    const INCL_RE = /^(inclu[íi]da?|exclu[íi]da?|included|excluded)$/i
    const targetLocations = []
    const seen = new Set()

    function push(name, excluded) {
      const cleaned = cleanLoc(name)
      if (cleaned.length < 2) return
      const key = `${excluded ? '!' : ''}${cleaned.toLowerCase()}`
      if (seen.has(key)) return
      seen.add(key)
      targetLocations.push({ name: cleaned, excluded })
    }

    for (const table of document.querySelectorAll('table')) {
      for (const row of table.querySelectorAll('tr')) {
        const cells = [...row.querySelectorAll('td')].map((cell) => norm(cell.innerText))
        if (cells.length < 3) continue
        if (!TYPE_RE.test(cells[1]) || !INCL_RE.test(cells[2])) continue
        push(cells[0], /exclu/i.test(cells[2]))
      }
    }

    for (const row of document.querySelectorAll('[role="row"]')) {
      const cells = [...row.querySelectorAll('[role="cell"], [role="gridcell"], td, th')]
        .map((cell) => norm(cell.innerText))
        .filter(Boolean)
      if (cells.length < 3) continue
      if (!TYPE_RE.test(cells[1]) || !INCL_RE.test(cells[2])) continue
      push(cells[0], /exclu/i.test(cells[2]))
    }

    return { targetLocations, deliveryByRegion: [] }
  })
}

function mergeGeoResults(...sources) {
  const targetLocations = []
  const deliveryByRegion = []
  const seenLoc = new Set()
  const seenDel = new Set()

  for (const source of sources) {
    for (const loc of source.targetLocations ?? []) {
      const key = `${loc.excluded ? '!' : ''}${loc.name.toLowerCase()}`
      if (seenLoc.has(key)) continue
      seenLoc.add(key)
      targetLocations.push(loc)
    }
    for (const region of source.deliveryByRegion ?? []) {
      const key = region.region.toLowerCase()
      if (seenDel.has(key)) continue
      seenDel.add(key)
      deliveryByRegion.push(region)
    }
  }

  const targetLocationsText =
    targetLocations.length > 0
      ? targetLocations.map((loc) => (loc.excluded ? `exc. ${loc.name}` : loc.name)).join(' · ')
      : null
  const deliveryByRegionText =
    deliveryByRegion.length > 0
      ? deliveryByRegion
          .map((r) => (r.pct != null ? `${r.region} ${r.pct}%` : r.region))
          .join(' · ')
      : null

  return { targetLocations, targetLocationsText, deliveryByRegion, deliveryByRegionText }
}

async function scrapeAdDetail(page, libraryAdId) {
  const url = `https://www.facebook.com/ads/library/?id=${libraryAdId}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DETAIL_TIMEOUT_MS })
  await dismissCookieBanner(page)
  await page.waitForTimeout(2500)
  await expandAdDetailSections(page)
  await page.waitForTimeout(1200)
  await expandAdDetailSections(page)

  const domGeo = await extractGeoFromDom(page)
  const bodyText = await page.evaluate(() => document.body.innerText)
  const textGeo = parseAdDetailFromBodyText(bodyText)
  return mergeGeoResults(domGeo, textGeo)
}

async function enrichAdsWithDetails(page, ads, actorName, ctx) {
  if (SKIP_GEO_DETAILS) {
    logProgress(`${actorName}: detalhes geográficos desativados (META_ADS_SKIP_DETAILS)`)
    return ads
  }

  const pending = [...ads]
    .sort((a, b) => Number(b.isActive) - Number(a.isActive))
    .filter(adNeedsGeoDetail)
    .slice(0, MAX_AD_DETAILS)

  if (pending.length === 0) {
    logProgress(`${actorName}: segmentação/alcançe já extraídos da listagem`)
    return ads
  }

  logProgress(`${actorName}: buscando detalhes geográficos de ${pending.length} anúncio(s)`)
  await ctx.report({
    phase: 'geo',
    message: `${actorName}: abrindo detalhes de ${pending.length} anúncio(s) para localização`,
    adIndex: 0,
    adTotal: pending.length,
  })

  for (let i = 0; i < pending.length; i++) {
    const ad = pending[i]
    await ctx.report({
      phase: 'geo',
      message: `${actorName}: consultando localização — anúncio ${i + 1}/${pending.length}`,
      adIndex: i + 1,
      adTotal: pending.length,
    })
    try {
      const detail = await scrapeAdDetail(page, ad.libraryAdId)
      const merged = mergeGeoResults(
        {
          targetLocations: ad.targetLocations ?? [],
          targetLocationsText: ad.targetLocationsText,
          deliveryByRegion: ad.deliveryByRegion ?? [],
          deliveryByRegionText: ad.deliveryByRegionText,
        },
        detail
      )
      ad.targetLocations = merged.targetLocations
      ad.targetLocationsText = merged.targetLocationsText
      ad.deliveryByRegion = merged.deliveryByRegion
      ad.deliveryByRegionText = merged.deliveryByRegionText

      if (merged.targetLocations?.length || merged.deliveryByRegion?.length) {
        logProgress(
          `${actorName}: geo ad ${ad.libraryAdId} — ${merged.targetLocationsText || merged.deliveryByRegionText}`
        )
      } else {
        logProgress(`${actorName}: geo ad ${ad.libraryAdId} — sem localização na página de detalhes`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logProgress(`${actorName}: detalhe ${ad.libraryAdId} falhou — ${msg}`)
    }
    if (i < pending.length - 1) await sleep(DETAIL_PAUSE_MS)
  }

  return ads
}

async function scrapeAdsForTerm(page, searchTerm, ctx, graphqlCollector) {
  const override = getSearchTypeOverride()
  const words = searchTerm.trim().split(/\s+/).filter(Boolean)

  let ads
  if (override === 'keyword_exact_phrase') {
    ads = await runListingSearch(page, searchTerm, 'keyword_exact_phrase', ctx, graphqlCollector)
  } else if (override === 'keyword_unordered') {
    ads = await runListingSearch(page, searchTerm, 'keyword_unordered', ctx, graphqlCollector)
  } else {
    ads = await runListingSearch(page, searchTerm, 'keyword_unordered', ctx, graphqlCollector)

    const tryExact =
      words.length >= 2 &&
      (isDualSearchEnabled() || ads.length < 8)

    if (tryExact) {
      logProgress(
        `${searchTerm}: segunda busca (frase exata) — ${isDualSearchEnabled() ? 'META_ADS_DUAL_SEARCH' : `só ${ads.length} na 1ª passagem`}`
      )
      await sleep(800)
      const exactAds = await runListingSearch(
        page,
        searchTerm,
        'keyword_exact_phrase',
        ctx,
        graphqlCollector
      )
      ads = mergeAdsByLibraryId(ads, exactAds)
      logProgress(`${searchTerm}: total após merge — ${ads.length} anúncio(s)`)
    }
  }

  if (SKIP_GEO_DETAILS) return ads
  return enrichAdsWithDetails(page, ads, searchTerm, ctx)
}

async function loadActiveActors(supabase, politicoSlug) {
  let query = supabase
    .from('political_actors')
    .select('id, name, slug, actor_type, active')
    .eq('active', true)
    .order('name', { ascending: true })

  if (politicoSlug) query = query.eq('slug', politicoSlug)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

async function upsertAds(supabase, politicoId, searchTerm, ads) {
  if (ads.length === 0) return { inserted: 0, updated: 0 }

  const ids = ads.map((a) => a.libraryAdId)
  const { data: existing } = await supabase
    .from('meta_ads_mentions')
    .select(
      'library_ad_id, target_locations, target_locations_text, delivery_by_region, delivery_by_region_text'
    )
    .eq('politico_id', politicoId)
    .in('library_ad_id', ids)

  const existingSet = new Set((existing ?? []).map((r) => r.library_ad_id))
  const existingGeoById = new Map((existing ?? []).map((r) => [r.library_ad_id, r]))
  const collectedAt = new Date().toISOString()

  const rows = ads.map((ad) => {
    const prev = existingGeoById.get(ad.libraryAdId)
    const targetLocations =
      ad.targetLocations?.length ? ad.targetLocations : prev?.target_locations ?? null
    const targetLocationsText = ad.targetLocationsText ?? prev?.target_locations_text ?? null
    const deliveryByRegion =
      ad.deliveryByRegion?.length ? ad.deliveryByRegion : prev?.delivery_by_region ?? null
    const deliveryByRegionText = ad.deliveryByRegionText ?? prev?.delivery_by_region_text ?? null

    return {
      politico_id: politicoId,
      search_term: searchTerm,
      library_ad_id: ad.libraryAdId,
      page_name: ad.pageName,
      payer_name: ad.payerName,
      ad_body: ad.adBody,
      library_url: ad.libraryUrl,
      platforms: null,
      started_running_at: ad.startedRunningAt,
      ended_running_at: ad.endedRunningAt,
      is_active: ad.isActive,
      spend_text: ad.spendText,
      spend_min_brl: ad.spendMinBrl,
      spend_max_brl: ad.spendMaxBrl,
      impressions_text: ad.impressionsText,
      audience_size_text: ad.audienceSizeText,
      ads_in_group: ad.adsInGroup,
      target_locations_text: targetLocationsText,
      target_locations: targetLocations,
      delivery_by_region_text: deliveryByRegionText,
      delivery_by_region: deliveryByRegion,
      collected_at: collectedAt,
    }
  })

  const { error } = await supabase.from('meta_ads_mentions').upsert(rows, {
    onConflict: 'politico_id,library_ad_id',
  })
  if (error) {
    if (error.message.includes('target_locations') || error.message.includes('delivery_by_region')) {
      throw new Error(
        'Colunas de segmentação ausentes. Execute database/alter-meta-ads-mentions-targeting.sql no Supabase.'
      )
    }
    throw new Error(error.message)
  }

  let inserted = 0
  let updated = 0
  for (const ad of ads) {
    if (existingSet.has(ad.libraryAdId)) updated += 1
    else inserted += 1
  }
  return { inserted, updated }
}

async function main() {
  loadEnvLocal()
  const { politicoSlug } = parseArgs()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    emit({ ok: false, error: 'NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.' })
    process.exit(1)
  }

  const supabase = createSupabase(url, key, { auth: { persistSession: false } })
  const logId = process.env.META_ADS_COLLECT_LOG_ID ?? null
  const report = createProgressReporter(supabase, logId)

  let actors
  try {
    actors = await loadActiveActors(supabase, politicoSlug)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('does not exist') || msg.includes('42P01')) {
      emit({
        ok: false,
        error:
          'Tabelas meta_ads ausentes. Execute database/create-meta-ads-radar-tables.sql no Supabase.',
      })
      process.exit(1)
    }
    emit({ ok: false, error: msg })
    process.exit(1)
  }

  if (actors.length === 0) {
    emit({ ok: false, error: 'Nenhum candidato ativo para coletar.' })
    process.exit(1)
  }

  const estSecPerActor = SKIP_GEO_DETAILS ? 18 : 90
  logProgress(
    `${actors.length} candidato(s) ativo(s) · modo ${SKIP_GEO_DETAILS ? 'rápido (sem geo)' : 'com detalhes geo'} · ` +
      `estimativa ~${Math.max(1, Math.ceil((actors.length * estSecPerActor) / 60))} min`
  )

  const results = []
  let browser
  const collectStarted = Date.now()

  try {
    await report({
      phase: 'browser',
      message: SKIP_GEO_DETAILS
        ? 'Abrindo biblioteca da Meta (modo rápido, sem localização)…'
        : 'Abrindo navegador automatizado (Playwright)…',
      actorTotal: actors.length,
    })
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    })
    const context = await browser.newContext({
      locale: 'pt-BR',
      userAgent: CHROME_UA,
      viewport: { width: 1280, height: 900 },
    })
    const page = await context.newPage()
    const graphqlCollector = createGraphqlAdCollector()
    graphqlCollector.attachToPage(page)

    for (let i = 0; i < actors.length; i++) {
      const actor = actors[i]
      const ctx = {
        actorIndex: i + 1,
        actorTotal: actors.length,
        actorName: actor.name,
        report: async (patch) =>
          report({
            actorIndex: i + 1,
            actorTotal: actors.length,
            actorName: actor.name,
            ...patch,
          }),
      }
      const result = {
        politicoId: actor.id,
        politicoName: actor.name,
        adsFound: 0,
        adsInserted: 0,
        adsUpdated: 0,
        errors: [],
      }

      try {
        const actorStarted = Date.now()
        logProgress(`Candidato ${i + 1}/${actors.length}: ${actor.name}`)
        await ctx.report({
          phase: 'listing',
          message: `Candidato ${i + 1}/${actors.length}: ${actor.name}`,
        })
        const ads = await scrapeAdsForTerm(page, actor.name, ctx, graphqlCollector)
        result.adsFound = ads.length
        await ctx.report({
          phase: 'upsert',
          message: `${actor.name}: salvando ${ads.length} anúncio(s) no banco…`,
          adsFound: ads.length,
        })
        const { inserted, updated } = await upsertAds(supabase, actor.id, actor.name, ads)
        result.adsInserted = inserted
        result.adsUpdated = updated
        logProgress(
          `${actor.name}: concluído em ${formatElapsed(Date.now() - actorStarted)} — ` +
            `${ads.length} anúncios (${inserted} novos, ${updated} atualizados)`
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido'
        result.errors.push(msg)
        logProgress(`${actor.name}: ERRO — ${msg}`)
      }

      results.push(result)
      if (i < actors.length - 1) await sleep(PAUSE_BETWEEN_ACTORS_MS)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/Executable doesn't exist|playwright install/i.test(msg)) {
      emit({
        ok: false,
        error:
          'Chromium do Playwright não instalado. Rode: npx playwright install chromium',
      })
      process.exit(1)
    }
    emit({ ok: false, error: msg })
    process.exit(1)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }

  const totals = results.reduce(
    (acc, r) => {
      acc.adsFound += r.adsFound
      acc.adsInserted += r.adsInserted
      acc.adsUpdated += r.adsUpdated
      acc.errors.push(...r.errors)
      return acc
    },
    { adsFound: 0, adsInserted: 0, adsUpdated: 0, errors: [] }
  )

  emit({ ok: true, results, totals })
  logProgress(`Coleta total: ${formatElapsed(Date.now() - collectStarted)} — ${totals.adsFound} anúncios`)
}

main().catch((e) => {
  emit({ ok: false, error: e instanceof Error ? e.message : String(e) })
  process.exit(1)
})
