'use client'

import { cn } from '@/lib/utils'
import {
  formatDeltaPosicoes,
  formatRankPosicao,
  type InstagramRankingMovimentacaoRow,
} from '@/lib/war-room/instagram-radar-desempenho'

type Props = {
  rows: InstagramRankingMovimentacaoRow[]
  className?: string
}

/** Ranking início → fim do período (variação de posição). */
export function WarRoomInstagramRadarDesempenhoView({ rows, className }: Props) {
  if (rows.length === 0) {
    return (
      <p className="wr-ig-radar__state">
        Sem posts suficientes no período para comparar o ranking.
      </p>
    )
  }

  return (
    <ul
      className={cn('wr-ig-radar__list wr-ig-radar__list--mov', className)}
      aria-label="Movimentação de ranking no período"
    >
      <li className="wr-ig-radar__row wr-ig-radar__row--head wr-ig-radar__row--mov" aria-hidden>
        <span>@</span>
        <span>Início</span>
        <span>Acum.</span>
        <span>Var</span>
      </li>
      {rows.map((row) => {
        const handle = row.username ? `@${row.username}` : row.name
        const delta = row.deltaPosicoes
        const title = [
          handle,
          `início ${formatRankPosicao(row.rankInicio)}`,
          `acumulado ${formatRankPosicao(row.rankFim)}`,
          delta === 0
            ? 'sem variação'
            : delta > 0
              ? `subiu ${delta} posiç${delta === 1 ? 'ão' : 'ões'}`
              : `caiu ${Math.abs(delta)} posiç${Math.abs(delta) === 1 ? 'ão' : 'ões'}`,
        ].join(' · ')

        return (
          <li
            key={row.slug}
            className="wr-ig-radar__row wr-ig-radar__row--mov"
            title={title}
          >
            <span
              className={cn(
                'wr-ig-radar__handle truncate',
                !row.username && 'wr-ig-radar__handle--warn',
              )}
            >
              {handle}
            </span>
            <span className="wr-ig-radar__rank tabular-nums">
              {formatRankPosicao(row.rankInicio)}
            </span>
            <span className="wr-ig-radar__rank wr-ig-radar__rank--fim tabular-nums">
              {formatRankPosicao(row.rankFim)}
            </span>
            <span
              className={cn(
                'wr-ig-radar__delta tabular-nums',
                delta > 0 && 'wr-ig-radar__delta--up',
                delta < 0 && 'wr-ig-radar__delta--down',
              )}
            >
              {formatDeltaPosicoes(delta)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
