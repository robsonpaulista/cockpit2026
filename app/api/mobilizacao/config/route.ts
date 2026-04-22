import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertMilitanciaLead } from '@/lib/mobilizacao-lead-capture'
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

type AuthContext =
  | { ok: true; supabase: ReturnType<typeof createClient>; userId: string; isAdmin: boolean }
  | { ok: false; response: NextResponse }

async function requireMobilizacaoAccess(): Promise<AuthContext> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Perfil não encontrado' }, { status: 403 }),
    }
  }

  const isAdmin = Boolean(profile.is_admin)
  if (!isAdmin) {
    const { data: permission, error: permissionError } = await supabase
      .from('profile_permissions')
      .select('page_key')
      .eq('profile_id', user.id)
      .eq('page_key', 'mobilizacao')
      .maybeSingle()

    if (permissionError || !permission) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Sem permissão para Mobilização' }, { status: 403 }),
      }
    }
  }

  return { ok: true, supabase, userId: user.id, isAdmin }
}

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
      .limit(80),
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
