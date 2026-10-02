'use client'

import Link from 'next/link'
import type { LeaderGroupScore } from '@/lib/arena/types'
import { formatPts, initials } from '@/components/arena/arena-shell'
import { ArenaCrownIcon } from '@/components/arena/arena-icons'

type Props = {
  ranking: LeaderGroupScore[]
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
            <li key={item.leader.id}>
              <span className="arena-rank-list__pos">{i + 4}º</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{item.leader.name}</span>
              <span className="text-[var(--cx-muted,#686865)] text-xs">
                {item.leader.city ?? '—'} · {item.memberCount} liderados
              </span>
              <span className="arena-mono font-bold">{formatPts(item.totalPoints)}</span>
              <Link
                href={`/dashboard/mobilizacao/membros?lideranca=${item.leader.id}`}
                className="arena-podium__link"
              >
                Ver indicados
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

function PodiumSlot({ place, item }: { place: 1 | 2 | 3; item: LeaderGroupScore }) {
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
      <div className="arena-podium__avatar">{initials(item.leader.name)}</div>
      <h3 className="arena-podium__name">{item.leader.name}</h3>
      <p className="arena-podium__meta">
        {item.leader.city ?? '—'} · {item.memberCount} liderados
      </p>
      <p className="arena-podium__pts">{formatPts(item.totalPoints)} pts</p>
      <Link
        href={`/dashboard/mobilizacao/membros?lideranca=${item.leader.id}`}
        className="arena-podium__link"
      >
        Ver indicados
      </Link>
    </article>
  )
}
