'use client'

import { Loader2 } from 'lucide-react'
import type { MetaAdsCollectProgress } from '@/lib/meta-ads-collect-progress'
import {
  formatMetaAdsCollectElapsed,
  metaAdsCollectPhaseLabel,
} from '@/lib/meta-ads-collect-progress'
import { cn } from '@/lib/utils'

interface MetaAdsCollectProgressBarProps {
  progress: MetaAdsCollectProgress | null
  collecting?: boolean
  className?: string
}

export function MetaAdsCollectProgressBar({
  progress,
  collecting = false,
  className,
}: MetaAdsCollectProgressBarProps) {
  const show = collecting || Boolean(progress)
  if (!show) return null

  const percent = progress?.percent ?? (collecting ? 8 : 0)
  const elapsed = formatMetaAdsCollectElapsed(progress?.startedAt)
  const phaseLabel = progress ? metaAdsCollectPhaseLabel(progress.phase) : 'Iniciando'

  return (
    <div
      className={cn(
        'rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-3',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy={collecting}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {collecting ? (
            <Loader2
              className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[rgb(var(--color-primary))]"
              aria-hidden
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {progress?.message ?? 'Coleta Meta Ads em andamento…'}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              Etapa: {phaseLabel}
              {progress?.actorName && progress.actorTotal
                ? ` · Candidato ${progress.actorIndex ?? '?'}/${progress.actorTotal}: ${progress.actorName}`
                : null}
              {progress?.adTotal && progress.adTotal > 0
                ? ` · Localização ${progress.adIndex ?? 0}/${progress.adTotal}`
                : null}
              {progress?.adsFound != null ? ` · ${progress.adsFound} anúncio(s) na listagem` : null}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right text-xs tabular-nums text-text-secondary">
          <span className="font-semibold text-text-primary">{percent}%</span>
          {elapsed ? <span className="mt-0.5 block text-text-muted">{elapsed} decorridos</span> : null}
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-app">
        <div
          className="h-full rounded-full bg-[rgb(var(--color-primary))] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.min(100, Math.max(collecting && !progress ? 8 : 0, percent))}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] text-text-muted">
        Consulta automatizada de anúncios. Costuma levar 1–3 minutos por candidato monitorado.
      </p>
    </div>
  )
}
