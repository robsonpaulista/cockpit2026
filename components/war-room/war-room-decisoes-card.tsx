'use client'

import Link from 'next/link'
import {
  IconAlertTriangleFilled,
  IconChevronRight,
  IconFileText,
  IconFlag,
  IconInfoCircle,
  IconMessageCircle,
  type Icon,
} from '@tabler/icons-react'
import {
  WAR_ROOM_DECISOES,
  WAR_ROOM_DECISOES_TOTAL,
  type WarRoomDecisao,
  type WarRoomDecisaoIcone,
  type WarRoomDecisaoPrioridade,
} from '@/lib/war-room/mock-data'
import { cn } from '@/lib/utils'

const PRIORIDADE_LABEL: Record<WarRoomDecisaoPrioridade, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
  info: 'Info',
}

const ICON_BY_TIPO: Record<WarRoomDecisaoIcone, Icon> = {
  alerta: IconAlertTriangleFilled,
  mensagem: IconMessageCircle,
  bandeira: IconFlag,
  documento: IconFileText,
  info: IconInfoCircle,
}

function DecisaoItem({ decisao }: { decisao: WarRoomDecisao }) {
  const ItemIcon = ICON_BY_TIPO[decisao.icone]
  const content = (
    <>
      <span
        className={cn(
          'wr-decisoes-fila__icon',
          decisao.destaque && 'wr-decisoes-fila__icon--alerta',
        )}
        aria-hidden
      >
        <ItemIcon className="h-[18px] w-[18px]" stroke={1.6} />
      </span>

      <div className="wr-decisoes-fila__body min-w-0 flex-1">
        <p className="wr-decisoes-fila__title truncate">{decisao.problema}</p>
        <p className="wr-decisoes-fila__meta truncate">
          Prioridade: {PRIORIDADE_LABEL[decisao.prioridade]}
          <span aria-hidden> • </span>
          {decisao.categoria}
        </p>
      </div>

      <time className="wr-decisoes-fila__hora shrink-0 tabular-nums" dateTime={decisao.hora}>
        {decisao.hora}
      </time>
    </>
  )

  const itemClass = cn(
    'wr-decisoes-fila__item',
    decisao.destaque && 'wr-decisoes-fila__item--destaque',
  )

  if (decisao.href) {
    return (
      <li>
        <Link href={decisao.href} className={itemClass}>
          {content}
        </Link>
      </li>
    )
  }

  return <li className={itemClass}>{content}</li>
}

type Props = {
  className?: string
}

/** Fila de decisões / alertas — lista clean com destaque na prioridade mais urgente. */
export function WarRoomDecisoesCard({ className }: Props) {
  return (
    <section
      id="wr-decisoes"
      className={cn('wr-decisoes-fila', 'wr-cell--decisoes', className)}
      aria-label="Fila de decisões e alertas"
    >
      <header className="wr-decisoes-fila__header">
        <h2 className="wr-decisoes-fila__heading">Fila de decisões / alertas</h2>
        <p className="wr-decisoes-fila__sub">Prioridades operacionais</p>
      </header>

      {WAR_ROOM_DECISOES.length === 0 ? (
        <p className="wr-decisoes-fila__empty">Nenhuma decisão pendente no momento.</p>
      ) : (
        <ul className="wr-decisoes-fila__list">
          {WAR_ROOM_DECISOES.map((decisao) => (
            <DecisaoItem key={decisao.id} decisao={decisao} />
          ))}
        </ul>
      )}

      <Link href="/dashboard/operacao" className="wr-decisoes-fila__footer">
        <span>Ver todas ({WAR_ROOM_DECISOES_TOTAL})</span>
        <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
      </Link>
    </section>
  )
}
