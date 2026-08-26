#!/usr/bin/env node
/**
 * Coleta Instagram (Apify) → Supabase — apenas concorrentes.
 * Candidato próprio (Jadyel / own_candidate) usa Graph API em lib/instagram-radar-own-sync.ts
 *
 * Fluxo Apify:
 *   1) resultsType "details" → foto de perfil → remove fundo → PNG #F3F4F4 → Storage `instagram-avatars`
 *   2) resultsType "posts" → posts públicos
 *   3) resultsType "comments" → comentários (contas únicas) nos posts mais engajados
 *
 * Uso:
 *   node scripts/collect-instagram-radar.mjs
 *   node scripts/collect-instagram-radar.mjs --slug jadyel-alencar
 *   npm run instagram:avatars:reprocess   # só reprocessa avatares já salvos
 *
 * Env:
 *   APIFY_TOKEN + APIFY_TOKEN3..5  (split; TOKEN2 desativado — limite mensal)
 *   APIFY_TOKENS_DISABLED=2       (opcional; default 2)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   INSTAGRAM_RADAR_MAX_ACTORS (default 10)
 *   INSTAGRAM_RADAR_POSTS_LIMIT (default 12)
 *   INSTAGRAM_RADAR_MAX_CHARGE_USD (default 0.25)
 *   INSTAGRAM_RADAR_POSTS_WINDOW (default "30 days")
 *   INSTAGRAM_RADAR_COLLECT_COMMENTS (default 1)
 *   INSTAGRAM_RADAR_COMMENTS_LIMIT (default 20 / post)
 *   INSTAGRAM_RADAR_COMMENTS_MAX_POSTS (default 8 / perfil)
 *   INSTAGRAM_RADAR_COMMENTS_MAX_CHARGE_USD (default 1.5)
 *   INSTAGRAM_RADAR_SKIP_COMMENTS_COOLDOWN=1  (força comentários mesmo < 7 dias)
 *   INSTAGRAM_AVATAR_SKIP_BG=1  (pula remoção de fundo IA; só redimensiona)
 *
 * Schema: database/create-instagram-radar-tables.sql
 *         database/create-instagram-radar-comments-table.sql
 *         database/add-instagram-radar-comments-collect-state.sql
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createSupabaseClient as createSupabase } from './lib/supabase-client.mjs'
import { persistInstagramAvatarFromUrl } from './lib/instagram-avatar-storage.mjs'

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
const COMMENT_USD_PER_1000 = 2.3
const COMMENTS_LIMIT = envInt('INSTAGRAM_RADAR_COMMENTS_LIMIT', 20, 100)
const COMMENTS_MAX_POSTS = envInt('INSTAGRAM_RADAR_COMMENTS_MAX_POSTS', 8, 20)
const COMMENTS_MAX_CHARGE_USD = envFloat('INSTAGRAM_RADAR_COMMENTS_MAX_CHARGE_USD', 1.5, 5)
const COMMENTS_BATCH_SIZE = 16
const COLLECT_COMMENTS = (() => {
  const raw = process.env.INSTAGRAM_RADAR_COLLECT_COMMENTS?.trim().toLowerCase()
  if (!raw) return true
  return !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off')
})()
const COMMENTS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const COMMENTS_COOLDOWN_ENABLED = (() => {
  const skip = process.env.INSTAGRAM_RADAR_SKIP_COMMENTS_COOLDOWN?.trim().toLowerCase()
  return !(skip === '1' || skip === 'true' || skip === 'yes')
})()

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
  if (t.includes('reel') || t === 'clips') return 'reel'
  if (t.includes('carousel') || t.includes('sidecar')) return 'carousel'
  if (t.includes('video')) return 'video'
  if (t.includes('image') || t === 'photo') return 'image'
  return String(type)
}

/** Classifica formato Apify com type/productType/URL (reels costumam vir como Video + clips). */
function inferApifyPostType(item, url) {
  const product = String(item.productType || item.product_type || '').toLowerCase()
  const type = String(item.type || '').toLowerCase()
  const href = String(url || '').toLowerCase()

  if (href.includes('/reel/') || product === 'clips' || product.includes('reel') || type.includes('reel')) {
    return 'reel'
  }
  if (type.includes('sidecar') || type.includes('carousel') || product.includes('carousel')) {
    return 'carousel'
  }
  if (type.includes('video')) return 'video'
  if (type.includes('image') || type === 'photo') return 'image'
  return mapPostType(item.type || item.productType)
}

