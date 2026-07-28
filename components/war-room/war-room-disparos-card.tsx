'use client'

import Link from 'next/link'
import { IconChevronRight, IconSend } from '@tabler/icons-react'
import { WAR_ROOM_DISPAROS, type WarRoomDisparoStatus } from '@/lib/war-room/mock-data'
import { formatWarRoomPct } from '@/lib/war-room/format'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

function barTone(status: WarRoomDisparoStatus | undefined): string {
  if (status === 'critico') return 'wr-disparos-clean__bar-fill--critico'
  if (status === 'atencao') return 'wr-disparos-clean__bar-fill--atencao'
  return 'wr-disparos-clean__bar-fill--ok'
}

/** Disparos recentes — mesmo shell visual do funil CRM. */
export function WarRoomDisparosCard({ className }: Props) {
  return (
    <section
      id="wr-disparos"
      className={cn('wr-disparos-clean', 'wr-cell--disparos', className)}
      aria-label="Disparos recentes"
    >
      <header className="wr-disparos-clean__header">
        <h2 className="wr-disparos-clean__heading">Disparos recentes</h2>
        <p className="wr-disparos-clean__sub">Campanhas de WhatsApp</p>
      </header>

      <ul className="wr-disparos-clean__list" aria-label="Últimos disparos">
        {WAR_ROOM_DISPAROS.slice(0, 6).map((row) => (
          <li
            key={row.campanha}
            className="wr-disparos-clean__row"
            title={`${row.campanha} · ${row.publico}`}
          >
            <span className="wr-disparos-clean__icon" aria-hidden>
              <IconSend className="h-3.5 w-3.5" stroke={1.6} />
            </span>
            <span className="wr-disparos-clean__label truncate">{row.campanha}</span>
            <span className="wr-disparos-clean__value tabular-nums">
              {row.enviados.toLocaleString('pt-BR')}
            </span>
            <div
              className="wr-disparos-clean__bar"
              role="progressbar"
              aria-valuenow={row.clicksPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${row.campanha}: CTR ${formatWarRoomPct(row.clicksPct)}`}
            >
              <span
                className={cn(
                  'wr-disparos-clean__bar-fill',
                  barTone(row.status),
                )}
                style={{ width: `${Math.min(100, Math.max(0, row.clicksPct))}%` }}
              />
            </div>
            <span className="wr-disparos-clean__pct tabular-nums">
              {formatWarRoomPct(row.clicksPct)}
            </span>
          </li>
        ))}
      </ul>

      <Link href="/dashboard/whatsapp" className="wr-disparos-clean__footer">
        <span>Ver todos</span>
        <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
      </Link>
    </section>
  )
}
