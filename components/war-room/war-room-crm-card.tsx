'use client'

import Link from 'next/link'
import {
  IconBrandWhatsapp,
  IconCircleCheck,
  IconChevronRight,
  IconFlag,
  IconUser,
  type Icon,
} from '@tabler/icons-react'
import {
  WAR_ROOM_CRM_FUNNEL_STEPS,
  type WarRoomCrmFunnelIcone,
} from '@/lib/war-room/mock-data'
import { formatWarRoomPct } from '@/lib/war-room/format'
import { cn } from '@/lib/utils'

const ICON_BY_TIPO: Record<WarRoomCrmFunnelIcone, Icon> = {
  whatsapp: IconBrandWhatsapp,
  user: IconUser,
  check: IconCircleCheck,
  flag: IconFlag,
}

type Props = {
  className?: string
}

/** CRM / WhatsApp — funil de conversas em barras horizontais. */
export function WarRoomCrmCard({ className }: Props) {
  return (
    <section
      id="wr-crm"
      className={cn('wr-crm-funil', 'wr-cell--crm', className)}
      aria-label="CRM e WhatsApp — funil de conversas"
    >
      <header className="wr-crm-funil__header">
        <h2 className="wr-crm-funil__heading">CRM / WhatsApp – Funil de conversas</h2>
        <p className="wr-crm-funil__sub">Fluxo de atendimentos</p>
      </header>

      <ul className="wr-crm-funil__list" aria-label="Etapas do funil">
        {WAR_ROOM_CRM_FUNNEL_STEPS.map((step) => {
          const StepIcon = ICON_BY_TIPO[step.icone]
          return (
            <li key={step.key} className="wr-crm-funil__row">
              <span className="wr-crm-funil__icon" aria-hidden>
                <StepIcon className="h-3.5 w-3.5" stroke={1.6} />
              </span>
              <span className="wr-crm-funil__label truncate">{step.label}</span>
              <span className="wr-crm-funil__value tabular-nums">
                {step.value.toLocaleString('pt-BR')}
              </span>
              <div
                className="wr-crm-funil__bar"
                role="progressbar"
                aria-valuenow={step.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${step.label}: ${formatWarRoomPct(step.pct)}`}
              >
                <span
                  className="wr-crm-funil__bar-fill"
                  style={{ width: `${Math.min(100, Math.max(0, step.pct))}%` }}
                />
              </div>
              <span className="wr-crm-funil__pct tabular-nums">
                {formatWarRoomPct(step.pct)}
              </span>
            </li>
          )
        })}
      </ul>

      <Link href="/dashboard/whatsapp" className="wr-crm-funil__footer">
        <span>Acessar CRM</span>
        <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
      </Link>
    </section>
  )
}
