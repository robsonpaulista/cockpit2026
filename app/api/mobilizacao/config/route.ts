import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import {
  insertMilitanciaLead,
  normalizeInstagramHandle,
  normalizeWhatsappDigits,
} from '@/lib/mobilizacao-lead-capture'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  resolverNomeMunicipioPIOficial,
} from '@/lib/piaui-territorio-desenvolvimento'

export const dynamic = 'force-dynamic'

const TERRITORIOS_TD_PI = TERRITORIOS_DESENVOLVIMENTO_PI as readonly string[]

const createCoordinatorSchema = z.object({
  tipo: z.literal('coordinator'),
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  regiao: z
    .string()
    .trim()
    .min(1, 'Selecione um Território de Desenvolvimento')
    .refine((s) => TERRITORIOS_TD_PI.includes(s), 'TD inválido'),
})

const createLeaderSchema = z.object({
  tipo: z.literal('leader'),
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  telefone: z.string().trim().max(32).optional().nullable(),
  municipio: z.string().trim().min(2, 'Município é obrigatório'),
  coordinator_id: z.string().uuid('coordinator_id inválido'),
})

const createLideradoSchema = z.object({
  tipo: z.literal('liderado'),
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  whatsapp: z.string().trim().min(8, 'WhatsApp é obrigatório'),
  instagram: z.string().trim().optional().nullable(),
  leader_id: z.string().uuid('leader_id inválido'),
  cidade: z.string().trim().max(120).optional().nullable(),
})

const createBodySchema = z.discriminatedUnion('tipo', [
  createCoordinatorSchema,
  createLeaderSchema,
  createLideradoSchema,
])

const patchCoordinatorSchema = z.object({
  recurso: z.literal('coordinator'),
  id: z.string().uuid(),
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  regiao: z
    .string()
    .trim()
    .min(1, 'Selecione um Território de Desenvolvimento')
    .refine((s) => TERRITORIOS_TD_PI.includes(s), 'TD inválido'),
})

const patchLeaderSchema = z.object({
  recurso: z.literal('leader'),
  id: z.string().uuid(),
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  telefone: z.string().trim().max(32).optional().nullable(),
  municipio: z.string().trim().min(2, 'Município é obrigatório'),
  coordinator_id: z.string().uuid('coordinator_id inválido'),
})

const patchLideradoSchema = z.object({
  recurso: z.literal('liderado'),
  id: z.string().uuid(),
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  whatsapp: z.string().trim().min(8, 'WhatsApp é obrigatório'),
  instagram: z.string().trim().optional().nullable(),
  cidade: z.string().trim().max(120).optional().nullable(),
  leader_id: z.string().uuid('leader_id inválido'),
  status: z.enum(['ativo', 'inativo']).optional(),
})

const patchBodySchema = z.discriminatedUnion('recurso', [
  patchCoordinatorSchema,
  patchLeaderSchema,
  patchLideradoSchema,
])

