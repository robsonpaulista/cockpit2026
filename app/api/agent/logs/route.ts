import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureAdmin } from '@/lib/auth-admin'
import type { AgentChatLogRow } from '@/lib/agent/agent-chat-log-types'

export const dynamic = 'force-dynamic'

const MAX_USER_MESSAGE = 1200
const MAX_ASSISTANT_MESSAGE = 8000
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    const { searchParams } = new URL(request.url)
    const limit = Math.min(
      Math.max(Number(searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    )
    const offset = Math.max(Number(searchParams.get('offset') ?? 0) || 0, 0)
    const q = searchParams.get('q')?.trim()

    let query = supabase
      .from('agent_chat_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (q) {
      const escaped = q.replace(/[%_,"]/g, '').trim()
      if (escaped) {
        const pattern = `%${escaped}%`
        query = query.or(
          `user_message.ilike."${pattern}",assistant_message.ilike."${pattern}",user_email.ilike."${pattern}"`
        )
      }
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[agent/logs] GET:', error)
      return NextResponse.json(
        { error: 'Erro ao carregar logs. Execute database/create-agent-chat-logs.sql no Supabase.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      logs: (data ?? []) as AgentChatLogRow[],
      total: count ?? 0,
      limit,
      offset,
    })
  } catch (err) {
    console.error('[agent/logs] GET exceção:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as {
      userMessage?: string
      assistantMessage?: string
      source?: string
      intent?: string
      sessionId?: string
      pagePath?: string
    }

    const userMessage = body.userMessage?.trim().slice(0, MAX_USER_MESSAGE)
    const assistantMessage = body.assistantMessage?.trim().slice(0, MAX_ASSISTANT_MESSAGE)

    if (!userMessage || !assistantMessage) {
      return NextResponse.json({ error: 'Mensagens inválidas' }, { status: 400 })
    }

    const { error } = await supabase.from('agent_chat_logs').insert({
      user_id: user.id,
      user_email: user.email ?? null,
      session_id: body.sessionId?.trim().slice(0, 120) || null,
      page_path: body.pagePath?.trim().slice(0, 240) || null,
      user_message: userMessage,
      assistant_message: assistantMessage,
      source: body.source?.trim().slice(0, 32) || 'client',
      intent: body.intent?.trim().slice(0, 64) || null,
    })

    if (error) {
      console.error('[agent/logs] POST:', error)
      return NextResponse.json({ error: 'Falha ao registrar log' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[agent/logs] POST exceção:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
