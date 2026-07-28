'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { IconCheck, IconChevronRight, IconLoader2 } from '@tabler/icons-react'
import {
  WarRoomMiniPager,
  warRoomPageCount,
} from '@/components/war-room/war-room-mini-pager'
import type { WarRoomAgendaItem } from '@/lib/war-room/mock-data'
import { cn } from '@/lib/utils'

export type AgendaLiveStatus = 'concluido' | 'ao_vivo' | 'proximo'

const PAGE_SIZE = 4

export function parseAgendaMinutes(horario: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(horario.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function isAgendaMarkedDone(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return (
    normalized.includes('conclu') ||
    normalized === 'finalizada' ||
    normalized === 'finalizado' ||
    normalized === 'done'
  )
}

/** Status ao vivo: evento atual até o próximo começar; anteriores viram concluídos. */
export function resolveAgendaLiveStatus(
  items: WarRoomAgendaItem[],
  nowMinutes: number,
): Map<string, AgendaLiveStatus> {
  const sorted = [...items].sort((a, b) => a.horario.localeCompare(b.horario, 'pt-BR'))
  const result = new Map<string, AgendaLiveStatus>()

  for (let index = 0; index < sorted.length; index += 1) {
    const item = sorted[index]
    if (isAgendaMarkedDone(item.status)) {
      result.set(item.id, 'concluido')
      continue
    }

    const start = parseAgendaMinutes(item.horario)
    const nextStart =
      index < sorted.length - 1 ? parseAgendaMinutes(sorted[index + 1].horario) : null

    if (start == null) {
      result.set(item.id, 'proximo')
      continue
    }

    const endsAt = nextStart ?? Number.POSITIVE_INFINITY
    if (nowMinutes >= endsAt) {
      result.set(item.id, 'concluido')
    } else if (nowMinutes >= start) {
      result.set(item.id, 'ao_vivo')
    } else {
      result.set(item.id, 'proximo')
    }
  }

  return result
}

function AgendaTimeline({
  items,
  allItems,
  nowMinutes,
}: {
  items: WarRoomAgendaItem[]
  allItems: WarRoomAgendaItem[]
  nowMinutes: number
}) {
  const statuses = useMemo(
    () => resolveAgendaLiveStatus(allItems, nowMinutes),
    [allItems, nowMinutes],
  )

  return (
    <ol className="wr-agenda-dia__list" aria-label="Linha do tempo da agenda do dia">
      {items.map((item) => {
        const status = statuses.get(item.id) ?? 'proximo'
        return (
          <li
            key={item.id}
            className={cn(
              'wr-agenda-dia__item',
              status === 'ao_vivo' && 'wr-agenda-dia__item--live',
              status === 'concluido' && 'wr-agenda-dia__item--done',
              status === 'proximo' && 'wr-agenda-dia__item--next',
            )}
          >
            <time className="wr-agenda-dia__time" dateTime={item.horario}>
              {item.horario}
            </time>

            <div className="wr-agenda-dia__rail" aria-hidden>
              <span className="wr-agenda-dia__dot">
                {status === 'concluido' ? (
                  <IconCheck className="wr-agenda-dia__check" stroke={2.5} aria-hidden />
                ) : null}
              </span>
            </div>

            <div className="wr-agenda-dia__body">
              <p className="wr-agenda-dia__title">{item.titulo}</p>
              <p className="wr-agenda-dia__meta">{item.municipio}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

type Props = {
  items: WarRoomAgendaItem[]
  nowMinutes: number
  loading?: boolean
  error?: string | null
  badge?: ReactNode
  className?: string
}

/** Agenda do dia — timeline clean com marcadores de status. */
export function WarRoomAgendaCard({
  items,
  nowMinutes,
  loading = false,
  error = null,
  badge,
  className,
}: Props) {
  const [page, setPage] = useState(0)

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.horario.localeCompare(b.horario, 'pt-BR')),
    [items],
  )

  useEffect(() => {
    const pages = warRoomPageCount(sorted.length, PAGE_SIZE)
    if (page > pages - 1) setPage(Math.max(0, pages - 1))
  }, [page, sorted.length])

  const pagina = useMemo(() => {
    const start = page * PAGE_SIZE
    return sorted.slice(start, start + PAGE_SIZE)
  }, [page, sorted])

  return (
    <section
      id="wr-agenda"
      className={cn('wr-agenda-dia', 'wr-cell--agenda', className)}
      aria-label="Agenda do dia"
    >
      <header className="wr-agenda-dia__header">
        <div>
          <h2 className="wr-agenda-dia__heading">Agenda do dia</h2>
          <p className="wr-agenda-dia__sub">
            {sorted.length > 0
              ? `Compromissos de hoje · ${PAGE_SIZE} por página`
              : 'Compromissos de hoje'}
          </p>
        </div>
        {badge}
      </header>

      <div className="wr-agenda-dia__content">
        {loading ? (
          <div className="wr-agenda-dia__state">
            <IconLoader2 className="h-5 w-5 animate-spin text-[var(--wr-muted)]" stroke={1.5} />
          </div>
        ) : error ? (
          <p className="wr-agenda-dia__state wr-agenda-dia__state--error">{error}</p>
        ) : sorted.length === 0 ? (
          <p className="wr-agenda-dia__state">Nenhum compromisso para hoje.</p>
        ) : (
          <AgendaTimeline items={pagina} allItems={sorted} nowMinutes={nowMinutes} />
        )}
      </div>

      <div className="wr-agenda-dia__footer-bar">
        <WarRoomMiniPager
          page={page}
          total={sorted.length}
          pageSize={PAGE_SIZE}
          onChange={setPage}
          className="wr-agenda-dia__pager"
        />
        <Link href="/dashboard/agenda" className="wr-agenda-dia__footer">
          <span>Ver agenda completa</span>
          <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
        </Link>
      </div>
    </section>
  )
}
