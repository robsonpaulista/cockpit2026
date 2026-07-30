'use client'

import { cn } from '@/lib/utils'
import type { NoticiasDesempenhoRow } from '@/lib/war-room/noticias-desempenho'

type Props = {
  rows: NoticiasDesempenhoRow[]
  className?: string
}

/** Ranking Nome · Qtde · Portal mais frequente. */
export function WarRoomNoticiasDesempenhoView({ rows, className }: Props) {
  if (rows.length === 0) {
    return (
      <p className="wr-noticias-clean__state">Nenhuma menção no período.</p>
    )
  }

  return (
    <ul
      className={cn('wr-noticias-desempenho__list', className)}
      aria-label="Desempenho de notícias por candidato"
    >
      <li className="wr-noticias-desempenho__row wr-noticias-desempenho__row--head" aria-hidden>
        <span>Nome</span>
        <span>Qtde</span>
        <span>Portal mais frequente</span>
      </li>
      {rows.map((row) => (
        <li
          key={row.id}
          className="wr-noticias-desempenho__row"
          title={
            row.qtde > 0
              ? `${row.nome} · ${row.qtde} · ${row.portal}${
                  row.portalCount > 0 ? ` (${row.portalCount})` : ''
                }`
              : `${row.nome} · sem menções`
          }
        >
          <span className="wr-noticias-desempenho__nome truncate">{row.nome}</span>
          <span className="wr-noticias-desempenho__qtde tabular-nums">{row.qtde}</span>
          <span className="wr-noticias-desempenho__portal truncate">
            {row.qtde > 0 ? row.portal : '—'}
          </span>
        </li>
      ))}
    </ul>
  )
}
