'use client'

import { IconMapPin } from '@tabler/icons-react'
import { cn, parseDateOnlyLocal } from '@/lib/utils'
import {
  typographyBodyClass,
  typographyBodyMediumClass,
  typographyBodyMutedClass,
  typographySectionLabelClass,
  typographySectionTitleClass,
} from '@/lib/typography-chrome'

export type CampoResumoCityBar = {
  name: string
  count: number
}

export type CampoResumoAgendaItem = {
  id: string
  date: string
  type: string
  cityName: string
}

export type CampoResumoMonthBucket = {
  key: string
  label: string
  value: number
  monthIndex: number
  year: number
}

const CITY_RANK_COLORS = ['#185FA5', '#378ADD', '#85B7EB', '#B5D4F4', '#D3D1C7'] as const
const AGENDA_DOT_COLORS = ['#185FA5', '#378ADD', '#B5D4F4'] as const

function formatAgendaDate(date: string): string {
  const d = parseDateOnlyLocal(date)
  if (!d) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace(/\.$/, '').trim()
  return `${day} ${month}. ${d.getFullYear()}`
}

function formatMonthLabel(label: string): string {
  const trimmed = label.replace(/\.$/, '').trim()
  const short = trimmed.length >= 3 ? trimmed.slice(0, 3) : trimmed
  return `${short.charAt(0).toUpperCase()}${short.slice(1).toLowerCase()}.`
}

function agendaTypeBadge(type: string): { label: string; className: string } {
  const normalized = type.toLowerCase()
  if (normalized === 'visita') {
    return {
      label: 'Visita',
      className: 'border border-[#B5D4F4] bg-[#E6F1FB] text-[rgb(var(--color-primary))]',
    }
  }
  if (normalized === 'reuniao') {
    return {
      label: 'Reunião',
      className: 'border border-[#C0DD97] bg-[#EAF3DE] text-[#3B6D11]',
    }
  }
  if (normalized === 'evento') {
    return {
      label: 'Evento',
      className: 'border border-[#FAC775] bg-[#FAEEDA] text-[#854F0B]',
    }
  }
  if (normalized === 'viagem') {
    return {
      label: 'Viagem',
      className: 'border border-[#AFA9EC] bg-[#EEEDFE] text-[#534AB7]',
    }
  }
  return {
    label: type.charAt(0).toUpperCase() + type.slice(1),
    className: 'border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-app text-text-secondary',
  }
}

interface CampoResumoWidgetProps {
  totalAgendas: number
  cityBars: CampoResumoCityBar[]
  recentAgendas: CampoResumoAgendaItem[]
  monthBuckets: CampoResumoMonthBucket[]
}

export function CampoResumoWidget({
  totalAgendas,
  cityBars,
  recentAgendas,
  monthBuckets,
}: CampoResumoWidgetProps) {
  const cityMax = cityBars[0]?.count ?? 1
  const monthMax = Math.max(...monthBuckets.map((m) => Math.round(m.value)), 1)
  const now = new Date()
  const lastBucket = monthBuckets[monthBuckets.length - 1]
  const showCurrentMonthNote =
    lastBucket != null &&
    lastBucket.monthIndex === now.getMonth() &&
    lastBucket.year === now.getFullYear()

  return (
    <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-4">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconMapPin className="h-4 w-4 shrink-0 text-[rgb(var(--color-primary))]" stroke={1.5} aria-hidden />
          <h2 className={typographySectionTitleClass}>Resumo de campo</h2>
        </div>
        <span className={typographyBodyMutedClass}>{totalAgendas} agendas no total</span>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1.4fr] items-stretch gap-0">
        <div className="flex min-h-0 flex-col border-r border-[rgb(var(--color-border-tertiary)/0.85)] pr-4 mr-4">
          <p className={cn('mb-2.5 shrink-0', typographySectionLabelClass)}>
            Presença por cidade
          </p>
          {cityBars.length === 0 ? (
            <p className={typographyBodyMutedClass}>Sem dados de presença ainda.</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-between">
              {cityBars.map((city, index) => (
                <div key={city.name} className="flex items-center gap-2">
                  <span className={cn('w-[72px] shrink-0 truncate', typographyBodyMediumClass)}>{city.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-[99px] bg-bg-app">
                    <div
                      className="h-full rounded-[99px]"
                      style={{
                        width: `${(city.count / cityMax) * 100}%`,
                        backgroundColor: CITY_RANK_COLORS[index] ?? CITY_RANK_COLORS[4],
                      }}
                    />
                  </div>
                  <span className={cn('min-w-[14px] shrink-0 text-right tabular-nums', typographyBodyMutedClass)}>
                    {city.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col border-r border-[rgb(var(--color-border-tertiary)/0.85)] pr-4 mr-4">
          <p className={cn('mb-2.5 shrink-0', typographySectionLabelClass)}>
            Últimas agendas
          </p>
          {recentAgendas.length === 0 ? (
            <p className={typographyBodyMutedClass}>Nenhuma agenda concluída ainda.</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {recentAgendas.map((agenda, index) => {
                const badge = agendaTypeBadge(agenda.type)
                return (
                  <div
                    key={agenda.id}
                    className={cn(
                      'flex flex-1 items-start gap-2 py-1.5',
                      index < recentAgendas.length - 1 && 'border-b border-[rgb(var(--color-border-tertiary)/0.85)]'
                    )}
                  >
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: AGENDA_DOT_COLORS[index] ?? AGENDA_DOT_COLORS[2] }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate', typographyBodyMediumClass)}>{agenda.cityName}</p>
                      <p className={cn('mt-px', typographyBodyMutedClass)}>{formatAgendaDate(agenda.date)}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-[99px] px-[7px] py-0.5',
                        typographyBodyMediumClass,
                        badge.className
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="mb-2.5 flex shrink-0 items-center justify-between gap-2">
            <p className={typographySectionLabelClass}>Ritmo mensal</p>
            {showCurrentMonthNote ? (
              <span className={typographyBodyMutedClass}>* mês atual em andamento</span>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-end">
            <div className="flex min-h-[80px] flex-1 items-end gap-1.5">
              {monthBuckets.map((month) => {
                const value = Math.round(month.value)
                const heightPct = monthMax > 0 ? (value / monthMax) * 100 : 0
                const isCurrentMonth =
                  month.monthIndex === now.getMonth() && month.year === now.getFullYear()

                return (
                  <div key={month.key} className="bar-col flex h-full min-h-[80px] flex-1 flex-col items-center justify-end gap-0.5">
                    <span className={cn('font-medium tabular-nums', typographyBodyMutedClass)}>{value}</span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={cn(
                          'w-full rounded-t-[3px]',
                          isCurrentMonth
                            ? 'border border-dashed border-[rgb(var(--color-primary))] bg-[#E6F1FB]'
                            : 'bg-[rgb(var(--color-primary))]'
                        )}
                        style={{ height: `${Math.max(heightPct, value > 0 ? 4 : 3)}%` }}
                      />
                    </div>
                    <span className={typographyBodyMutedClass}>{formatMonthLabel(month.label)}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-0.5 shrink-0 border-t border-[rgb(var(--color-border-tertiary)/0.85)]" />
          </div>
        </div>
      </div>
    </div>
  )
}
