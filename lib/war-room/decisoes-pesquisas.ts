import { normalizeIptMunicipio } from '@/lib/ipt'
import type { WarRoomDecisao, WarRoomDecisaoPrioridade } from '@/lib/war-room/decisoes'
import type { WarRoomPesquisaConsolidadaReal } from '@/lib/war-room/pesquisas-consolidadas'

const TOP_N = 5

const PRIORIDADE_RANK: Record<WarRoomDecisaoPrioridade, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
  info: 4,
}

function prioridadePorPosicao(posicao: number): WarRoomDecisaoPrioridade {
  if (posicao >= 10) return 'alta'
  if (posicao > TOP_N) return 'media'
  return 'baixa'
}

/**
 * Última onda por cidade (data desc). Ondas mais antigas da mesma
 * cidade são ignoradas — mesmo que tenham sido fora do top N.
 */
function ultimaOndaPorCidade(
  rows: WarRoomPesquisaConsolidadaReal[],
): Map<string, WarRoomPesquisaConsolidadaReal> {
  const sorted = [...rows].sort((a, b) => {
    const byDate = b.data.localeCompare(a.data)
    if (byDate !== 0) return byDate
    return a.cidade.localeCompare(b.cidade, 'pt-BR')
  })

  const latest = new Map<string, WarRoomPesquisaConsolidadaReal>()
  for (const row of sorted) {
    const cidadeKey = normalizeIptMunicipio(row.cidade)
    if (!cidadeKey || latest.has(cidadeKey)) continue
    latest.set(cidadeKey, row)
  }
  return latest
}

/**
 * Alertas da fila: só a pesquisa mais atual de cada cidade.
 * Se nessa onda o candidato foco (Jadyel) está fora do top 5 → alerta.
 * Se já recuperou o top 5 numa onda mais nova, a antiga fora do top 5
 * não gera alerta.
 */
export function buildDecisoesPesquisasForaTop5(
  rows: WarRoomPesquisaConsolidadaReal[],
  opts?: { candidatoLabel?: string; topN?: number },
): WarRoomDecisao[] {
  const topN = opts?.topN ?? TOP_N
  const candidatoLabel = (opts?.candidatoLabel ?? 'Jadyel').trim() || 'Jadyel'
  const out: WarRoomDecisao[] = []

  for (const [cidadeKey, row] of ultimaOndaPorCidade(rows)) {
    const posicao = row.jadyelPosicao
    if (posicao == null || !Number.isFinite(posicao) || posicao <= topN) continue

    const prioridade = prioridadePorPosicao(posicao)
    const pctTxt =
      row.jadyelPct != null && Number.isFinite(row.jadyelPct)
        ? `${Math.round(row.jadyelPct)}%`
        : '—'

    out.push({
      id: `pesquisa-fora-top${topN}:${cidadeKey}`,
      prioridade,
      problema: `Fora do top ${topN} · ${row.cidade}`,
      categoria: 'Pesquisas',
      hora: row.dataLabel,
      icone: 'alerta',
      destaque: prioridade === 'alta',
      contexto: cidadeKey,
      prazo: row.dataLabel,
      acao: `${candidatoLabel} em ${posicao}º · ${pctTxt} · ${row.instituto || 'Instituto'}`,
      href: '/dashboard/pesquisa',
      status: 'pendente',
      createdAt: `${row.data.includes('T') ? row.data : `${row.data}T12:00:00`}`,
    })
  }

  return out.sort((a, b) => {
    const rank =
      (PRIORIDADE_RANK[a.prioridade] ?? 99) - (PRIORIDADE_RANK[b.prioridade] ?? 99)
    if (rank !== 0) return rank
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  })
}
