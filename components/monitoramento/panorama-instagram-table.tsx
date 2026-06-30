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
      <div className="min-h-0 flex-1 max-md:overflow-x-hidden md:overflow-x-auto">
        <table
          className={cn(
            'w-full border-collapse text-left max-md:table-auto md:table-fixed',
            typographyBodyClass
          )}
        >
          <colgroup className="md:hidden">
            <col className="w-[46%]" />
            <col className="w-[22%]" />
            <col className="w-[32%]" />
          </colgroup>
          <colgroup className="max-md:hidden">
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
              <th className="hidden whitespace-nowrap px-2 py-0.5 text-right font-semibold md:table-cell">/sem</th>
              <th className="hidden whitespace-nowrap px-2 py-0.5 text-right font-semibold md:table-cell">
                Eng. total
              </th>
              <th className="whitespace-nowrap px-2 py-0.5 text-right font-semibold">Eng. médio</th>
              <th className="hidden whitespace-nowrap px-2 py-0.5 text-right font-semibold md:table-cell">
                Curt. média
              </th>
              <th className="hidden whitespace-nowrap px-2 py-0.5 text-right font-semibold md:table-cell">
                Com. média
              </th>
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
                    <span className="block truncate font-medium">{row.name}</span>
                    {row.instagramUsername ? (
                      <span className="block truncate text-text-muted max-md:text-[10px] md:ml-1.5 md:inline md:whitespace-nowrap">
                        @{row.instagramUsername}
                      </span>
                    ) : (
                      <span className="block whitespace-nowrap text-amber-700 max-md:text-[10px] md:ml-1.5 md:inline">
                        sem @
                      </span>
                    )}
                  </p>
                </td>
                <td className={cn('px-2 py-0.5 text-right tabular-nums', cellHighlight(row.highlights.postCount))}>
                  <AnimatedCounter value={row.postCount} resetKey={animationEpoch} />
                </td>
                <td className="hidden px-2 py-0.5 text-right tabular-nums text-text-secondary md:table-cell">
                  {formatDecimal(row.postsPerWeek)}
                </td>
                <td
                  className={cn(
                    'hidden px-2 py-0.5 text-right tabular-nums md:table-cell',
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
                <td className="hidden px-2 py-0.5 text-right tabular-nums text-text-secondary md:table-cell">
                  {row.postCount > 0 ? (
                    <AnimatedCounter value={row.avgLikes} resetKey={animationEpoch} />
                  ) : (
                    '—'
                  )}
                </td>
                <td className="hidden px-2 py-0.5 text-right tabular-nums text-text-secondary md:table-cell">
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
