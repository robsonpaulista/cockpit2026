'use client'

import {
  IconBuildingCommunity,
  IconChevronRight,
  IconFileDescription,
  IconMapPin,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { cargoTierDotClass } from '@/lib/cargo-tier-color'
import { municipalityCardClass } from '@/lib/premium-ui-classes'
import {
  TERRITORIO_BASE_AMBER,
  territorioBaseTextClass,
} from '@/lib/territorio-base-styles'

interface LiderancaRow {
  [key: string]: unknown
}

interface MunicipalityListItemProps {
  cidade: string
  liderancasCidade: LiderancaRow[]
  isExpanded: boolean
  onToggle: () => void
  onBriefing: (e: React.MouseEvent) => void
  onObras: (e: React.MouseEvent) => void
  totalVotos: number
  votosLabel: string
  nomeCol: string
  cargoCol?: string
  votosReferenciaCol?: string
  normalizeNumber: (value: unknown) => number
}

export function MunicipalityListItem({
  cidade,
  liderancasCidade,
  isExpanded,
  onToggle,
  onBriefing,
  onObras,
  totalVotos,
  votosLabel,
  nomeCol,
  cargoCol,
  votosReferenciaCol,
  normalizeNumber,
}: MunicipalityListItemProps) {
  const liderancasOrdenadas = [...liderancasCidade].sort((a, b) => {
    const expectativaA = votosReferenciaCol ? normalizeNumber(a[votosReferenciaCol]) : 0
    const expectativaB = votosReferenciaCol ? normalizeNumber(b[votosReferenciaCol]) : 0
    return expectativaB - expectativaA
  })

  return (
    <div className={cn(municipalityCardClass, 'mb-1.5')}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        className="flex cursor-pointer items-center gap-2 px-3 py-3 transition-colors hover:bg-bg-app/40"
      >
        <IconChevronRight
          className={cn(
            'ml-0.5 h-[14px] w-[14px] shrink-0 text-black/50 transition-transform duration-200',
            isExpanded && 'rotate-90',
          )}
          stroke={1.5}
          aria-hidden
        />

        <div
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${TERRITORIO_BASE_AMBER}1F` }}
        >
          <IconMapPin
            className="h-4 w-4"
            style={{ color: TERRITORIO_BASE_AMBER }}
            stroke={1.5}
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-[13.5px] font-medium', territorioBaseTextClass)}>{cidade}</p>
          <p className={cn('mt-px text-[11.5px]', territorioBaseTextClass)}>
            {liderancasCidade.length} liderança{liderancasCidade.length !== 1 ? 's' : ''}
          </p>
        </div>

        {votosReferenciaCol && totalVotos > 0 ? (
          <div className="ml-2 shrink-0 text-right">
            <p className={cn('text-base font-medium tabular-nums', territorioBaseTextClass)}>
              {Math.round(totalVotos).toLocaleString('pt-BR')}
            </p>
            <p className={cn('text-[10.5px]', territorioBaseTextClass)}>{votosLabel}</p>
          </div>
        ) : null}

        <div className="ml-2 flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onBriefing}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent px-2 py-1 text-[11px] font-medium transition-colors hover:bg-bg-app',
              territorioBaseTextClass,
            )}
            aria-label={`Briefing de ${cidade}`}
          >
            <IconFileDescription className="h-[13px] w-[13px] opacity-70" stroke={1.5} aria-hidden />
            Briefing
          </button>
          <button
            type="button"
            onClick={onObras}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent px-2 py-1 text-[11px] font-medium transition-colors hover:bg-bg-app',
              territorioBaseTextClass,
            )}
            aria-label={`Obras de ${cidade}`}
          >
            <IconBuildingCommunity className="h-[13px] w-[13px] opacity-70" stroke={1.5} aria-hidden />
            Obras
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="border-t border-[rgb(var(--color-border-tertiary)/0.85)] bg-[rgb(var(--color-background-tertiary))] py-1">
          {liderancasOrdenadas.map((lider, idx) => {
            const nome = String(lider[nomeCol] || 'Sem nome')
            const cargo = cargoCol ? String(lider[cargoCol] || '').trim() : ''
            const votos =
              votosReferenciaCol && lider[votosReferenciaCol]
                ? normalizeNumber(lider[votosReferenciaCol])
                : 0

            return (
              <div
                key={`${nome}-${idx}`}
                className="flex items-center gap-2 rounded-lg py-1.5 pl-[62px] pr-3 transition-colors hover:bg-bg-app"
              >
                <span
                  className={cn('h-[7px] w-[7px] shrink-0 rounded-full', cargoTierDotClass(cargo))}
                  aria-hidden
                />
                <div className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden">
                  <span className={cn('truncate text-xs font-medium', territorioBaseTextClass)}>{nome}</span>
                  {cargo ? (
                    <>
                      <span className={cn('shrink-0 text-[11px]', territorioBaseTextClass)} aria-hidden>
                        ·
                      </span>
                      <span className={cn('truncate text-[11px]', territorioBaseTextClass)}>{cargo}</span>
                    </>
                  ) : null}
                </div>
                {votosReferenciaCol && votos > 0 ? (
                  <p className={cn('shrink-0 text-[11.5px] font-medium tabular-nums', territorioBaseTextClass)}>
                    {votos.toLocaleString('pt-BR')}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
