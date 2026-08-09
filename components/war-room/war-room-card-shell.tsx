'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  WAR_ROOM_CARD_STATUS_LABEL,
  type WarRoomCardStatus,
} from '@/lib/war-room/card-status'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  subtitle?: string
  status?: WarRoomCardStatus
  statusDetail?: string
  href?: string
  linkLabel?: string
  icon?: LucideIcon
  badge?: ReactNode
  className?: string
  contentClassName?: string
  scrollable?: boolean
  children: ReactNode
  'aria-label'?: string
  id?: string
}

/**
 * Shell padrão dos cards da War Room — estado operacional na linha superior.
 */
export function WarRoomCardShell({
  title,
  subtitle,
  status = 'ok',
  statusDetail,
  href,
  linkLabel = 'Ver detalhes',
  icon: IconCmp,
  badge,
  className,
  contentClassName,
  scrollable = false,
  children,
  'aria-label': ariaLabel,
  id,
}: Props) {
  return (
    <section
      id={id}
      className={cn('wr-card', `wr-card--${status}`, className)}
      aria-label={ariaLabel ?? title}
      data-status={status}
    >
      <div className="wr-card__status" aria-label={`Status: ${WAR_ROOM_CARD_STATUS_LABEL[status]}`}>
        <span className="wr-card__status-dot" aria-hidden />
        <span className="wr-card__status-label">{WAR_ROOM_CARD_STATUS_LABEL[status]}</span>
        {statusDetail ? (
          <span className="wr-card__status-detail truncate" title={statusDetail}>
            {statusDetail}
          </span>
        ) : null}
      </div>

      <div className="wr-card__header">
        <div className="wr-card__heading-block">
          <h2 className="wr-card__title">
            {IconCmp ? (
              <IconCmp className="wr-card__title-icon" strokeWidth={1.5} aria-hidden />
            ) : null}
            <span className="truncate">{title}</span>
            {badge}
          </h2>
          {subtitle ? <p className="wr-card__sub">{subtitle}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="wr-card__link">
            {linkLabel}
          </Link>
        ) : null}
      </div>

      <div
        className={cn(
          'wr-card__body',
          scrollable && 'wr-card__body--scroll',
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  )
}
