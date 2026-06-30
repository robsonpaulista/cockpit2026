'use client'

import { Fragment } from 'react'
import { getMonthWindow } from '@/lib/mapa-exercito-digital-month'
import { getReferenceMonthOptions } from '@/lib/mapa-exercito-digital-gamification'
import { exercitoSectionCardClass } from '@/lib/mapa-exercito-digital-layout'
import { cn } from '@/lib/utils'

interface ExercitoDigitalScoreboardHeaderProps {
  referenceMonth: string
  referenceMonthLabel: string
  onReferenceMonthChange: (value: string) => void
}

export function ExercitoDigitalScoreboardHeader({
  referenceMonth,
  referenceMonthLabel,
  onReferenceMonthChange,
}: ExercitoDigitalScoreboardHeaderProps) {
  const monthOptions = getReferenceMonthOptions(12)
  const historyMonths = getMonthWindow(referenceMonth, 5)

  return (
    <div
      className={cn(
        exercitoSectionCardClass,
        'relative overflow-hidden border-[#B5D4F4]/80 bg-gradient-to-br from-[#E6F1FB]/80 via-bg-surface to-[#FAEEDA]/40 max-md:px-3 max-md:py-3'
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgb(var(--color-primary))]">
                Eng. líderes · {referenceMonthLabel}
              </p>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-[99px] border border-[#F09595]/60 bg-[#FCEBEB] px-2 py-0.5 text-[10px] font-semibold text-[#A32D2D]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E24B4A]" aria-hidden />
                ao vivo
              </span>
            </div>
            <h2 className="mt-2 text-[15px] font-semibold leading-snug text-text-primary md:mt-1 md:text-base">
              Placar geral · disputa mensal equilibrada
            </h2>
          </div>

          <label className="flex w-full shrink-0 flex-col gap-1 md:w-auto md:min-w-[200px]">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Mês de referência
            </span>
            <select
              value={referenceMonth}
              onChange={(e) => onReferenceMonthChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-2.5 text-[12px] font-medium text-text-primary"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-[99px] border border-[#C8900A]/45 bg-[#FAEEDA] px-2.5 py-1 text-[10px] font-semibold text-[#854F0B]">
            ⚔️ Disputa de líderes
          </span>
          <span className="rounded-[99px] border border-[rgb(var(--color-primary)/0.35)] bg-[#E6F1FB] px-2.5 py-1 text-[10px] font-semibold text-[rgb(var(--color-primary))]">
            🏙 Disputa de municípios
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-text-muted">
          Todos competem no mesmo mês calendário.
        </p>

        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">Histórico</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {historyMonths.map((month, index) => {
              const isCurrent = index === historyMonths.length - 1
              return (
                <Fragment key={`${month.year}-${month.month}`}>
                  {index > 0 ? (
                    <span className="shrink-0 px-0.5 text-[10px] text-text-muted" aria-hidden>
                      →
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium tabular-nums',
                      isCurrent
                        ? 'border-[rgb(var(--color-primary)/0.35)] bg-[#E6F1FB] text-[rgb(var(--color-primary))]'
                        : 'border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-surface text-text-secondary'
                    )}
                  >
                    {month.label}
                  </span>
                </Fragment>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ExercitoDigitalCorrelationBarProps {
  note: string | null
}

export function ExercitoDigitalCorrelationBar({ note }: ExercitoDigitalCorrelationBarProps) {
  if (!note) return null

  return (
    <div className="rounded-xl border border-[#B5D4F4]/60 bg-[#E6F1FB]/40 px-4 py-2.5 max-md:px-3">
      <p className="text-[11px] leading-relaxed text-text-secondary">
        <span className="mr-1.5 font-semibold text-[rgb(var(--color-primary))]">Correlação detectada:</span>
        {note}
      </p>
    </div>
  )
}
