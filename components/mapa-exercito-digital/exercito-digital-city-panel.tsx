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
  lookbackDays: number
}

const ROWS = 8

export function ExercitoDigitalCityPanel({ cities, organicTail, audience, lookbackDays }: ExercitoDigitalCityPanelProps) {
  const maxComments = Math.max(...cities.map((c) => c.comentarios), 1)
  const withComments = cities.filter((c) => c.comentarios > 0)
  const zeroCities = cities.filter((c) => c.comentarios === 0)
  const ordered = [...withComments, ...zeroCities].slice(0, ROWS)
  const padded: (ExercitoDigitalCityRow | null)[] = [...ordered]
  while (padded.length < ROWS) padded.push(null)

  return (
    <div className={cn(exercitoSectionCardClass, exercitoDualPanelItemClass)}>
      <h2 className={exercitoSectionTitleClass}>Ativação por município · top 8</h2>
      <p className={cn(exercitoSectionSubtitleClass, 'mb-3')}>
        Comentários {audience === 'mandatos' ? 'de mandatários' : 'de líderes'} · últimos {lookbackDays} dias
        (mesma janela do ranking)
      </p>

      <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.04em] text-text-muted">
        <span className="w-[90px] shrink-0 text-right">Município</span>
        <span className="flex-1" />
        <span className="min-w-[28px] shrink-0 text-right">Com.</span>
        <span className="min-w-[52px] shrink-0 text-right">Ativação</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {padded.map((city, index) => (
          <div
            key={city?.municipio ?? `empty-${index}`}
            className="flex flex-1 items-center border-b border-[rgb(var(--color-border-tertiary)/0.35)] last:border-b-0"
          >
            {city ? (
              <CityRow city={city} maxComments={maxComments} />
            ) : (
              <div className="h-4 w-full opacity-0" aria-hidden />
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex shrink-0 flex-wrap items-center gap-3 border-t border-[rgb(var(--color-border-tertiary)/0.85)] pt-2.5 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-2.5 rounded-[2px] bg-[rgb(var(--color-primary))]" aria-hidden />
          Com ativação
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-2.5 rounded-[2px] border border-[rgb(var(--color-border-secondary)/0.85)]" aria-hidden />
          Sem ativação
        </span>
      </div>

      <div className="mt-2 flex shrink-0 items-start gap-1.5 text-[11px] text-text-muted">
        <IconInfoCircle className="mt-0.5 h-3 w-3 shrink-0 opacity-70" stroke={1.5} aria-hidden />
        <p>
          {formatInt(organicTail.comentarios)} comentários de {formatInt(organicTail.perfis)} perfis sem match com{' '}
          {audience === 'mandatos' ? 'mandatários da planilha' : 'líderes cadastrados'} (cauda orgânica)
        </p>
      </div>
    </div>
  )
}

function CityRow({ city, maxComments }: { city: ExercitoDigitalCityRow; maxComments: number }) {
  const hasComments = city.comentarios > 0
  const widthPct = hasComments ? (city.comentarios / maxComments) * 100 : 100

  return (
    <div className="flex w-full items-center gap-2 py-0.5">
      <span
        className="w-[90px] shrink-0 truncate text-right text-[11px] text-text-secondary"
        title={city.municipio}
      >
        {city.municipio}
      </span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-bg-app">
        <div
          className={cn('h-full rounded', hasComments ? 'bg-[rgb(var(--color-primary))]' : 'bg-transparent')}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span
        className={cn(
          'min-w-[28px] shrink-0 text-right text-[11px] font-medium tabular-nums',
          hasComments ? 'text-[rgb(var(--color-primary))]' : 'text-text-muted'
        )}
      >
        {formatInt(city.comentarios)}
      </span>
      <span
        className={cn(
          'min-w-[52px] shrink-0 text-right text-[10px] tabular-nums',
          city.ativacaoPct === 0 ? 'text-[#A32D2D]' : 'text-text-muted'
        )}
      >
        {formatPct(city.ativacaoPct)}
      </span>
    </div>
  )
}