export async function GET() {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

  const admin = createAdminClient()
  const [
    { data: coordinators, error: coordinatorsError },
    { data: leaders, error: leadersError },
    { data: liderados, error: lideradosError },
  ] = await Promise.all([
    admin.from('coordinators').select('id, nome, regiao, created_at').order('nome', { ascending: true }),
    admin
      .from('leaders')
      .select('id, nome, telefone, cidade, municipio, coordinator_id, created_at, coordinators(id, nome)')
      .order('nome', { ascending: true }),
    admin
      .from('leads_militancia')
      .select(
        'id, nome, whatsapp, instagram, cidade, origem, status, created_at, leader_id, leaders(id, nome)'
      )
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  if (coordinatorsError || leadersError || lideradosError) {
    console.error(
      '[mobilizacao/config GET] erro',
      coordinatorsError ?? leadersError ?? lideradosError
    )
    return NextResponse.json({ error: 'Erro ao carregar configurações de mobilização' }, { status: 500 })
  }

  return NextResponse.json({
    coordinators: coordinators ?? [],
    leaders: leaders ?? [],
    liderados: liderados ?? [],
  })
}

export async function POST(request: Request) {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

  const admin = createAdminClient()
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = createBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  if (parsed.data.tipo === 'coordinator') {
    const { data, error } = await admin
      .from('coordinators')
      .insert({
        nome: parsed.data.nome,
        regiao: parsed.data.regiao.trim(),
      })
      .select('id, nome, regiao, created_at')
      .single()

    if (error) {
      console.error('[mobilizacao/config POST coordinator] erro', error)
      return NextResponse.json({ error: 'Erro ao criar coordenador' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, coordinator: data }, { status: 201 })
  }

  if (parsed.data.tipo === 'liderado') {
    const cidadeOverride = parsed.data.cidade?.trim() || null
    const result = await insertMilitanciaLead(admin, {
      nome: parsed.data.nome,
      whatsappRaw: parsed.data.whatsapp,
      instagramRaw: parsed.data.instagram,
      leaderId: parsed.data.leader_id,
      origem: 'manual',
      cidadeOverride,
    })
    if (!result.ok) {
      if (result.status >= 500) {
        console.error('[mobilizacao/config POST liderado]', result.message)
      }
      return NextResponse.json({ error: result.message }, { status: result.status })
    }
    return NextResponse.json({ ok: true, liderado: result.lead }, { status: 201 })
  }

  const municipioCanonico = resolverNomeMunicipioPIOficial(parsed.data.municipio)
  if (!municipioCanonico) {
    return NextResponse.json(
      {
        error:
          'Município inválido. Escolha um dos municípios do Piauí da base oficial (Mapa TDs / 224 municípios).',
      },
      { status: 400 }
    )
  }

  const { data, error } = await admin
    .from('leaders')
    .insert({
      nome: parsed.data.nome,
      telefone: parsed.data.telefone?.trim() || null,
      municipio: municipioCanonico,
      cidade: municipioCanonico,
      coordinator_id: parsed.data.coordinator_id,
    })
    .select('id, nome, telefone, cidade, municipio, coordinator_id, created_at')
    .single()

  if (error) {
    console.error('[mobilizacao/config POST leader] erro', error)
    return NextResponse.json({ error: 'Erro ao criar liderança' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, leader: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

  const admin = createAdminClient()
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = patchBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  if (parsed.data.recurso === 'coordinator') {
    const { data, error } = await admin
      .from('coordinators')
      .update({
        nome: parsed.data.nome.trim(),
        regiao: parsed.data.regiao.trim(),
      })
      .eq('id', parsed.data.id)
      .select('id, nome, regiao, created_at')
      .maybeSingle()

    if (error) {
      console.error('[mobilizacao/config PATCH coordinator]', error)
      return NextResponse.json({ error: 'Erro ao atualizar coordenador' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Coordenador não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, coordinator: data })
  }

  if (parsed.data.recurso === 'leader') {
    const municipioCanonico = resolverNomeMunicipioPIOficial(parsed.data.municipio)
    if (!municipioCanonico) {
      return NextResponse.json(
        {
          error:
            'Município inválido. Escolha um dos municípios do Piauí da base oficial (Mapa TDs / 224 municípios).',
        },
        { status: 400 }
      )
    }

    const { data, error } = await admin
      .from('leaders')
      .update({
        nome: parsed.data.nome.trim(),
        telefone: parsed.data.telefone?.trim() || null,
        municipio: municipioCanonico,
        cidade: municipioCanonico,
        coordinator_id: parsed.data.coordinator_id,
      })
      .eq('id', parsed.data.id)
      .select('id, nome, telefone, cidade, municipio, coordinator_id, created_at, coordinators(id, nome)')
      .maybeSingle()

    if (error) {
      console.error('[mobilizacao/config PATCH leader]', error)
      return NextResponse.json({ error: 'Erro ao atualizar liderança' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Liderança não encontrada' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, leader: data })
  }

  const wa = normalizeWhatsappDigits(parsed.data.whatsapp)
  if (wa.length < 10 || wa.length > 13) {
    return NextResponse.json({ error: 'WhatsApp inválido' }, { status: 400 })
  }
  const ig = normalizeInstagramHandle(parsed.data.instagram)

  const { data: dupW } = await admin
    .from('leads_militancia')
    .select('id')
    .eq('whatsapp', wa)
    .neq('id', parsed.data.id)
    .maybeSingle()
  if (dupW) {
    return NextResponse.json({ error: 'Já existe outro cadastro com este WhatsApp.' }, { status: 409 })
  }

  if (ig) {
    const { data: dupI } = await admin
      .from('leads_militancia')
      .select('id')
      .eq('instagram', ig)
      .neq('id', parsed.data.id)
      .maybeSingle()
    if (dupI) {
      return NextResponse.json({ error: 'Já existe outro cadastro com este perfil do Instagram.' }, { status: 409 })
    }
  }

  const { data: leaderData, error: leaderErr } = await admin
    .from('leaders')
    .select('coordinator_id')
    .eq('id', parsed.data.leader_id)
    .maybeSingle()

  if (leaderErr || !leaderData) {
    return NextResponse.json({ error: 'Liderança não encontrada' }, { status: 400 })
  }

  const updateRow: Record<string, string | null> = {
    nome: parsed.data.nome.trim(),
    whatsapp: wa,
    instagram: ig,
    cidade: parsed.data.cidade?.trim() || null,
    leader_id: parsed.data.leader_id,
    coordinator_id: (leaderData.coordinator_id as string | null) ?? null,
  }
  if (parsed.data.status) {
    updateRow.status = parsed.data.status
  }

  const { data: lid, error: lidErr } = await admin
    .from('leads_militancia')
    .update(updateRow)
    .eq('id', parsed.data.id)
    .select(
      'id, nome, whatsapp, instagram, cidade, origem, status, created_at, leader_id, leaders(id, nome)'
    )
    .maybeSingle()

  if (lidErr) {
    if (lidErr.code === '23505') {
      const hint = `${lidErr.details ?? ''} ${lidErr.message ?? ''}`.toLowerCase()
      if (hint.includes('instagram')) {
        return NextResponse.json(
          { error: 'Já existe outro cadastro com este perfil do Instagram.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'Já existe outro cadastro com este WhatsApp.' }, { status: 409 })
    }
    console.error('[mobilizacao/config PATCH liderado]', lidErr)
    return NextResponse.json({ error: 'Erro ao atualizar liderado' }, { status: 500 })
  }
  if (!lid) {
    return NextResponse.json({ error: 'Liderado não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, liderado: lid })
}

export async function DELETE(request: Request) {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

  const { searchParams } = new URL(request.url)
  const recurso = searchParams.get('recurso')
  const id = searchParams.get('id')

  if (!recurso || !id) {
    return NextResponse.json({ error: 'Parâmetros recurso e id são obrigatórios' }, { status: 400 })
  }

  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (recurso === 'coordinator') {
    const { error } = await admin.from('coordinators').delete().eq('id', idParsed.data)
    if (error) {
      console.error('[mobilizacao/config DELETE coordinator]', error)
      return NextResponse.json({ error: 'Erro ao excluir coordenador' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (recurso === 'leader') {
    const { count, error: countError } = await admin
      .from('leads_militancia')
      .select('id', { count: 'exact', head: true })
      .eq('leader_id', idParsed.data)

    if (countError) {
      console.error('[mobilizacao/config DELETE leader count]', countError)
      return NextResponse.json({ error: 'Erro ao verificar liderados' }, { status: 500 })
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            'Não é possível excluir esta liderança enquanto existirem liderados vinculados. Exclua ou reatribua os liderados primeiro.',
        },
        { status: 409 }
      )
    }

    const { error } = await admin.from('leaders').delete().eq('id', idParsed.data)
    if (error) {
      console.error('[mobilizacao/config DELETE leader]', error)
      return NextResponse.json({ error: 'Erro ao excluir liderança' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (recurso === 'liderado') {
    const { error } = await admin.from('leads_militancia').delete().eq('id', idParsed.data)
    if (error) {
      console.error('[mobilizacao/config DELETE liderado]', error)
      return NextResponse.json({ error: 'Erro ao excluir liderado' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'recurso inválido' }, { status: 400 })
}
