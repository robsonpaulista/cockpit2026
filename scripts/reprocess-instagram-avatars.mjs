#!/usr/bin/env node
/**
 * Reprocessa avatares já baixados: remove fundo + fundo #F3F4F4.
 *
 *   npm run instagram:avatars:reprocess
 *   node scripts/reprocess-instagram-avatars.mjs --slug=jadyel-alencar
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Skip AI: INSTAGRAM_AVATAR_SKIP_BG=1
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createSupabaseClient as createSupabase } from './lib/supabase-client.mjs'
import { persistInstagramAvatarFromUrl } from './lib/instagram-avatar-storage.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

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
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}

loadEnvFile()

const args = process.argv.slice(2)
const slugArg = args.find((a) => a.startsWith('--slug='))?.slice('--slug='.length)

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
  }

  const supabase = createSupabase(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  let q = supabase
    .from('political_actors')
    .select('id, slug, name, instagram_avatar_url, instagram_avatar_path')
    .not('instagram_avatar_url', 'is', null)
    .order('slug')

  if (slugArg) q = q.eq('slug', slugArg)

  const { data: actors, error } = await q
  if (error) throw new Error(error.message)
  if (!actors?.length) {
    console.log('Nenhum ator com avatar para reprocessar.')
    return
  }

  console.log(`Reprocessando ${actors.length} avatar(es)…`)
  let ok = 0
  let fail = 0

  for (const actor of actors) {
    const url = String(actor.instagram_avatar_url || '').split('?')[0]
    if (!url) continue
    try {
      const result = await persistInstagramAvatarFromUrl(supabase, {
        actorId: actor.id,
        slug: actor.slug,
        imageUrl: url,
      })
      ok += 1
      console.log(
        `✓ ${actor.slug} ${result?.flattened ? '(fundo removido)' : '(sem remoção AI / skip)'}`,
      )
    } catch (err) {
      fail += 1
      console.error(`✗ ${actor.slug}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`\nConcluído: ${ok} ok, ${fail} falha(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
