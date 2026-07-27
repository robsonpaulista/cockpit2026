'use client'

import Link from 'next/link'
import {
  IconAlertTriangleFilled,
  IconChartBar,
  IconChartDots3,
  IconChevronRight,
  IconMapPin,
  IconPackage,
  IconPhoto,
  IconSend,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react'
import {
  WAR_ROOM_FEED,
  type WarRoomFeedItem,
  type WarRoomFeedTipo,
} from '@/lib/war-room/mock-data'
import { cn } from '@/lib/utils'

const FEED_VISIBLE = 5

const FEED_ICON_BY_TIPO: Record<WarRoomFeedTipo, Icon> = {
  pesquisa: IconChartDots3,
  visita: IconMapPin,
  expectativa: IconChartBar,
  conteudo: IconPhoto,
  mobilizacao: IconUsersGroup,
  alerta: IconAlertTriangleFilled,
  material: IconPackage,
  disparo: IconSend,
}

function FeedItem({
  item,
  destaque,
}: {
  item: WarRoomFeedItem
  destaque?: boolean
}) {
  const ItemIcon = FEED_ICON_BY_TIPO[item.tipo]
  const isAlerta = item.tipo === 'alerta'

  return (
    <li>
      <div
        className={cn(
          'wr-decisoes-fila__item',
          destaque && 'wr-decisoes-fila__item--destaque',
        )}
      >
        <span
          className={cn(
            'wr-decisoes-fila__icon',
            (destaque || isAlerta) && 'wr-decisoes-fila__icon--alerta',
          )}
          aria-hidden
        >
          <ItemIcon className="h-[18px] w-[18px]" stroke={1.6} />
        </span>

        <div className="wr-decisoes-fila__body min-w-0 flex-1">
          <p className="wr-decisoes-fila__title truncate">{item.acao}</p>
          <p className="wr-decisoes-fila__meta truncate">
            {item.responsavel ?? 'Sistema'}
            <span aria-hidden> • </span>
            {item.modulo}
          </p>
        </div>

        <time className="wr-decisoes-fila__hora shrink-0 tabular-nums" dateTime={item.hora}>
          {item.hora}
        </time>
      </div>
    </li>
  )
}

type Props = {
  className?: string
}

/** Linha viva — mesmo design clean da fila de decisões / alertas. */
export function WarRoomFeedCard({ className }: Props) {
  const visible = WAR_ROOM_FEED.slice(0, FEED_VISIBLE)
  const total = WAR_ROOM_FEED.length

  return (
    <section
      id="wr-feed"
      className={cn('wr-decisoes-fila', 'wr-cell--feed', className)}
      aria-label="Linha viva"
    >
      <header className="wr-decisoes-fila__header">
        <h2 className="wr-decisoes-fila__heading">Linha viva</h2>
        <p className="wr-decisoes-fila__sub">Eventos do dia</p>
      </header>

      {visible.length === 0 ? (
        <p className="wr-decisoes-fila__empty">Nenhum evento registrado ainda hoje.</p>
      ) : (
        <ul className="wr-decisoes-fila__list" aria-label="Linha do tempo de eventos operacionais">
          {visible.map((item, index) => (
            <FeedItem key={item.id} item={item} destaque={index === 0} />
          ))}
        </ul>
      )}

      <Link href="/dashboard/operacao" className="wr-decisoes-fila__footer">
        <span>Ver todas ({total})</span>
        <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
      </Link>
    </section>
  )
}
