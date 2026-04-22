import { createAdminClient } from '@/lib/supabase/admin'

export type MobilizacaoAdminClient = ReturnType<typeof createAdminClient>

export type CoordinatorJoinRow = { id: string; nome: string; regiao: string | null }

export type LeaderContextPublicRow = {
  id: string
  nome: string
  cidade: string | null
  coordinator_id: string | null
  coordinators: CoordinatorJoinRow | CoordinatorJoinRow[] | null
}

export function extractCoordinatorFromLeaderJoin(
  input: LeaderContextPublicRow['coordinators']
): CoordinatorJoinRow | null {
  if (!input) return null
  if (Array.isArray(input)) return input[0] ?? null
  return input
}

export async function fetchLeaderWithCoordinatorForPublicContext(
  admin: MobilizacaoAdminClient,
  leaderId: string
) {
  return admin
    .from('leaders')
    .select('id, nome, cidade, coordinator_id, coordinators(id, nome, regiao)')
    .eq('id', leaderId)
    .maybeSingle()
}

export function normalizeWhatsappDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

export function normalizeInstagramHandle(raw?: string | null): string | null {
  if (!raw) return null
  const semArroba = raw.trim().replace(/^@+/, '')
  const semEspacos = semArroba.replace(/\s+/g, '')
  if (!semEspacos) return null
  return semEspacos.toLowerCase()
}

type LeaderRowForLead = {
  id: string
  cidade: string | null
  coordinator_id: string | null
}

export async function fetchLeaderRowForMilitanciaLead(
  admin: MobilizacaoAdminClient,
  leaderId: string
): Promise<{ ok: true; leader: LeaderRowForLead } | { ok: false; message: string }> {
  const { data, error } = await admin
    .from('leaders')
    .select('id, cidade, coordinator_id')
    .eq('id', leaderId)
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Erro ao validar liderança' }
  }
  if (!data) {
    return { ok: false, message: 'Liderança não encontrada' }
  }
  return {
    ok: true,
    leader: {
      id: data.id as string,
      cidade: (data.cidade as string | null) ?? null,
      coordinator_id: (data.coordinator_id as string | null) ?? null,
    },
  }
}

export type InsertMilitanciaLeadInput = {
  nome: string
  whatsappRaw: string
  instagramRaw?: string | null
  leaderId: string
  origem: string
  /** Se preenchido, substitui a cidade herdada do líder. */
  cidadeOverride?: string | null
}

export type InsertMilitanciaLeadResult =
  | { ok: true; lead: { id: string; created_at: string } }
  | { ok: false; status: number; message: string }

/**
 * Insere em `leads_militancia` com `coordinator_id` resolvido pelo líder (mesma regra do formulário público).
 */
export async function insertMilitanciaLead(
  admin: MobilizacaoAdminClient,
  input: InsertMilitanciaLeadInput
): Promise<InsertMilitanciaLeadResult> {
  const nome = input.nome.trim()
  if (nome.length < 2) {
    return { ok: false, status: 400, message: 'Nome é obrigatório' }
  }

  const whatsapp = normalizeWhatsappDigits(input.whatsappRaw)
  if (whatsapp.length < 10 || whatsapp.length > 13) {
    return {
      ok: false,
      status: 400,
      message: 'WhatsApp inválido. Informe DDD e número (somente números).',
    }
  }

  const instagram = normalizeInstagramHandle(input.instagramRaw)
  const leaderRes = await fetchLeaderRowForMilitanciaLead(admin, input.leaderId)
  if (!leaderRes.ok) {
    return { ok: false, status: 404, message: leaderRes.message }
  }

  if (!leaderRes.leader.coordinator_id) {
    return {
      ok: false,
      status: 422,
      message: 'Liderança sem coordenação vinculada. Procure o administrador.',
    }
  }

  const cidade =
    input.cidadeOverride !== undefined && input.cidadeOverride !== null && String(input.cidadeOverride).trim() !== ''
      ? String(input.cidadeOverride).trim()
      : leaderRes.leader.cidade

  const { data: inserted, error: insertError } = await admin
    .from('leads_militancia')
    .insert({
      nome,
      whatsapp,
      instagram,
      cidade,
      leader_id: leaderRes.leader.id,
      coordinator_id: leaderRes.leader.coordinator_id,
      origem: input.origem.trim() || 'qr',
      status: 'ativo',
    })
    .select('id, created_at')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return { ok: false, status: 409, message: 'Já existe cadastro com este WhatsApp.' }
    }
    console.error('[insertMilitanciaLead]', insertError)
    return { ok: false, status: 500, message: 'Erro ao salvar cadastro' }
  }

  if (!inserted) {
    return { ok: false, status: 500, message: 'Erro ao salvar cadastro' }
  }

  return {
    ok: true,
    lead: { id: inserted.id as string, created_at: inserted.created_at as string },
  }
}
