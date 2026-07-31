import type { WarRoomDecisao, WarRoomDecisaoPrioridade } from '@/lib/war-room/decisoes'

export type WarRoomDecisaoSecaoId = 'urgente' | 'atencao' | 'verificar' | 'outros'

export type WarRoomDecisaoSecao = {
  id: WarRoomDecisaoSecaoId
  label: string
  /** Texto curto sob o título da seção (opcional). */
  hint?: string
  items: WarRoomDecisao[]
}

const PRIORIDADE_RANK: Record<WarRoomDecisaoPrioridade, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
  info: 4,
}

/** Seções fixas da fila (ordem de exibição). */
export const WAR_ROOM_DECISAO_SECOES: Array<{
  id: Exclude<WarRoomDecisaoSecaoId, 'outros'>
  label: string
  hint: string
}> = [
  {
    id: 'urgente',
    label: 'Urgente',
    hint: 'Viagens com fluxo incompleto — hoje e próximos 2 dias',
  },
  {
    id: 'atencao',
    label: 'Atenção',
    hint: 'Pesquisas fora do top 5',
  },
  {
    id: 'verificar',
    label: 'Verificar',
    hint: 'Redes sociais em destaque',
  },
]

export function secaoIdForDecisao(decisao: WarRoomDecisao): WarRoomDecisaoSecaoId {
  const cat = (decisao.categoria ?? '').trim()
  if (cat === 'Visita agendada') return 'urgente'
  if (cat === 'Pesquisas') return 'atencao'
  if (cat === 'Redes sociais') return 'verificar'
  return 'outros'
}

function sortSecaoItems(a: WarRoomDecisao, b: WarRoomDecisao): number {
  const rank =
    (PRIORIDADE_RANK[a.prioridade] ?? 99) - (PRIORIDADE_RANK[b.prioridade] ?? 99)
  if (rank !== 0) return rank
  if (Boolean(a.destaque) !== Boolean(b.destaque)) return a.destaque ? -1 : 1
  return (a.createdAt ?? a.hora ?? '').localeCompare(b.createdAt ?? b.hora ?? '')
}

/**
 * Agrupa alertas nas seções Urgente / Atenção / Verificar.
 * Itens fora dessas categorias ficam em `outros` (modal).
 */
export function groupDecisoesPorSecao(
  items: WarRoomDecisao[],
  opts?: { includeOutros?: boolean },
): WarRoomDecisaoSecao[] {
  const buckets: Record<WarRoomDecisaoSecaoId, WarRoomDecisao[]> = {
    urgente: [],
    atencao: [],
    verificar: [],
    outros: [],
  }

  for (const item of items) {
    buckets[secaoIdForDecisao(item)].push(item)
  }

  for (const key of Object.keys(buckets) as WarRoomDecisaoSecaoId[]) {
    buckets[key].sort(sortSecaoItems)
  }

  const secoes: WarRoomDecisaoSecao[] = WAR_ROOM_DECISAO_SECOES.map((s) => ({
    id: s.id,
    label: s.label,
    hint: s.hint,
    items: buckets[s.id],
  }))

  if (opts?.includeOutros && buckets.outros.length > 0) {
    secoes.push({
      id: 'outros',
      label: 'Outros',
      hint: 'Notícias e demais alertas',
      items: buckets.outros,
    })
  }

  return secoes
}
