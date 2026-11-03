import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchProgramasAbertosPI,
  oportunidadeParaLinhaDb,
} from '@/lib/services/transferegov-programas'

export type SyncOportunidadesResultado = {
  ok: boolean
  upserted: number
  totalFonte: number
  fonteAtualizacao: string | null
  origem: 'live' | 'db'
  erro?: string
  tableMissing?: boolean
}

function tabelaAusente(message: string): boolean {
  return /oportunidades_federais|schema cache|does not exist|relation/i.test(message)
}

/** Sincroniza programas abertos do Transferegov (PI) para o Supabase. */
export async function syncOportunidadesFederais(
  supabase: SupabaseClient,
): Promise<SyncOportunidadesResultado> {
  const { itens, fonteAtualizacao } = await fetchProgramasAbertosPI()
  const linhas = itens.map(oportunidadeParaLinhaDb)

  if (linhas.length === 0) {
    await supabase.from('oportunidades_federais_sync').upsert({
      id: 'transferegov',
      last_sync_at: new Date().toISOString(),
      last_source_update: fonteAtualizacao,
      last_status: 'ok',
      last_error: null,
      items_upserted: 0,
      updated_at: new Date().toISOString(),
    })
    return {
      ok: true,
      upserted: 0,
      totalFonte: 0,
      fonteAtualizacao,
      origem: 'live',
    }
  }

  const { error } = await supabase
    .from('oportunidades_federais')
    .upsert(linhas, { onConflict: 'id_programa,uf' })

  if (error) {
    const missing = tabelaAusente(error.message)
    await supabase.from('oportunidades_federais_sync').upsert({
      id: 'transferegov',
      last_sync_at: new Date().toISOString(),
      last_source_update: fonteAtualizacao,
      last_status: 'erro',
      last_error: error.message,
      items_upserted: 0,
      updated_at: new Date().toISOString(),
    }).then(() => undefined, () => undefined)
    return {
      ok: false,
      upserted: 0,
      totalFonte: itens.length,
      fonteAtualizacao,
      origem: 'live',
      erro: error.message,
      tableMissing: missing,
    }
  }

  // Remove do cache PI o que não voltou aberto nesta sincronização
  const idsAtivos = new Set(itens.map((i) => i.idPrograma))
  const { data: existentes } = await supabase
    .from('oportunidades_federais')
    .select('id, id_programa')
    .eq('uf', 'PI')
    .eq('fonte', 'transferegov')
  const staleIds = (existentes ?? [])
    .filter((r) => !idsAtivos.has(Number(r.id_programa)))
    .map((r) => r.id as string)
  if (staleIds.length > 0) {
    await supabase.from('oportunidades_federais').delete().in('id', staleIds)
  }

  await supabase.from('oportunidades_federais_sync').upsert({
    id: 'transferegov',
    last_sync_at: new Date().toISOString(),
    last_source_update: fonteAtualizacao,
    last_status: 'ok',
    last_error: null,
    items_upserted: linhas.length,
    updated_at: new Date().toISOString(),
  })

  return {
    ok: true,
    upserted: linhas.length,
    totalFonte: itens.length,
    fonteAtualizacao,
    origem: 'db',
  }
}
