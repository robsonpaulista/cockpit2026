import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import { normalizeIptMunicipio } from '@/lib/ipt'
import type { IptMissaoId } from '@/lib/ipt-missoes'
import type { IptMissaoMudancaSentido } from '@/lib/ipt-missoes'

export const dynamic = 'force-dynamic'

const MISSOES = new Set(['expectativa', 'campo', 'pesquisa', 'digital', 'obras'])
const SENTIDOS = new Set(['entrou', 'saiu'])

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    // Evolução é base compartilhada; admin client evita buracos de RLS/local.
    const db = createAdminClient()
    const sp = request.nextUrl.searchParams
    const missao = sp.get('missao')?.trim()
    const municipio = sp.get('municipio')?.trim()
    const sentido = sp.get('sentido')?.trim()
    const limitRaw = Number(sp.get('limit') ?? '300')
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, limitRaw)) : 300

    let q = db
      .from('ipt_missao_eventos')
      .select(
        'id, municipio, municipio_normalizado, missao, sentido, motivo, detalhes, fonte, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (missao && MISSOES.has(missao)) q = q.eq('missao', missao)
    if (sentido && SENTIDOS.has(sentido)) q = q.eq('sentido', sentido)
    if (municipio) q = q.eq('municipio_normalizado', normalizeIptMunicipio(municipio))

    const { data, error } = await q
    if (error) {
      // Tabela ainda não criada no projeto.
      if (error.code === '42P01' || /does not exist|relation/i.test(error.message)) {
        return NextResponse.json({ eventos: [], pendingMigration: true })
      }
      console.error('ipt missao-eventos GET:', error)
      return NextResponse.json({ error: 'Erro ao listar evolução das missões' }, { status: 500 })
    }

    return NextResponse.json({ eventos: data ?? [] })
  } catch (e: unknown) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json({ eventos: [], offline: true })
    }
    console.error('ipt missao-eventos GET:', e)
    return NextResponse.json({ error: 'Erro ao listar evolução das missões' }, { status: 500 })
  }
}

type EventoBody = {
  id?: string
  municipio: string
  municipioNormalizado?: string
  missao: IptMissaoId
  sentido: IptMissaoMudancaSentido
  motivo: string
  detalhes?: Record<string, unknown>
  fonte?: string
  createdAt?: string
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const body = (await request.json()) as { eventos?: EventoBody[] }
    const lista = Array.isArray(body.eventos) ? body.eventos : []
    if (lista.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 })
    }

    const rows = lista
      .filter(
        (e) =>
          e &&
          typeof e.municipio === 'string' &&
          e.municipio.trim() &&
          MISSOES.has(e.missao) &&
          SENTIDOS.has(e.sentido) &&
          typeof e.motivo === 'string' &&
          e.motivo.trim()
      )
      .slice(0, 200)
      .map((e) => ({
        ...(e.id ? { id: e.id } : {}),
        municipio: e.municipio.trim(),
        municipio_normalizado:
          e.municipioNormalizado?.trim() || normalizeIptMunicipio(e.municipio),
        missao: e.missao,
        sentido: e.sentido,
        motivo: e.motivo.trim().slice(0, 600),
        detalhes: e.detalhes && typeof e.detalhes === 'object' ? e.detalhes : {},
        fonte: e.fonte === 'manual' || e.fonte === 'bootstrap' ? e.fonte : 'sync',
        ...(e.createdAt ? { created_at: e.createdAt } : {}),
      }))

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Nenhum evento válido' }, { status: 400 })
    }

    const db = createAdminClient()
    const { error } = await db.from('ipt_missao_eventos').upsert(rows, {
      onConflict: 'id',
      ignoreDuplicates: true,
    })

    if (error) {
      if (error.code === '42P01' || /does not exist|relation/i.test(error.message)) {
        return NextResponse.json(
          { error: 'Tabela ipt_missao_eventos ausente. Rode o SQL create-ipt-missao-eventos.sql.' },
          { status: 503 }
        )
      }
      console.error('ipt missao-eventos POST:', error)
      return NextResponse.json({ error: 'Erro ao gravar eventos' }, { status: 500 })
    }

    return NextResponse.json({ success: true, inserted: rows.length })
  } catch (e: unknown) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json({ error: 'Conexão instável' }, { status: 503 })
    }
    console.error('ipt missao-eventos POST:', e)
    return NextResponse.json({ error: 'Erro ao gravar eventos' }, { status: 500 })
  }
}
