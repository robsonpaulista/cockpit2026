import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { countEnrollmentsByPerson, mapPessoaRow, PERSON_ENROLLMENTS_BUCKET } from '@/lib/pessoas-server'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      name?: string
      roleTag?: string | null
      notes?: string | null
    }

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = body.name.trim()
      if (!name) return NextResponse.json({ error: 'Nome inválido' }, { status: 400 })
      updates.name = name
    }
    if (body.roleTag !== undefined) updates.role_tag = body.roleTag?.trim() || null
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.from('persons').update(updates).eq('id', id).select('*').single()
    if (error) throw error

    const counts = await countEnrollmentsByPerson(supabase, [id])
    const pessoa = await mapPessoaRow(supabase, data as Parameters<typeof mapPessoaRow>[1], counts.get(id) ?? 0)
    return NextResponse.json(pessoa)
  } catch (error) {
    console.error('pessoas update:', error)
    return NextResponse.json({ error: 'Falha ao atualizar pessoa' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = createAdminClient()

    const { data: person } = await supabase.from('persons').select('reference_image_path').eq('id', id).maybeSingle()

    await supabase.from('face_descriptors').delete().eq('person_id', id).is('photo_id', null)
    const { error } = await supabase.from('persons').delete().eq('id', id)
    if (error) throw error

    if (person?.reference_image_path) {
      await supabase.storage.from(PERSON_ENROLLMENTS_BUCKET).remove([person.reference_image_path as string])
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('pessoas delete:', error)
    return NextResponse.json({ error: 'Falha ao excluir pessoa' }, { status: 500 })
  }
}
