#!/usr/bin/env node
/** Lê 1 registro real do Supabase (google_videos) e mostra pipeline completo. */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createSupabaseClient } from './lib/supabase-client.mjs'
import {
  extractVideoDateHint,
  parseGoogleVideosDateHint,
  parseMetadataRow,
} from './lib/google-videos-date.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

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

function buildUiLine(row) {
  const dateHint = extractVideoDateHint(row.summary)
  const effectiveDate = row.published_at || parseGoogleVideosDateHint(dateHint)
  const displayDate =
    dateHint?.trim() ||
    (effectiveDate
      ? new Date(effectiveDate).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'data indisponível')

  return {
    title: row.title,
    subtitleLine: `${row.platform} · ${row.source_name} · Google Vídeos · ${displayDate}`,
    dateHintFromSummary: dateHint,
    published_at: row.published_at,
    effectiveDate,
    parseMetadataFromSummary: parseMetadataRow(row.summary),
  }
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log(JSON.stringify({ ok: false, error: 'Sem credenciais Supabase' }, null, 2))
    process.exit(1)
  }

  const supabase = createSupabaseClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await supabase
    .from('google_news_mentions')
    .select('*')
    .eq('collect_channel', 'google_videos')
    .order('collected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    console.log(JSON.stringify({ ok: false, error: error?.message ?? 'Nenhum registro' }, null, 2))
    process.exit(1)
  }

  const ui = buildUiLine(data)

  console.log(
    JSON.stringify(
      {
        ok: true,
        fonte: 'supabase (último registro coletado)',
        '3_linha_supabase': data,
        '4_exibicao_ui': ui,
        diagnostico: {
          summary_tem_meta_line:
            /(?:Instagram|Facebook|YouTube)\s*·/i.test(data.summary ?? ''),
          dateHint_extraido: ui.dateHintFromSummary,
          motivo_data_indisponivel:
            !ui.dateHintFromSummary && !data.published_at
              ? 'summary não contém linha "Plataforma · Autor · data" nem published_at'
              : null,
        },
      },
      null,
      2
    )
  )
}

main()
