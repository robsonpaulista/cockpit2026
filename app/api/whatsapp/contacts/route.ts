import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { normalizeContactPhone } from '@/lib/whatsapp/contact-phone'
import { WHATSAPP_CONTACT_CATEGORIES } from '@/lib/whatsapp/contact-types'
import { isWhatsAppContactsTableMissing } from '@/lib/whatsapp/contacts-db-error'

export const dynamic = 'force-dynamic'

const contactSchema = z.object({
  nome: z.string().min(1).max(120),
  telefone: z.string().min(8).max(30),
  cargo: z.string().max(120).optional().nullable(),
  categoria: z.enum(WHATSAPP_CONTACT_CATEGORIES).optional(),
  is_default: z.boolean().optional(),
  notas: z.string().max(500).optional().nullable(),
  ativo: z.boolean().optional(),
})

async function clearOtherDefaults(supabase: Awaited<ReturnType<typeof createClient>>, excludeId?: string) {
  let query = supabase
    .from('whatsapp_contacts')
    .update({ is_default: false })
    .eq('is_default', true)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  await query
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria')
    const includeInactive = searchParams.get('includeInactive') === '1'

    let query = supabase
      .from('whatsapp_contacts')
      .select('*')
      .order('is_default', { ascending: false })
      .order('nome', { ascending: true })

    if (!includeInactive) {
      query = query.eq('ativo', true)
    }

    if (categoria && WHATSAPP_CONTACT_CATEGORIES.includes(categoria as (typeof WHATSAPP_CONTACT_CATEGORIES)[number])) {
      query = query.eq('categoria', categoria)
    }

    const { data, error } = await query

    if (error) {
      if (isWhatsAppContactsTableMissing(error)) {
        return NextResponse.json([], {
          headers: { 'X-WhatsApp-Contacts': 'table-missing' },
        })
      }
      console.error('Erro ao listar contatos WhatsApp:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('Erro ao listar contatos WhatsApp:', error)
    return NextResponse.json({ error: 'Erro ao listar contatos' }, { status: 500 })
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

    const body = await request.json()
    const parsed = contactSchema.parse(body)
    const telefone = normalizeContactPhone(parsed.telefone)

    if (!telefone) {
      return NextResponse.json(
        { error: 'Telefone inválido. Use DDD + número (ex.: 86 99810-7492).' },
        { status: 400 },
      )
    }

    if (parsed.is_default) {
      await clearOtherDefaults(supabase)
    }

    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .insert({
        nome: parsed.nome.trim(),
        telefone,
        cargo: parsed.cargo?.trim() || null,
        categoria: parsed.categoria ?? 'geral',
        is_default: parsed.is_default ?? false,
        notas: parsed.notas?.trim() || null,
        ativo: parsed.ativo ?? true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('*')
      .single()

    if (error) {
      if (isWhatsAppContactsTableMissing(error)) {
        return NextResponse.json(
          {
            error:
              'Tabela whatsapp_contacts não existe. Execute database/create-whatsapp-contacts-table.sql no Supabase.',
          },
          { status: 503 },
        )
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe um contato ativo com este telefone.' }, { status: 409 })
      }
      console.error('Erro ao criar contato WhatsApp:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: error.flatten() }, { status: 400 })
    }
    console.error('Erro ao criar contato WhatsApp:', error)
    return NextResponse.json({ error: 'Erro ao criar contato' }, { status: 500 })
  }
}
