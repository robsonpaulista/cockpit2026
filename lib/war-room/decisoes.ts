export type WarRoomDecisaoPrioridade =
  | 'critica'
  | 'alta'
  | 'media'
  | 'baixa'
  | 'info'

export type WarRoomDecisaoIcone =
  | 'alerta'
  | 'mensagem'
  | 'bandeira'
  | 'documento'
  | 'info'

export type WarRoomDecisaoStatus =
  | 'pendente'
  | 'em_andamento'
  | 'resolvida'
  | 'arquivada'

export type WarRoomDecisao = {
  id: string
  prioridade: WarRoomDecisaoPrioridade
  problema: string
  categoria: string
  hora: string
  icone: WarRoomDecisaoIcone
  destaque?: boolean
  contexto?: string
  responsavel?: string
  prazo?: string
  acao?: string
  href?: string
  status?: WarRoomDecisaoStatus
  createdAt?: string
}

export type WarRoomDecisaoRow = {
  id: string
  titulo: string
  prioridade: WarRoomDecisaoPrioridade
  categoria: string
  icone: WarRoomDecisaoIcone
  destaque: boolean
  status: WarRoomDecisaoStatus
  href: string | null
  contexto: string | null
  responsavel: string | null
  prazo: string | null
  acao: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

const PRIORIDADE_RANK: Record<WarRoomDecisaoPrioridade, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
  info: 4,
}

const WAR_ROOM_TZ = 'America/Sao_Paulo'

export function formatDecisaoHora(
  iso: string,
  timeZone: string = WAR_ROOM_TZ,
): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function mapDecisaoRow(row: WarRoomDecisaoRow): WarRoomDecisao {
  return {
    id: row.id,
    prioridade: row.prioridade,
    problema: row.titulo,
    categoria: row.categoria,
    hora: formatDecisaoHora(row.created_at),
    icone: row.icone,
    destaque: row.destaque,
    contexto: row.contexto ?? undefined,
    responsavel: row.responsavel ?? undefined,
    prazo: row.prazo ?? undefined,
    acao: row.acao ?? undefined,
    href: row.href ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function sortDecisoesByPrioridade(
  a: WarRoomDecisaoRow,
  b: WarRoomDecisaoRow,
): number {
  const rank =
    (PRIORIDADE_RANK[a.prioridade] ?? 99) - (PRIORIDADE_RANK[b.prioridade] ?? 99)
  if (rank !== 0) return rank
  if (a.destaque !== b.destaque) return a.destaque ? -1 : 1
  return b.created_at.localeCompare(a.created_at)
}
