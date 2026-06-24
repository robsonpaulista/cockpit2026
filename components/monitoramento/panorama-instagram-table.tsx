'use client'

import { AnimatedCounter } from '@/components/ui/animated-counter'
import type { PanoramaHighlight } from '@/lib/monitoramento-panorama'
import type { PanoramaInstagramTableRow } from '@/lib/monitoramento-panorama-charts'
import {
  typographyBodyClass,
  typographyBodyMutedClass,
  typographyTableThClass,
} from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

function formatDecimal(n: number, digits = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

function cellHighlight(h: PanoramaHighlight): string {
  if (h === 'best') return 'bg-[#F4FAF0] font-semibold text-[#2D5A1E]'
  if (h === 'worst') return 'bg-[#FDF6F6] text-[#8B2E2E]'
  return ''
}

interface PanoramaInstagramTableProps {
  rows: PanoramaInstagramTableRow[]
  animationEpoch?: number
  className?: string
}

export function PanoramaInstagramTable({
  rows,
  animationEpoch = 0,
  className,
}: PanoramaInstagramTableProps) {
  const withoutUsername = rows.filter((r) => !r.instagramUsername)

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-1', className)}>
      <div className="min-h-0 flex-1 overflow-x-auto">
        <table className={cn('w-full table-fixed border-collapse text-left', typographyBodyClass)}>
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead>
            <tr className={cn('border-b border-[rgb(var(--color-border-tertiary)/0.55)]', typographyTableThClass)}>
              <th className="px-2 py-0.5 font-semibold">Candidato</th>
              <th className="whitespace-nowrap px-2 py-0.5 text-right font-semibold">Posts</th>
              <th className="whitespace-nowrap px-2 py-0.5 text-right font-semibold">/sem</th>
              <th className="whitespace-nowrap px-2 py-0.5 text-right font-semibold">Eng. total</th>
              <th className="whitespace-nowrap px-2 py-0.5 text-right font-semibold">Eng. médio</th>
              <th className="whitespace-nowrap px-2 py-0.5 text-right font-semibold">Curt. média</th>
              <th className="whitespace-nowrap px-2 py-0.5 text-right font-semibold">Com. média</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.slug}
                className="border-b border-[rgb(var(--color-border-tertiary)/0.35)] last:border-b-0"
              >
                <td className="px-2 py-0.5">
                  <p
                    className="min-w-0 leading-tight text-text-primary"
                    title={
                      row.instagramUsername
                        ? `${row.name} (@${row.instagramUsername})`
                        : row.name
                    }
                  >
                    <span className="font-medium">{row.name}</span>
                    {row.instagramUsername ? (
                      <span className="ml-1.5 whitespace-nowrap text-text-muted">
                        @{row.instagramUsername}
                      </span>
                    ) : (
                      <span className="ml-1.5 whitespace-nowrap text-amber-700">sem @</span>
                    )}
                  </p>
                </td>
                <td className={cn('px-2 py-0.5 text-right tabular-nums', cellHighlight(row.highlights.postCount))}>
                  <AnimatedCounter value={row.postCount} resetKey={animationEpoch} />
                </td>
                <td className="px-2 py-0.5 text-right tabular-nums text-text-secondary">
                  {formatDecimal(row.postsPerWeek)}
                </td>
                <td
                  className={cn(
                    'px-2 py-0.5 text-right tabular-nums',
                    cellHighlight(row.highlights.totalEngagement)
                  )}
                >
                  <AnimatedCounter value={row.totalEngagement} resetKey={animationEpoch} />
                </td>
                <td
                  className={cn(
                    'px-2 py-0.5 text-right tabular-nums',
                    cellHighlight(row.highlights.avgEngagement)
                  )}
                >
                  <AnimatedCounter value={row.avgEngagement} resetKey={animationEpoch} />
                </td>
                <td className="px-2 py-0.5 text-right tabular-nums text-text-secondary">
                  {row.postCount > 0 ? (
                    <AnimatedCounter value={row.avgLikes} resetKey={animationEpoch} />
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2 py-0.5 text-right tabular-nums text-text-secondary">
                  {row.postCount > 0 ? (
                    <AnimatedCounter value={row.avgComments} resetKey={animationEpoch} />
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-auto shrink-0 space-y-1">
        {withoutUsername.length > 0 ? (
          <p className={cn(typographyBodyMutedClass, 'text-amber-800')}>
            {withoutUsername.length} sem @ cadastrado — configure em Candidatos monitorados.
          </p>
        ) : null}

        <p className={typographyBodyMutedClass}>
          Verde = melhor entre monitorados · vermelho = menor no grupo
        </p>
      </div>
    </div>
  )
}
