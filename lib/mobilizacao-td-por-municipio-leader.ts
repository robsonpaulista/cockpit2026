import {
  getTerritorioDesenvolvimentoPI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'

/** Campos mínimos do join `leaders` em `leads_militancia` para resolver o TD. */
export type LeaderJoinLike = {
  municipio?: string | null
  cidade?: string | null
}

export type LeadRowLike = {
  cidade?: string | null
  leaders?: LeaderJoinLike | LeaderJoinLike[] | null
}

export type LeaderRowLike = {
  municipio?: string | null
  cidade?: string | null
}

/**
 * Território de desenvolvimento (TD) pela base oficial de municípios do mapa,
 * a partir do município/cidade da **liderança** — não pela região do coordenador.
 */
export function tdTerritorialPorLeaderRowLike(row: LeaderRowLike): TerritorioDesenvolvimentoPI | null {
  const raw =
    (typeof row.municipio === 'string' && row.municipio.trim()) ||
    (typeof row.cidade === 'string' && row.cidade.trim()) ||
    ''
  if (!raw) return null
  return getTerritorioDesenvolvimentoPI(raw)
}

/**
 * TD a partir do município da liderança vinculada ao liderado; fallback para `cidade` do lead.
 */
export function tdTerritorialPorLeadRowLike(row: LeadRowLike): TerritorioDesenvolvimentoPI | null {
  const L = row.leaders
  const leader = Array.isArray(L) ? L[0] : L
  const fromLeader =
    (leader?.municipio && String(leader.municipio).trim()) ||
    (leader?.cidade && String(leader.cidade).trim()) ||
    ''
  const raw = fromLeader || (typeof row.cidade === 'string' ? row.cidade.trim() : '') || ''
  if (!raw) return null
  return getTerritorioDesenvolvimentoPI(raw)
}
