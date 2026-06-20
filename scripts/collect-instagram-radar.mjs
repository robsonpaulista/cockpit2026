#!/usr/bin/env node
/**
 * Coleta Instagram (Apify) → Supabase — apenas concorrentes.
 * Candidato próprio (Jadyel / own_candidate) usa Graph API em lib/instagram-radar-own-sync.ts
 *
 * Uso:
 *   node scripts/collect-instagram-radar.mjs
 *   node scripts/collect-instagram-radar.mjs --slug jadyel-alencar
 *
 * Env:
 *   APIFY_TOKEN
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   INSTAGRAM_RADAR_MAX_ACTORS (default 10)
 *   INSTAGRAM_RADAR_POSTS_LIMIT (default 12)
 *   INSTAGRAM_RADAR_MAX_CHARGE_USD (default 0.25)
 *   INSTAGRAM_RADAR_POSTS_WINDOW (default "30 days")
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient as createSupabase } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const APIFY_ACTOR = 'apify~instagram-scraper'
const POST_USD_PER_1000 = 1.5

function loadEnvFile() {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(ROOT, name)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  }
}

loadEnvFile()

function envInt(key, fallback, max) {
  const raw = process.env[key]?.trim()
  const n = raw ? Number(raw) : fallback
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, Math.floor(n))
}

function envFloat(key, fallback, max) {
  const raw = process.env[key]?.trim()
  const n = raw ? Number(raw) : fallback
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, n)
}

const MAX_ACTORS = envInt('INSTAGRAM_RADAR_MAX_ACTORS', 10, 25)
const POSTS_LIMIT = envInt('INSTAGRAM_RADAR_POSTS_LIMIT', 12, 30)
const MAX_CHARGE_USD = envFloat('INSTAGRAM_RADAR_MAX_CHARGE_USD', 0.25, 2)
const POSTS_WINDOW = process.env.INSTAGRAM_RADAR_POSTS_WINDOW?.trim() || '30 days'

function logProgress(message) {
  console.error(`[instagram-radar] ${message}`)
}

function normalizeUsername(raw) {
  if (!raw?.trim()) return null
  let h = raw.trim()
  if (h.startsWith('@')) h = h.slice(1)
  if (h.includes('instagram.com/')) {
    try {
      const url = h.startsWith('http') ? h : `https://${h}`
      h = new URL(url).pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? h
    } catch {
      /* ignore */
    }
  }
  h = (h.split('?')[0]?.split('/')[0] ?? h).toLowerCase().replace(/[^a-z0-9._]/g, '')
  return h.length >= 1 ? h : null
}

function parseArgs() {
  const args = process.argv.slice(2)
  let slug = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slug' && args[i + 1]) slug = args[++i]
  }
  return { slug }
}

function mapPostType(type) {
  if (!type) return null
  const t = String(type).toLowerCase()
  if (t.includes('reel')) return 'reel'
  if (t.includes('carousel') || t.includes('sidecar')) return 'carousel'
  if (t.includes('video')) return 'video'
  if (t.includes('image')) return 'image'
  return String(type)
}

function parseApifyItem(item) {
  const postId = item.shortCode || item.id || item.postId
  if (!postId) return null

  const url = item.url || item.inputUrl || (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : null)
  if (!url) return null

  const owner = normalizeUsername(item.ownerUsername || item.username)
  const likes = Number(item.likesCount ?? item.likes ?? 0) || 0
  const comments = Number(item.commentsCount ?? item.comments ?? 0) || 0

  return {
    post_id: String(postId),
    instagram_username: owner,
    posted_at: item.timestamp || item.takenAt || null,
    post_type: mapPostType(item.type || item.productType),
    caption: item.caption ?? item.text ?? null,
    likes_count: likes,
    comments_count: comments,
    post_url: url,
    thumbnail_url: item.displayUrl || item.thumbnailUrl || null,
  }
}

