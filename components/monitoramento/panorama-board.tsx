'use client'

import { PanoramaPlatformChart } from '@/components/monitoramento/panorama-platform-chart'
import type { PanoramaModel } from '@/lib/monitoramento-panorama'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface PanoramaBoardProps {
  panorama: PanoramaModel
  loading?: boolean
}

export function PanoramaBoard({ panorama, loading = false }: PanoramaBoardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-16 text-center text-sm text-text-muted">
        Montando painel de gestão…
      </div>
    )
  }

  if (panorama.columns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-6 py-14 text-center text-sm text-text-muted">
        Cadastre candidatos ativos e colete dados nas abas YouTube, Google News, Meta Ads e Trends.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{panorama.title}</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            {formatDateTime(panorama.lastUpdated)} · {panorama.windowLabel}
          </p>
        </div>
        {panorama.isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5E0] px-2.5 py-1 text-xs font-medium text-[#2D5A1E]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3B6D11]" aria-hidden />
            dados recentes
          </span>
        ) : null}
      </div>

      {panorama.charts.length > 0 ? (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Comparativo histórico · todas as plataformas
          </h3>
          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            {panorama.charts.map((chart) => (
              <PanoramaPlatformChart key={chart.id} chart={chart} className="h-full" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
