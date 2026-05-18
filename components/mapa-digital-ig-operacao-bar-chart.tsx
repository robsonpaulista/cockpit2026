'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

export type OperacaoBarBucket = {
  key: string
  label: string
  sublabel: string
  /** Barra azul (seta): métrica principal (liderados ou ativação). */
  pctPrimary: number
  /** Cauda dourada: métrica complementar (orgânico ou restante). */
  pctSecondary: number
  /** Texto abaixo do sublabel (ex.: "Org. 42%"). Se omitido, gera automaticamente. */
  footerSecondary?: string | null
  /** Texto inferior (ex.: "120 com."). */
  footerTertiary?: string | null
  tooltip?: string
}

type Props = {
  buckets: OperacaoBarBucket[]
  isFutDark: boolean
  isFutLight: boolean
  ariaLabel: string
  className?: string
  /** Rótulo do % no topo; padrão: valor numérico da métrica principal. */
  topPctLabel?: (pctPrimary: number) => string
}

const ALTURA_GRAFICO_PX = 148
/** Largura mínima por coluna antes de ativar rolagem horizontal. */
const COL_MIN_WIDTH_PX = 52
/** Acima deste número de colunas, força layout com scroll (largura intrínseca). */
const SCROLL_LAYOUT_MIN_COUNT = 13

