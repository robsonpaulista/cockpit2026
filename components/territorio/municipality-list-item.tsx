'use client'

import {
  IconBuildingCommunity,
  IconChevronRight,
  IconFileDescription,
  IconMapPin,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { cargoTierDotClass } from '@/lib/cargo-tier-color'
import {
  territorioBaseTextClass,
  territorioCxBtnGhostClass,
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
  /** Quando false (padrão), maior expectativa primeiro. */
  expectativaSortAsc?: boolean
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
  expectativaSortAsc = false,
}: MunicipalityListItemProps) {
  const liderancasOrdenadas = [...liderancasCidade].sort((a, b) => {
    const expectativaA = votosReferenciaCol ? normalizeNumber(a[votosReferenciaCol]) : 0
    const expectativaB = votosReferenciaCol ? normalizeNumber(b[votosReferenciaCol]) : 0
    const byExp = expectativaSortAsc ? expectativaA - expectativaB : expectativaB - expectativaA
    if (byExp !== 0) return byExp
    return String(a[nomeCol] ?? '').localeCompare(String(b[nomeCol] ?? ''), 'pt-BR')
  })

  return (
    <div className="territorio-cx-city-group mb-1.5 overflow-hidden rounded-xl border border-[#e8e8e6] bg-white shadow-none">
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
        className="flex cursor-pointer items-center gap-2 bg-[#f7f7f6] px-3 py-3 transition-colors hover:bg-[#f0f0ee]"
      >
        <IconChevronRight
          className={cn(
            'ml-0.5 h-[14px] w-[14px] shrink-0 text-[#969692] transition-transform duration-200',
            isExpanded && 'rotate-90',
          )}
          stroke={1.5}
          aria-hidden
        />

        <IconMapPin className="h-4 w-4 shrink-0 text-[#e8a825]" stroke={1.5} aria-hidden />

        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-[13px] font-medium', territorioBaseTextClass)}>{cidade}</p>
          <p className="mt-px text-[12px] text-[#686865]">
            {liderancasCidade.length} liderança{liderancasCidade.length !== 1 ? 's' : ''}
          </p>
        </div>

        {votosReferenciaCol && totalVotos > 0 ? (
          <div className="ml-2 shrink-0 text-right">
            <p className={cn('text-[14px] font-medium tabular-nums', territorioBaseTextClass)} data-kpi-value>
              {Math.round(totalVotos).toLocaleString('pt-BR')}
            </p>
            <p className="text-[11px] text-[#686865]">{votosLabel}</p>
          </div>
        ) : null}

        <div className="ml-2 flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onBriefing}
            className={cn(territorioCxBtnGhostClass, 'h-8 px-2 text-[12px]')}
            aria-label={`Briefing de ${cidade}`}
          >
            <IconFileDescription className="h-[13px] w-[13px] opacity-70" stroke={1.5} aria-hidden />
            Briefing
          </button>
          <button
            type="button"
            onClick={onObras}
            className={cn(territorioCxBtnGhostClass, 'h-8 px-2 text-[12px]')}
            aria-label={`Obras de ${cidade}`}
          >
            <IconBuildingCommunity className="h-[13px] w-[13px] opacity-70" stroke={1.5} aria-hidden />
            Obras
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="border-t border-[#e8e8e6] bg-white py-1">
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
                  <span className={cn('truncate text-[13px] font-medium', territorioBaseTextClass)}>{nome}</span>
                  {cargo ? (
                    <>
                      <span className={cn('shrink-0 text-[13px] text-black/45', territorioBaseTextClass)} aria-hidden>
                        ·
                      </span>
                      <span className={cn('truncate text-[13px] text-black/55', territorioBaseTextClass)}>{cargo}</span>
                    </>
                  ) : null}
                </div>
                {votosReferenciaCol && votos > 0 ? (
                  <p className={cn('shrink-0 text-[13px] font-medium tabular-nums', territorioBaseTextClass)}>
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
