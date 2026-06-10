import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { normalizeContactPhone } from '@/lib/whatsapp/contact-phone'
import { WHATSAPP_CONTACT_CATEGORIES } from '@/lib/whatsapp/contact-types'
import { isWhatsAppContactsTableMissing } from '@/lib/whatsapp/contacts-db-error'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  telefone: z.string().min(8).max(30).optional(),
  cargo: z.string().max(120).optional().nullable(),
  categoria: z.enum(WHATSAPP_CONTACT_CATEGORIES).optional(),
  is_default: z.boolean().optional(),
  notas: z.string().max(500).optional().nullable(),
  ativo: z.boolean().optional(),
})

async function clearOtherDefaults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  excludeId: string,
) {
  await supabase
    .from('whatsapp_contacts')
    .update({ is_default: false })
    .eq('is_default', true)
    .neq('id', excludeId)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = patchSchema.parse(body)

    const updates: Record<string, unknown> = {
      updated_by: user.id,
    }

    if (parsed.nome !== undefined) updates.nome = parsed.nome.trim()
    if (parsed.cargo !== undefined) updates.cargo = parsed.cargo?.trim() || null
    if (parsed.categoria !== undefined) updates.categoria = parsed.categoria
    if (parsed.is_default !== undefined) updates.is_default = parsed.is_default
    if (parsed.notas !== undefined) updates.notas = parsed.notas?.trim() || null
    if (parsed.ativo !== undefined) updates.ativo = parsed.ativo

    if (parsed.telefone !== undefined) {
      const telefone = normalizeContactPhone(parsed.telefone)
      if (!telefone) {
        return NextResponse.json({ error: 'Telefone inválido.' }, { status: 400 })
      }
      updates.telefone = telefone
    }

    if (parsed.is_default === true) {
      await clearOtherDefaults(supabase, id)
    }

    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      if (isWhatsAppContactsTableMissing(error)) {
        return NextResponse.json(
          { error: 'Tabela whatsapp_contacts não existe no Supabase.' },
          { status: 503 },
        )
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe um contato ativo com este telefone.' }, { status: 409 })
      }
      console.error('Erro ao atualizar contato WhatsApp:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: error.flatten() }, { status: 400 })
    }
    console.error('Erro ao atualizar contato WhatsApp:', error)
    return NextResponse.json({ error: 'Erro ao atualizar contato' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error } = await supabase
      .from('whatsapp_contacts')
      .update({ ativo: false, is_default: false, updated_by: user.id })
      .eq('id', id)

    if (error) {
      if (isWhatsAppContactsTableMissing(error)) {
        return NextResponse.json(
          { error: 'Tabela whatsapp_contacts não existe no Supabase.' },
          { status: 503 },
        )
      }
      console.error('Erro ao remover contato WhatsApp:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao remover contato WhatsApp:', error)
    return NextResponse.json({ error: 'Erro ao remover contato' }, { status: 500 })
  }
}
