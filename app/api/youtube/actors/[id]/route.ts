import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { normalizeInstagramUsername } from '@/lib/instagram-radar-username'
import type { PoliticalActorType } from '@/lib/youtube-radar-types'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  actor_type: z.enum(['own_candidate', 'competitor', 'ally', 'other']).optional(),
  active: z.boolean().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  instagram_username: z.string().trim().max(80).nullable().optional(),
})

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = patchSchema.parse(await request.json())
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.actor_type !== undefined) updates.actor_type = body.actor_type as PoliticalActorType
    if (body.active !== undefined) updates.active = body.active
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.instagram_username !== undefined) {
      updates.instagram_username = normalizeInstagramUsername(body.instagram_username)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('political_actors')
      .update(updates)
      .eq('id', params.id)
      .select('id, name, slug, actor_type, active, notes, instagram_username, created_at, updated_at')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ actor: data })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message ?? 'Dados inválidos' }, { status: 400 })
    }
    const msg = e instanceof Error ? e.message : 'Erro ao atualizar candidato'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error } = await supabase.from('political_actors').delete().eq('id', params.id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao remover candidato'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
