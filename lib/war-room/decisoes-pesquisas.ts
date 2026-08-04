import type { WarRoomDecisao, WarRoomDecisaoPrioridade } from '@/lib/war-room/decisoes'
import {
  mapUltimaPesquisaPorMunicipio,
  type WarRoomPesquisaConsolidadaReal,
} from '@/lib/war-room/pesquisas-consolidadas'

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

  for (const [cidadeKey, row] of mapUltimaPesquisaPorMunicipio(rows)) {
    if (row.jadyelNaoPontuou) {
      const pctTxt =
        row.jadyelPct != null && Number.isFinite(row.jadyelPct)
          ? `${Math.round(row.jadyelPct)}%`
          : '0%'
      out.push({
        id: `pesquisa-fora-top${topN}:${cidadeKey}`,
        prioridade: 'alta',
        problema: `Não pontuou · ${row.cidade}`,
        categoria: 'Pesquisas',
        hora: row.dataLabel,
        icone: 'alerta',
        destaque: true,
        contexto: cidadeKey,
        prazo: row.dataLabel,
        acao: `${candidatoLabel} NP · ${pctTxt} · ${row.instituto || 'Instituto'} · ${row.cenario}`,
        href: '/dashboard/pesquisa',
        status: 'pendente',
        createdAt: `${row.data.includes('T') ? row.data : `${row.data}T12:00:00`}`,
      })
      continue
    }

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