function parseApifyItem(item) {
  const postId = item.shortCode || item.id || item.postId
  if (!postId) return null

  const url =
    item.url ||
    item.inputUrl ||
    (item.shortCode
      ? `https://www.instagram.com/${String(item.productType || '').toLowerCase() === 'clips' ? 'reel' : 'p'}/${item.shortCode}/`
      : null)
  if (!url) return null

  const owner = normalizeUsername(item.ownerUsername || item.username)
  const likes = Number(item.likesCount ?? item.likes ?? 0) || 0
  const comments = Number(item.commentsCount ?? item.comments ?? 0) || 0
  const views =
    Number(
      item.videoViewCount ??
        item.videoPlayCount ??
        item.playCount ??
        item.video_view_count ??
        item.video_play_count ??
        0,
    ) || 0

  return {
    post_id: String(postId),
    instagram_username: owner,
    posted_at: item.timestamp || item.takenAt || null,
    post_type: inferApifyPostType(item, url),
    caption: item.caption ?? item.text ?? null,
    likes_count: likes,
    comments_count: comments,
    views_count: views,
    post_url: url,
    thumbnail_url: item.displayUrl || item.thumbnailUrl || item.imageUrl || item.images?.[0] || null,
  }
}

async function startApifyRun(token, directUrls, { resultsType, resultsLimit, onlyPostsNewerThan, maxChargeUsd }) {
  const input = {
    directUrls,
    resultsType,
    resultsLimit,
  }
  if (onlyPostsNewerThan) input.onlyPostsNewerThan = onlyPostsNewerThan

  const qs = new URLSearchParams({
    token,
    waitForFinish: '600',
    maxTotalChargeUsd: String(maxChargeUsd),
  })

  const res = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Coleta Apify (${resultsType}) falhou (${res.status}): ${err.slice(0, 400)}`)
  }

  const run = await res.json()
  const data = run.data ?? run
  if (data.status === 'FAILED' || data.status === 'ABORTED') {
    throw new Error(`Coleta Apify (${resultsType}) ${data.status}: ${data.statusMessage ?? 'unknown'}`)
  }
  return data
}

function parseProfileDetail(item) {
  const username = normalizeUsername(
    item.username || item.ownerUsername || (item.inputUrl ? item.inputUrl.split('instagram.com/')[1] : null),
  )
  const pic = item.profilePicUrlHD || item.profilePicUrl || null
  if (!username || !pic) return null
  return { username, profilePicUrl: String(pic) }
}

async function syncAvatarsFromDetails(supabase, token, capped, usernameToActor, totals) {
  if (capped.length === 0) return

  const directUrls = capped.map((a) => `https://www.instagram.com/${a.username}/`)
  const detailsCharge = Math.min(0.08, MAX_CHARGE_USD)

  logProgress(`Avatares: ${capped.length} perfis · details · teto US$ ${detailsCharge}`)

  try {
    const run = await startApifyRun(token, directUrls, {
      resultsType: 'details',
      resultsLimit: 1,
      maxChargeUsd: detailsCharge,
    })
    const datasetId = run.defaultDatasetId
    const items = await fetchDatasetItems(token, datasetId)
    totals.estimatedCostUsd =
      Math.round((totals.estimatedCostUsd + (items.length / 1000) * POST_USD_PER_1000) * 10000) / 10000
    if (run.id) {
      totals.apifyDetailsRunId = totals.apifyDetailsRunId
        ? `${totals.apifyDetailsRunId},${run.id}`
        : run.id
    }

    let saved = 0
    for (const item of items) {
      const parsed = parseProfileDetail(item)
      if (!parsed) continue
      const actor = usernameToActor.get(parsed.username)
      if (!actor) continue
      try {
        await persistInstagramAvatarFromUrl(supabase, {
          actorId: actor.id,
          slug: actor.slug,
          imageUrl: parsed.profilePicUrl,
        })
        saved += 1
      } catch (err) {
        totals.errors.push(
          `${actor.slug}: avatar — ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
    totals.avatarsUpdated = (totals.avatarsUpdated ?? 0) + saved
    logProgress(`Avatares salvos: ${saved}/${capped.length}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    totals.errors.push(`Avatares (details): ${msg}`)
    logProgress(`Avatares falhou (posts seguem): ${msg}`)
  }
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
      throw new Error(`Falha ao buscar posts de concorrentes: ${err.slice(0, 300)}`)
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

/**
 * Tokens ativos para split (rateio).
 * Conta 1 (APIFY_TOKEN / Robson) ativa.
 * Conta 2 (APIFY_TOKEN2) fora — hard limit mensal excedido (403).
 * Ordem: TOKEN → TOKEN3 → TOKEN4 → TOKEN5.
 */
function resolveApifyTokens() {
  const tokens = []
  const disabled = new Set(
    String(process.env.APIFY_TOKENS_DISABLED || '2')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )

  const primary = process.env.APIFY_TOKEN?.trim() || null
  if (primary && !disabled.has('1')) {
    tokens.push({ token: primary, envKey: 'APIFY_TOKEN', label: 'token1' })
  }
  for (const n of [2, 3, 4, 5]) {
    if (disabled.has(String(n))) continue
    const envKey = `APIFY_TOKEN${n}`
    const token = process.env[envKey]?.trim() || null
    if (token) tokens.push({ token, envKey, label: `token${n}` })
  }
  return tokens
}

/**
 * Cooldown semanal só de comentários (posts continuam).
 * Marca no começo da execução — se rodou uma vez, bloqueia 7 dias.
 */
async function getCommentsCollectCooldown(supabase) {
  if (!COMMENTS_COOLDOWN_ENABLED) {
    return { blocked: false, nextAt: null, lastStartedAt: null, stateMissing: false }
  }

  const { data, error } = await supabase
    .from('instagram_radar_comments_collect_state')
    .select('last_started_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    if (
      error.message?.includes('does not exist') ||
      error.code === '42P01' ||
      error.code === 'PGRST205'
    ) {
      return { blocked: false, nextAt: null, lastStartedAt: null, stateMissing: true }
    }
    throw new Error(error.message)
  }

  const lastStartedAt = data?.last_started_at ?? null
  const lastStarted = lastStartedAt ? new Date(lastStartedAt).getTime() : 0
  if (!lastStarted) {
    return { blocked: false, nextAt: null, lastStartedAt: null, stateMissing: false }
  }

  const elapsed = Date.now() - lastStarted
  if (elapsed >= COMMENTS_COOLDOWN_MS) {
    return { blocked: false, nextAt: null, lastStartedAt, stateMissing: false }
  }

  return {
    blocked: true,
    nextAt: new Date(lastStarted + COMMENTS_COOLDOWN_MS).toISOString(),
    lastStartedAt,
    stateMissing: false,
  }
}

/** Grava o início da coleta de comentários (trava 7 dias a partir daqui). */
async function markCommentsCollectStarted(supabase) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('instagram_radar_comments_collect_state').upsert(
    {
      id: 1,
      last_started_at: now,
      last_finished_at: null,
      last_success: false,
      comments_found: 0,
      note: 'comments phase started',
      updated_at: now,
    },
    { onConflict: 'id' },
  )

  if (error) {
    if (
      error.message?.includes('does not exist') ||
      error.code === '42P01' ||
      error.code === 'PGRST205'
    ) {
      logProgress(
        'Tabela instagram_radar_comments_collect_state ausente — rode database/add-instagram-radar-comments-collect-state.sql (cooldown de comentários sem persistência).',
      )
      return false
    }
    throw new Error(error.message)
  }
  return true
}

async function markCommentsCollectFinished(supabase, { success, commentsFound, note }) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('instagram_radar_comments_collect_state')
    .update({
      last_finished_at: now,
      last_success: Boolean(success),
      comments_found: Number(commentsFound) || 0,
      note: note || null,
      updated_at: now,
    })
    .eq('id', 1)

  if (error && !(error.code === '42P01' || error.code === 'PGRST205')) {
    logProgress(`Falha ao gravar fim dos comentários: ${error.message}`)
  }
}

/** Divide atores em N fatias ~iguais (uma por token). */
function splitActorsAcrossTokens(actors, tokenEntries) {
  if (tokenEntries.length === 0) return []
  if (tokenEntries.length === 1 || actors.length <= 1) {
    const entry = tokenEntries[0]
    return [{ token: entry.token, actors, label: entry.label, envKey: entry.envKey }]
  }

  const shardCount = Math.min(tokenEntries.length, actors.length)
  const base = Math.floor(actors.length / shardCount)
  const extra = actors.length % shardCount
  const shards = []
  let offset = 0

  for (let i = 0; i < shardCount; i += 1) {
    const size = base + (i < extra ? 1 : 0)
    const slice = actors.slice(offset, offset + size)
    offset += size
    if (slice.length === 0) continue
    const entry = tokenEntries[i]
    shards.push({
      token: entry.token,
      actors: slice,
      label: entry.label,
      envKey: entry.envKey,
    })
  }

  return shards
}

async function collectPostsForShard(supabase, token, shardActors, usernameToActor, totals, byActorSlug, label) {
  if (shardActors.length === 0) return

  const directUrls = shardActors.map((a) => `https://www.instagram.com/${a.username}/`)
  const expectedPosts = shardActors.length * POSTS_LIMIT
  const estimatedCost = (expectedPosts / 1000) * POST_USD_PER_1000

  logProgress(
    `[${label}] ${shardActors.length} perfis × ${POSTS_LIMIT} posts · teto US$ ${MAX_CHARGE_USD} · estimativa ~US$ ${estimatedCost.toFixed(3)}`,
  )

  const run = await startApifyRun(token, directUrls, {
    resultsType: 'posts',
    resultsLimit: POSTS_LIMIT,
    onlyPostsNewerThan: POSTS_WINDOW,
    maxChargeUsd: MAX_CHARGE_USD,
  })
  const runId = run.id
  const datasetId = run.defaultDatasetId
  totals.apifyRunId = totals.apifyRunId ? `${totals.apifyRunId},${runId}` : runId
  logProgress(`[${label}] Apify run ${runId} concluído · dataset ${datasetId}`)

  const rawItems = await fetchDatasetItems(token, datasetId)
  logProgress(`[${label}] ${rawItems.length} itens no dataset Apify`)
  totals.estimatedCostUsd =
    Math.round((totals.estimatedCostUsd + (rawItems.length / 1000) * POST_USD_PER_1000) * 10000) / 10000

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
      views_count: parsed.views_count ?? 0,
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
}

function parseApifyComment(item, postUrlHint) {
  const commentId = item.id || item.commentId || item.pk
  const username = normalizeUsername(
    item.ownerUsername || item.username || item.user?.username || item.owner?.username,
  )
  if (!commentId || !username) return null

  let postId =
    item.postId ||
    item.mediaId ||
    item.shortCode ||
    item.parentPostId ||
    null
  const postUrl =
    item.postUrl ||
    item.inputUrl ||
    item.inputURL ||
    postUrlHint ||
    null
  if (!postId && postUrl) {
    const m = String(postUrl).match(/\/(?:p|reel|tv)\/([^/?#]+)/i)
    if (m?.[1]) postId = m[1]
  }
  if (!postId) return null

  const ts = item.timestamp || item.createdAt || item.takenAt
  let commentedAt = null
  if (ts) {
    const n = Number(ts)
    if (Number.isFinite(n) && n > 1e9 && n < 1e12) commentedAt = new Date(n * 1000).toISOString()
    else if (Number.isFinite(n) && n > 1e12) commentedAt = new Date(n).toISOString()
    else {
      const d = new Date(ts)
      if (!Number.isNaN(d.getTime())) commentedAt = d.toISOString()
    }
  }

  return {
    post_id: String(postId),
    comment_id: String(commentId),
    commenter_username: username,
    commenter_id: item.ownerId || item.userId || item.user?.id || null,
    comment_text: item.text || item.comment || null,
    comment_like_count: Number(item.likesCount ?? item.likes ?? 0) || 0,
    commented_at: commentedAt,
    post_url: postUrl,
  }
}

function chunkArray(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Coleta comentários nos posts mais engajados dos atores do shard.
 * Schema: database/create-instagram-radar-comments-table.sql
 */
async function collectCommentsForShard(supabase, token, shardActors, totals, label) {
  if (!COLLECT_COMMENTS || shardActors.length === 0) return

  const targets = []
  for (const actor of shardActors) {
    const { data: posts, error: postsErr } = await supabase
      .from('instagram_radar_posts')
      .select('politico_id, post_id, post_url, likes_count, comments_count, posted_at')
      .eq('politico_id', actor.id)
      .gt('comments_count', 0)
      .not('post_url', 'is', null)
      .order('comments_count', { ascending: false })
      .limit(COMMENTS_MAX_POSTS)

    if (postsErr) {
      if (
        postsErr.message?.includes('instagram_radar') ||
        postsErr.code === '42P01' ||
        postsErr.code === 'PGRST205'
      ) {
        totals.errors.push(`[${label}] posts para comentários: ${postsErr.message}`)
        return
      }
      throw new Error(postsErr.message)
    }
    for (const p of posts ?? []) {
      if (p.post_url) targets.push(p)
    }
  }

  if (targets.length === 0) {
    logProgress(`[${label}] sem posts com comentários para scrapar`)
    return
  }

  const estimated = (targets.length * COMMENTS_LIMIT) / 1000 * COMMENT_USD_PER_1000
  logProgress(
    `[${label}] comentários: ${targets.length} posts × até ${COMMENTS_LIMIT} · teto US$ ${COMMENTS_MAX_CHARGE_USD} · estimativa ~US$ ${estimated.toFixed(2)}`,
  )

  const urlToPost = new Map(targets.map((p) => [p.post_url, p]))
  const batches = chunkArray(targets, COMMENTS_BATCH_SIZE)
  let commentsUpserted = 0

  for (let bi = 0; bi < batches.length; bi += 1) {
    const batch = batches[bi]
    const directUrls = batch.map((p) => p.post_url)
    try {
      const run = await startApifyRun(token, directUrls, {
        resultsType: 'comments',
        resultsLimit: COMMENTS_LIMIT,
        onlyPostsNewerThan: null,
        maxChargeUsd: COMMENTS_MAX_CHARGE_USD,
      })
      const runId = run.id
      totals.apifyRunId = totals.apifyRunId ? `${totals.apifyRunId},${runId}` : runId
      const rawItems = await fetchDatasetItems(token, run.defaultDatasetId)
      totals.estimatedCostUsd =
        Math.round(
          (totals.estimatedCostUsd + (rawItems.length / 1000) * COMMENT_USD_PER_1000) * 10000,
        ) / 10000

      for (const item of rawItems) {
        const inputUrl = item.inputUrl || item.inputURL || item.postUrl || null
        const hintPost = inputUrl ? urlToPost.get(inputUrl) : null
        const parsed = parseApifyComment(item, hintPost?.post_url ?? inputUrl)
        if (!parsed) continue

        let politicoId = hintPost?.politico_id ?? null
        if (!politicoId) {
          const match = targets.find(
            (t) => t.post_id === parsed.post_id || t.post_url === parsed.post_url,
          )
          politicoId = match?.politico_id ?? null
        }
        if (!politicoId) continue

        const row = {
          politico_id: politicoId,
          post_id: parsed.post_id,
          comment_id: parsed.comment_id,
          commenter_username: parsed.commenter_username,
          commenter_id: parsed.commenter_id,
          comment_text: parsed.comment_text,
          comment_like_count: parsed.comment_like_count,
          commented_at: parsed.commented_at,
          post_url: parsed.post_url,
          collected_at: new Date().toISOString(),
        }

        const { error: upErr } = await supabase.from('instagram_radar_comments').upsert(row, {
          onConflict: 'politico_id,comment_id',
        })
        if (upErr) {
          if (
            upErr.message?.includes('instagram_radar_comments') ||
            upErr.code === '42P01' ||
            upErr.code === 'PGRST205'
          ) {
            totals.errors.push(
              `[${label}] Tabela instagram_radar_comments ausente. Execute database/create-instagram-radar-comments-table.sql`,
            )
            return
          }
          totals.errors.push(`[${label}] comment upsert: ${upErr.message}`)
        } else {
          commentsUpserted += 1
          totals.commentsFound = (totals.commentsFound ?? 0) + 1
        }
      }

      logProgress(
        `[${label}] comments batch ${bi + 1}/${batches.length}: ${rawItems.length} itens Apify`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      totals.errors.push(`[${label}] comments batch ${bi + 1}: ${msg}`)
      logProgress(`[${label}] comments batch falhou — seguindo: ${msg}`)
    }
  }

  logProgress(`[${label}] comentários upserted: ${commentsUpserted}`)
}

async function main() {
  const tokens = resolveApifyTokens()
  if (tokens.length === 0) {
    throw new Error(
      'Coleta de concorrentes não configurada (APIFY_TOKEN / APIFY_TOKEN2..5).',
    )
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
          : ['Nenhum concorrente ativo com @ Instagram — coleta de concorrentes não executada.'],
      },
    }))
    return
  }

  const capped = prepared.slice(0, MAX_ACTORS)
  if (prepared.length > MAX_ACTORS) {
    logProgress(`Limitando a ${MAX_ACTORS} perfis (INSTAGRAM_RADAR_MAX_ACTORS). ${prepared.length - MAX_ACTORS} ignorados.`)
  }

  const shards = splitActorsAcrossTokens(capped, tokens)
  const usernameToActor = new Map(capped.map((a) => [a.username, a]))

  logProgress(
    tokens.length > 1
      ? `Split Apify: ${shards.map((s) => `${s.label}=${s.actors.length}`).join(' · ')} · env ${shards.map((s) => s.envKey).join(' + ')}`
      : `1 token Apify (${tokens[0].envKey}) · ${capped.length} perfis`,
  )

  const totals = {
    actorsProcessed: capped.length,
    postsFound: 0,
    postsInserted: 0,
    postsUpdated: 0,
    commentsFound: 0,
    commentsSkipped: false,
    commentsNextAt: null,
    avatarsUpdated: 0,
    estimatedCostUsd: 0,
    apifyRunId: null,
    apifyDetailsRunId: null,
    ownCandidateSynced: 0,
    errors: [],
  }

  const byActorSlug = new Map()

  for (const shard of shards) {
    await syncAvatarsFromDetails(supabase, shard.token, shard.actors, usernameToActor, totals)
    try {
      await collectPostsForShard(
        supabase,
        shard.token,
        shard.actors,
        usernameToActor,
        totals,
        byActorSlug,
        shard.label,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      totals.errors.push(`[${shard.label}/${shard.envKey}] posts: ${msg}`)
      logProgress(`[${shard.label}] posts falhou — seguindo: ${msg}`)
    }
  }

  // Comentários: no máx. 1× / semana (posts já rodaram acima)
  let runComments = COLLECT_COMMENTS
  if (runComments) {
    const cool = await getCommentsCollectCooldown(supabase)
    if (cool.stateMissing) {
      totals.errors.push(
        'Execute database/add-instagram-radar-comments-collect-state.sql para persistir o cooldown semanal de comentários.',
      )
    }
    if (cool.blocked) {
      runComments = false
      totals.commentsSkipped = true
      totals.commentsNextAt = cool.nextAt
      const when = cool.nextAt
        ? new Date(cool.nextAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '?'
      logProgress(`Comentários em cooldown semanal — pulando (próxima em ${when}). Posts OK.`)
    }
  }

  if (runComments && tokens.length > 0) {
    const marked = await markCommentsCollectStarted(supabase)
    if (marked) {
      logProgress('Comentários: trava semanal registrada (1× / 7 dias a partir de agora).')
    }

    try {
      for (const shard of shards) {
        try {
          await collectCommentsForShard(supabase, shard.token, shard.actors, totals, shard.label)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          totals.errors.push(`[${shard.label}/${shard.envKey}] comments: ${msg}`)
          logProgress(`[${shard.label}] comments falhou — seguindo: ${msg}`)
        }
      }

      // Comentários do candidato próprio (posts já sincronizados via Graph)
      const { data: ownActors } = await supabase
        .from('political_actors')
        .select('id, name, slug, instagram_username, active, actor_type')
        .eq('active', true)
        .eq('actor_type', 'own_candidate')
        .not('instagram_username', 'is', null)

      const ownPrepared = (ownActors ?? [])
        .map((a) => ({ ...a, username: normalizeUsername(a.instagram_username) }))
        .filter((a) => a.username)

      if (ownPrepared.length > 0) {
        try {
          await collectCommentsForShard(
            supabase,
            tokens[0].token,
            ownPrepared,
            totals,
            'own',
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          totals.errors.push(`[own] comments: ${msg}`)
        }
      }

      await markCommentsCollectFinished(supabase, {
        success: true,
        commentsFound: totals.commentsFound ?? 0,
        note: `ok · ${shards.map((s) => s.envKey).join('+')}`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      totals.errors.push(`comments phase: ${msg}`)
      await markCommentsCollectFinished(supabase, {
        success: false,
        commentsFound: totals.commentsFound ?? 0,
        note: msg,
      })
    }
  }

  const results = []
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
