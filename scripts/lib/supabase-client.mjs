/**
 * Supabase via CJS — ESM puro quebra na Vercel (index.mjs ausente no bundle).
 */
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

export function createSupabaseClient(url, key, options) {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(url, key, options)
}
