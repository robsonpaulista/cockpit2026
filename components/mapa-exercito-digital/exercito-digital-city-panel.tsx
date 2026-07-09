'use client'

import { IconInfoCircle } from '@tabler/icons-react'
import { formatInt, formatPct } from '@/lib/mapa-exercito-digital-aggregator'
import type { ExercitoDigitalCityRow } from '@/lib/mapa-exercito-digital-types'
import type { ExercitoDigitalAudience } from '@/lib/mandatos-instagram-piaui'
import {
  exercitoDualPanelItemClass,
  exercitoSectionCardClass,
  exercitoSectionSubtitleClass,
  exercitoSectionTitleClass,
} from '@/lib/mapa-exercito-digital-layout'
import { cn } from '@/lib/utils'

interface ExercitoDigitalCityPanelProps {
  cities: ExercitoDigitalCityRow[]
  organicTail: { comentarios: number; perfis: number }
  audience: ExercitoDigitalAudience
  referenceMonth: string
  referenceMonthLabel: string
}

export function ExercitoDigitalCityPanel({
  cities,
  organicTail,
  audience,
  referenceMonthLabel,
}: ExercitoDigitalCityPanelProps) {
  const ranked = cities.filter((c) => c.comentarios > 0).slice(0, 15)
  const semTração = cities.filter((c) => c.comentarios === 0).length

  return (
    <div className={cn(exercitoSectionCardClass, exercitoDualPanelItemClass)}>
      <div className="mb-3">
        <h2 className={exercitoSectionTitleClass}>Municípios</h2>
        <p className={exercitoSectionSubtitleClass}>
          Território por volume de comentários · {referenceMonthLabel}
          {semTração > 0 ? ` · ${formatInt(semTração)} sem comentários` : null}
        </p>
      </div>

      {ranked.length === 0 ? (
        <p className="py-8 text-center text-[11px] text-text-muted">Nenhum município com comentários no mês.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-[rgb(var(--color-border-tertiary)/0.85)] text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-2 py-1.5 w-8">#</th>
                <th className="px-2 py-1.5">Município</th>
                <th className="px-2 py-1.5 text-right">Comentários</th>
                <th className="px-2 py-1.5 text-right">Ativação</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((city, idx) => (
                <tr
                  key={city.municipio}
                  className="border-b border-[rgb(var(--color-border-tertiary)/0.55)] last:border-0"
                >
                  <td
                    className={cn(
                      'px-2 py-2 text-center text-[11px] font-medium tabular-nums',
                      idx < 3 ? 'text-[#854F0B]' : 'text-text-muted'
                    )}
                  >
                    {idx + 1}
                  </td>
                  <td className="px-2 py-2 text-[12px] font-medium text-text-primary">{city.municipio}</td>
                  <td className="px-2 py-2 text-right text-[12px] tabular-nums text-[rgb(var(--color-primary))]">
                    {formatInt(city.comentarios)}
                  </td>
                  <td className="px-2 py-2 text-right text-[12px] tabular-nums text-text-secondary">
                    {formatPct(city.ativacaoPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-start gap-1.5 border-t border-[rgb(var(--color-border-tertiary)/0.85)] pt-2.5 text-[10px] text-text-muted">
        <IconInfoCircle className="mt-0.5 h-3 w-3 shrink-0 opacity-70" stroke={1.5} aria-hidden />
        <p>
          {formatInt(organicTail.comentarios)} comentários de {formatInt(organicTail.perfis)} perfis sem match com{' '}
          {audience === 'unificado'
            ? 'a base eleitoral'
            : audience === 'mandatos'
              ? 'mandatários'
              : 'líderes cadastrados'}{' '}
          (cauda orgânica)
        </p>
      </div>
    </div>
  )
}
