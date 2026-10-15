'use client'

import Link from 'next/link'
import { initials } from '@/components/arena/arena-shell'
import { ArenaCrownIcon } from '@/components/arena/arena-icons'

export type ArenaPodiumItem = {
  id: string
  nome: string
  cidade: string | null
  detalhe: string
  /** Valor já formatado (ex.: "1.234 pts" ou "12 comentários"). */
  valor: string
  href: string
}

type Props = {
  ranking: ArenaPodiumItem[]
}

export function ArenaPodium({ ranking }: Props) {
  const top = ranking.slice(0, 3)
  const rest = ranking.slice(3)
  const second = top[1]
  const first = top[0]
  const third = top[2]

  return (
    <div>
      <div className="arena-podium">
        {second ? <PodiumSlot place={2} item={second} /> : <div />}
        {first ? <PodiumSlot place={1} item={first} /> : <div />}
        {third ? <PodiumSlot place={3} item={third} /> : <div />}
      </div>
      {rest.length > 0 ? (
        <ol className="arena-rank-list">
          {rest.map((item, i) => (
            <li key={item.id}>
              <span className="arena-rank-list__pos">{i + 4}º</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{item.nome}</span>
              <span className="text-[var(--cx-muted,#686865)] text-xs">
                {item.cidade ?? '—'} · {item.detalhe}
              </span>
              <span className="arena-mono font-bold">{item.valor}</span>
              <Link href={item.href} className="arena-podium__link">
                Ver painel
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

function PodiumSlot({ place, item }: { place: 1 | 2 | 3; item: ArenaPodiumItem }) {
  return (
    <article
      className={`arena-podium__slot arena-podium__slot--${place}${place === 1 ? ' arena-card--elevated' : ''}`}
    >
      {place === 1 ? <div className="arena-podium__glow" aria-hidden /> : null}
      {place === 1 ? (
        <div className="arena-podium__crown">
          <ArenaCrownIcon />
        </div>
      ) : (
        <p className="arena-mono mb-1 text-sm font-bold text-[var(--cx-label,#969692)]">{place}º</p>
      )}
      <div className="arena-podium__avatar">{initials(item.nome)}</div>
      <h3 className="arena-podium__name">{item.nome}</h3>
      <p className="arena-podium__meta">
        {item.cidade ?? '—'} · {item.detalhe}
      </p>
      <p className="arena-podium__pts">{item.valor}</p>
      <Link href={item.href} className="arena-podium__link">
        Ver painel
      </Link>
    </article>
  )
}