async function startApifyRun(token, directUrls) {
  const input = {
    directUrls,
    resultsType: 'posts',
    resultsLimit: POSTS_LIMIT,
    onlyPostsNewerThan: POSTS_WINDOW,
  }

  const qs = new URLSearchParams({
    token,
    waitForFinish: '600',
    maxTotalChargeUsd: String(MAX_CHARGE_USD),
  })

  const res = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Apify run failed (${res.status}): ${err.slice(0, 400)}`)
  }

  const run = await res.json()
  const data = run.data ?? run
  if (data.status === 'FAILED' || data.status === 'ABORTED') {
    throw new Error(`Apify run ${data.status}: ${data.statusMessage ?? 'unknown'}`)
  }
  return data
}

async function fetchDatasetItems(token, datasetId) {
  const items = []
  let offset = 0
  const limit = 250

  for (;;) {
    const qs = new URLSearchParams({ token, offset: String(offset), limit: String(limit), clean: 'true' })
    const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?${qs}`)
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Apify dataset fetch failed: ${err.slice(0, 300)}`)
    }
    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    items.push(...batch)
    if (batch.length < limit) break
    offset += batch.length
    if (items.length > MAX_ACTORS * POSTS_LIMIT * 2) break
  }

  return items
}

async function main() {
  const token = process.env.APIFY_TOKEN?.trim()
  if (!token) {
    throw new Error('APIFY_TOKEN não configurado. Crie em https://console.apify.com/account/integrations')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
  }

  const supabase = createSupabase(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  const { slug } = parseArgs()

  let query = supabase
    .from('political_actors')
    .select('id, name, slug, instagram_username, active, actor_type')
    .eq('active', true)
    .neq('actor_type', 'own_candidate')
    .not('instagram_username', 'is', null)
    .order('name')

  if (slug) query = query.eq('slug', slug)

  const { data: actors, error: actorsErr } = await query
  if (actorsErr) {
    if (actorsErr.message.includes('instagram_username') || actorsErr.code === '42703') {
      throw new Error(
        'Coluna instagram_username ausente. Execute database/create-instagram-radar-tables.sql no Supabase.'
      )
    }
    throw new Error(actorsErr.message)
  }

  const prepared = (actors ?? [])
    .map((a) => ({
      ...a,
      username: normalizeUsername(a.instagram_username),
    }))
    .filter((a) => a.username)

  if (prepared.length === 0) {
    console.log(JSON.stringify({
      results: [],
      totals: {
        actorsProcessed: 0,
        postsFound: 0,
        postsInserted: 0,
        postsUpdated: 0,
        estimatedCostUsd: 0,
        apifyRunId: null,
        ownCandidateSynced: 0,
        errors: slug
          ? [`Nenhum concorrente com @ para slug "${slug}" (candidato próprio usa API Graph).`]
          : ['Nenhum concorrente ativo com @ Instagram — Apify não executado.'],
      },
    }))
    return
  }

  const capped = prepared.slice(0, MAX_ACTORS)
  if (prepared.length > MAX_ACTORS) {
    logProgress(`Limitando a ${MAX_ACTORS} perfis (INSTAGRAM_RADAR_MAX_ACTORS). ${prepared.length - MAX_ACTORS} ignorados.`)
  }

  const directUrls = capped.map((a) => `https://www.instagram.com/${a.username}/`)
  const expectedPosts = capped.length * POSTS_LIMIT
  const estimatedCost = (expectedPosts / 1000) * POST_USD_PER_1000

  logProgress(
    `${capped.length} perfis × ${POSTS_LIMIT} posts · teto US$ ${MAX_CHARGE_USD} · estimativa ~US$ ${estimatedCost.toFixed(3)}`
  )

  const run = await startApifyRun(token, directUrls)
  const runId = run.id
  const datasetId = run.defaultDatasetId
  logProgress(`Apify run ${runId} concluído · dataset ${datasetId}`)

  const rawItems = await fetchDatasetItems(token, datasetId)
  logProgress(`${rawItems.length} itens no dataset Apify`)

  const usernameToActor = new Map(capped.map((a) => [a.username, a]))
  const results = []
  const totals = {
    actorsProcessed: capped.length,
    postsFound: 0,
    postsInserted: 0,
    postsUpdated: 0,
    estimatedCostUsd: Math.round(((rawItems.length / 1000) * POST_USD_PER_1000) * 10000) / 10000,
    apifyRunId: runId,
    ownCandidateSynced: 0,
    errors: [],
  }

  const byActorSlug = new Map()

  for (const item of rawItems) {
    const parsed = parseApifyItem(item)
    if (!parsed) continue

    let actor = parsed.instagram_username ? usernameToActor.get(parsed.instagram_username) : null
    if (!actor) {
      const inputUrl = item.inputUrl || item.inputURL
      if (inputUrl) {
        const fromUrl = normalizeUsername(inputUrl.split('instagram.com/')[1])
        if (fromUrl) actor = usernameToActor.get(fromUrl)
      }
    }
    if (!actor) continue

    const row = {
      politico_id: actor.id,
      instagram_username: actor.username,
      post_id: parsed.post_id,
      posted_at: parsed.posted_at,
      post_type: parsed.post_type,
      caption: parsed.caption,
      likes_count: parsed.likes_count,
      comments_count: parsed.comments_count,
      post_url: parsed.post_url,
      thumbnail_url: parsed.thumbnail_url,
      collected_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from('instagram_radar_posts')
      .select('id')
      .eq('politico_id', actor.id)
      .eq('post_id', parsed.post_id)
      .maybeSingle()

    if (existing?.id) {
      const { error: upErr } = await supabase.from('instagram_radar_posts').update(row).eq('id', existing.id)
      if (upErr) totals.errors.push(`${actor.slug}: ${upErr.message}`)
      else totals.postsUpdated += 1
    } else {
      const { error: insErr } = await supabase.from('instagram_radar_posts').insert(row)
      if (insErr) totals.errors.push(`${actor.slug}: ${insErr.message}`)
      else totals.postsInserted += 1
    }

    totals.postsFound += 1
    const acc = byActorSlug.get(actor.slug) ?? { found: 0, inserted: 0, updated: 0 }
    acc.found += 1
    if (existing?.id) acc.updated += 1
    else acc.inserted += 1
    byActorSlug.set(actor.slug, acc)
  }

  for (const a of capped) {
    const acc = byActorSlug.get(a.slug) ?? { found: 0, inserted: 0, updated: 0 }
    results.push({
      slug: a.slug,
      username: a.username,
      postsFound: acc.found,
      postsInserted: acc.inserted,
      postsUpdated: acc.updated,
      source: 'apify',
    })
    if (acc.found === 0) {
      totals.errors.push(`${a.slug} (@${a.username}): nenhum post retornado — perfil privado ou indisponível?`)
    }
  }

  console.log(JSON.stringify({ results, totals }))
}

main().catch((e) => {
  console.error('[instagram-radar]', e instanceof Error ? e.message : e)
  process.exit(1)
})