export function MapaDigitalIgOperacaoBarChart({
  buckets,
  isFutDark,
  isFutLight,
  ariaLabel,
  className,
  topPctLabel,
}: Props) {
  const fmtPct = useMemo(
    () => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    [],
  )

  const useScrollLayout = buckets.length >= SCROLL_LAYOUT_MIN_COUNT

  if (buckets.length === 0) return null

  return (
    <div
      className={cn('flex min-h-0 w-full flex-1 flex-col justify-end', className)}
      role="img"
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          'w-full pb-1',
          useScrollLayout ? 'overflow-x-auto overscroll-x-contain' : 'overflow-x-hidden',
        )}
      >
        <div
          className={cn(
            'flex items-end gap-2 px-0.5 sm:gap-2.5',
            useScrollLayout ? 'w-max min-w-full' : 'w-full',
          )}
          style={{
            minHeight: ALTURA_GRAFICO_PX + 108,
            ...(useScrollLayout ? { minWidth: buckets.length * COL_MIN_WIDTH_PX } : undefined),
          }}
        >
          {buckets.map((bucket, idx) => (
            <OperacaoBarColumn
              key={bucket.key}
              bucket={bucket}
              index={idx}
              fmtPct={fmtPct}
              isFutDark={isFutDark}
              isFutLight={isFutLight}
              topPctLabel={topPctLabel}
              fillWidth={!useScrollLayout}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function OperacaoBarColumn({
  bucket,
  index,
  fmtPct,
  isFutDark,
  isFutLight,
  topPctLabel,
  fillWidth,
}: {
  bucket: OperacaoBarBucket
  index: number
  fmtPct: Intl.NumberFormat
  isFutDark: boolean
  isFutLight: boolean
  topPctLabel?: (pctPrimary: number) => string
  fillWidth: boolean
}) {
  const pctPrimary = Math.min(100, Math.max(0, bucket.pctPrimary))
  const pctSecondary = Math.min(100, Math.max(0, bucket.pctSecondary))
  const alturaPrimaryPx = Math.round((pctPrimary / 100) * ALTURA_GRAFICO_PX)
  const alturaSecondaryPx = Math.round((pctSecondary / 100) * ALTURA_GRAFICO_PX)
  const minBarPx = pctPrimary + pctSecondary > 0 ? 6 : 0

  const topLabel = topPctLabel ? topPctLabel(pctPrimary) : `${fmtPct.format(pctPrimary)}%`
  const footerSecondary =
    bucket.footerSecondary !== undefined
      ? bucket.footerSecondary
      : `Org. ${fmtPct.format(pctSecondary)}%`
  const footerTertiary = bucket.footerTertiary ?? null

  return (
    <div
      className={cn(
        'flex flex-col items-center',
        fillWidth ? 'min-w-0 flex-1 basis-0' : 'w-[52px] shrink-0 sm:w-[58px]',
      )}
      title={bucket.tooltip}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <p className="mb-1 text-center text-[11px] font-bold tabular-nums leading-none text-blue-700 dark:text-blue-200">
        {topLabel}
      </p>

      <div
        className="relative flex w-full flex-col items-center justify-end"
        style={{ height: ALTURA_GRAFICO_PX }}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-0 rounded-md',
            isFutDark ? 'bg-white/[0.03]' : 'bg-border-card/30',
          )}
          aria-hidden
        />
        {[25, 50, 75].map((pct) => (
          <div
            key={pct}
            className={cn(
              'pointer-events-none absolute left-0 right-0 border-t border-dashed',
              isFutDark ? 'border-white/10' : 'border-border-card/80',
            )}
            style={{ bottom: `${pct}%` }}
            aria-hidden
          />
        ))}

        {alturaSecondaryPx > 0 ? (
          <div
            className={cn(
              'absolute left-1/2 w-[72%] -translate-x-1/2 rounded-b-sm',
              isFutDark
                ? 'bg-gradient-to-t from-accent-gold/10 via-accent-gold/20 to-accent-gold/30'
                : 'bg-gradient-to-t from-accent-gold/15 via-accent-gold/28 to-accent-gold/40',
            )}
            style={{
              bottom: 0,
              height: Math.max(minBarPx, alturaSecondaryPx),
            }}
            aria-hidden
          />
        ) : null}

        {alturaPrimaryPx > 0 ? (
          <div
            className="absolute left-1/2 z-[1] w-[72%] -translate-x-1/2 bg-blue-600 shadow-sm transition-[height] duration-500 ease-out"
            style={{
              bottom: alturaSecondaryPx,
              height: Math.max(minBarPx, alturaPrimaryPx),
              clipPath: 'polygon(0 100%, 100% 100%, 100% 12%, 50% 0, 0 12%)',
              transitionDelay: `${index * 45}ms`,
            }}
            aria-hidden
          />
        ) : pctPrimary + pctSecondary === 0 ? (
          <div className="absolute bottom-0 left-1/2 h-1 w-[40%] -translate-x-1/2 rounded-full bg-border-card/60" aria-hidden />
        ) : null}
      </div>

      <div
        className={cn(
          'mt-2 w-full rounded px-1 py-1 text-center text-[9px] font-bold uppercase leading-tight tracking-wide sm:text-[10px]',
          isFutDark
            ? 'border border-accent-gold/35 bg-accent-gold/15 text-accent-gold'
            : isFutLight
              ? 'border border-accent-gold/50 bg-accent-gold/20 text-amber-900'
              : 'border border-accent-gold/40 bg-accent-gold/10 text-text-primary',
        )}
        title={bucket.label}
      >
        <span className="line-clamp-2">{bucket.label}</span>
      </div>

      <p className="mt-1 text-center text-[9px] font-medium leading-tight text-text-primary sm:text-[10px]">
        {bucket.sublabel}
      </p>
      {footerSecondary ? (
        <p className="mt-0.5 text-center text-[9px] tabular-nums leading-tight text-text-muted">{footerSecondary}</p>
      ) : null}
      {footerTertiary ? (
        <p className="text-center text-[8px] tabular-nums text-text-muted/80">{footerTertiary}</p>
      ) : null}
    </div>
  )
}

export function OperacaoBarChartLegend({
  primaryLabel,
  secondaryLabel,
  isFutDark,
}: {
  primaryLabel: string
  secondaryLabel: string
  isFutDark: boolean
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px] text-text-secondary">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-sm bg-blue-600" aria-hidden />
        {primaryLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn(
            'h-2.5 w-5 rounded-sm border border-accent-gold/40',
            isFutDark ? 'bg-accent-gold/20' : 'bg-accent-gold/25',
          )}
          aria-hidden
        />
        {secondaryLabel}
      </span>
    </div>
  )
}
