import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  readComunicarLideresMensagem,
  writeComunicarLideresMensagem,
} from '@/lib/war-room/comunicar-lideres-mensagem-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const data = await readComunicarLideresMensagem()
    return NextResponse.json(data)
  } catch (e: unknown) {
    console.error('[comunicar-lideres-mensagem GET]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao ler mensagem' },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as { template?: unknown }
    if (typeof body.template !== 'string' || !body.template.trim()) {
      return NextResponse.json({ error: 'template é obrigatório' }, { status: 400 })
    }

    const data = await writeComunicarLideresMensagem(body.template)
    return NextResponse.json(data)
  } catch (e: unknown) {
    console.error('[comunicar-lideres-mensagem PUT]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao salvar mensagem' },
      { status: 500 },
    )
  }
}
