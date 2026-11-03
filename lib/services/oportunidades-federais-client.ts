import type { OportunidadeFederal } from '@/lib/oportunidades-federais'
import type {
  AlertaPrazoOportunidade,
  BaseCruzamento,
} from '@/lib/services/oportunidades-federais-cruzamento'

export type OportunidadesFederaisResponse = {
  itens: OportunidadeFederal[]
  origem: 'db' | 'live'
  /** Programas com UF=PI no Transferegov, mas foco regional em outro território. */
  excluidosForaPi?: number
  base?: BaseCruzamento | null
  alertas?: AlertaPrazoOportunidade[]
  aviso?: string | null
  sync?: {
    last_sync_at?: string | null
    last_source_update?: string | null
    last_status?: string | null
    items_upserted?: number | null
  } | null
  error?: string
}

async function lerJson(res: Response): Promise<OportunidadesFederaisResponse & Record<string, unknown>> {
  const json: unknown = await res.json().catch(() => null)
  return json && typeof json === 'object'
    ? (json as OportunidadesFederaisResponse & Record<string, unknown>)
    : { itens: [], origem: 'live' }
}

function normalizar(json: OportunidadesFederaisResponse & Record<string, unknown>): OportunidadesFederaisResponse {
  return {
    itens: Array.isArray(json.itens) ? json.itens : [],
    origem: json.origem === 'db' ? 'db' : 'live',
    excluidosForaPi: typeof json.excluidosForaPi === 'number' ? json.excluidosForaPi : 0,
    base: json.base && typeof json.base === 'object' ? (json.base as BaseCruzamento) : null,
    alertas: Array.isArray(json.alertas) ? (json.alertas as AlertaPrazoOportunidade[]) : [],
    aviso: typeof json.aviso === 'string' ? json.aviso : null,
    sync: json.sync ?? null,
  }
}

export async function fetchOportunidadesFederais(): Promise<OportunidadesFederaisResponse> {
  const res = await fetch('/api/oportunidades-federais', { cache: 'no-store' })
  const json = await lerJson(res)
  if (!res.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Erro ao carregar oportunidades.')
  }
  return normalizar(json)
}

export async function sincronizarOportunidadesFederais(): Promise<OportunidadesFederaisResponse> {
  const res = await fetch('/api/oportunidades-federais', { method: 'POST', cache: 'no-store' })
  const json = await lerJson(res)
  if (!res.ok && !Array.isArray(json.itens)) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Erro ao sincronizar.')
  }
  return normalizar(json)
}
