import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { countEnrollmentsByPerson, mapPessoaRow } from '@/lib/pessoas-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.from('persons').select('*').order('name', { ascending: true })
    if (error) throw error

    const ids = (data ?? []).map((p) => p.id as string)
    const enrollmentCounts = await countEnrollmentsByPerson(supabase, ids)

    const pessoas = await Promise.all(
      (data ?? []).map((row) =>
        mapPessoaRow(supabase, row as Parameters<typeof mapPessoaRow>[1], enrollmentCounts.get(row.id as string) ?? 0),
      ),
    )

    return NextResponse.json(pessoas)
  } catch (error) {
    console.error('pessoas list:', error)
    return NextResponse.json({ error: 'Falha ao listar pessoas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; roleTag?: string; notes?: string }
    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: existing } = await supabase
      .from('persons')
      .select('id')
      .ilike('name', name)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Já existe uma pessoa com esse nome' }, { status: 409 })
    }

    const insert: Record<string, unknown> = { name }
    if (body.roleTag?.trim()) insert.role_tag = body.roleTag.trim()
    if (body.notes?.trim()) insert.notes = body.notes.trim()

    const { data, error } = await supabase.from('persons').insert(insert).select('*').single()
    if (error) throw error

    const pessoa = await mapPessoaRow(supabase, data as Parameters<typeof mapPessoaRow>[1], 0)
    return NextResponse.json(pessoa, { status: 201 })
  } catch (error) {
    console.error('pessoas create:', error)
    return NextResponse.json({ error: 'Falha ao cadastrar pessoa' }, { status: 500 })
  }
}
