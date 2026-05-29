import type { SupabaseClient } from '@supabase/supabase-js'
import type { PropostaFnsCompleta } from '@/lib/fns-proposta-normalize'
import { URL_CONSULTA_FNS } from '@/lib/fns-proposta-normalize'
import { municipioChave } from '@/lib/limites-tetos-db'

export interface PropostaFnsRow {
  exercicio: number
  municipio_chave: string
  municipio_nome: string
  ibge?: string | null
  nu_proposta: string
  co_tipo_proposta?: string | null
  ds_tipo_recurso?: string | null
  vl_proposta: number
  vl_pagar: number
  vl_pago: number
  dt_cadastramento?: string | null
  ds_situacao_proposta?: string | null
  nu_processo?: string | null
  constituido_processo: boolean
  payload: Record<string, unknown>
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

export function propostaFnsToRow(
  proposta: PropostaFnsCompleta,
  exercicio: number,
  ibge?: string,
): PropostaFnsRow {
  return {
    exercicio,
    municipio_chave: municipioChave(proposta.municipio),
    municipio_nome: proposta.municipio,
    ibge: ibge ?? null,
    nu_proposta: proposta.nuProposta,
    co_tipo_proposta: proposta.coTipoProposta || null,
    ds_tipo_recurso: proposta.dsTipoRecurso || null,
    vl_proposta: proposta.vlProposta,
    vl_pagar: proposta.vlPagar,
    vl_pago: proposta.vlPago,
    dt_cadastramento: proposta.dtCadastramento || null,
    ds_situacao_proposta: proposta.dsSituacaoProposta || null,
    nu_processo: proposta.nuProcesso || null,
    constituido_processo: proposta.constituidoProcesso,
    payload: {
      parlamentares: proposta.parlamentares,
      pagamentos: proposta.pagamentos,
      linhaPropostas: proposta.linhaPropostas,
      nmPrograma: proposta.nmPrograma,
      acao: proposta.acao,
    },
  }
}

export function rowToPropostaFns(row: PropostaFnsRow): PropostaFnsCompleta {
  const payload = row.payload ?? {}
  const parlamentares = Array.isArray(payload.parlamentares)
    ? (payload.parlamentares as string[])
    : []
  const pagamentos = Array.isArray(payload.pagamentos)
    ? (payload.pagamentos as PropostaFnsCompleta['pagamentos'])
    : []
  const linhaPropostas = Array.isArray(payload.linhaPropostas)
    ? (payload.linhaPropostas as Record<string, unknown>[])
    : []

  return {
    nuProposta: row.nu_proposta,
    municipio: row.municipio_nome,
    vlProposta: parseNum(row.vl_proposta),
    vlPagar: parseNum(row.vl_pagar),
    vlPago: parseNum(row.vl_pago),
    coTipoProposta: row.co_tipo_proposta ?? '',
    dsTipoRecurso: row.ds_tipo_recurso ?? '',
    dtCadastramento: row.dt_cadastramento ?? '',
    dsSituacaoProposta: row.ds_situacao_proposta ?? '',
    nuProcesso: row.nu_processo ?? 'N/A',
    constituidoProcesso: row.constituido_processo,
    parlamentares,
    pagamentos,
    linhaPropostas,
    nmPrograma:
      payload.nmPrograma != null ? String(payload.nmPrograma) : undefined,
    acao: payload.acao != null ? String(payload.acao) : undefined,
    urlConsultaFns: URL_CONSULTA_FNS,
    exercicio: row.exercicio,
  }
}

export async function getPropostasFnsArquivo(
  supabase: SupabaseClient,
  exercicio: number,
  municipioNome: string,
): Promise<PropostaFnsCompleta[]> {
  const chave = municipioChave(municipioNome)
  const { data, error } = await supabase
    .from('propostas_fns')
    .select('*')
    .eq('exercicio', exercicio)
    .eq('municipio_chave', chave)
    .order('vl_proposta', { ascending: false })

  if (error) {
    console.error('getPropostasFnsArquivo:', error)
    return []
  }

  return (data ?? []).map((row) => rowToPropostaFns(row as PropostaFnsRow))
}

export async function upsertPropostasFnsBatch(
  supabase: SupabaseClient,
  rows: PropostaFnsRow[],
): Promise<void> {
  const BATCH = 100
  const syncedAt = new Date().toISOString()

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((row) => ({
      ...row,
      synced_at: syncedAt,
    }))
    const { error } = await supabase
      .from('propostas_fns')
      .upsert(chunk, {
        onConflict: 'exercicio,municipio_chave,nu_proposta',
      })
    if (error) throw error
  }
}
