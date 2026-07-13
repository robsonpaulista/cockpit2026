'use client'

import { ExternalLink } from 'lucide-react'
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

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function cellHighlight(h: PanoramaHighlight): string {
  if (h === 'best') return 'bg-[#F4FAF0] font-semibold text-[#2D5A1E]'
  if (h === 'worst') return 'bg-[#FDF6F6] text-[#8B2E2E]'
  return ''
}

function topPostHint(row: PanoramaInstagramTableRow): string | undefined {
  const top = row.topPost
  if (!top) return undefined
  const caption = top.caption?.trim()
  const eng = `${formatInt(top.engagement)} eng.`
  if (caption) return `${eng} — ${caption}`
  return eng
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
            <col className="w-[40%]" />
            <col className="w-[18%]" />
            <col className="w-[24%]" />
            <col className="w-[18%]" />
          </colgroup>
          <colgroup className="max-md:hidden">
            <col className="w-[28%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[16%]" />
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
              <th className="whitespace-nowrap px-2 py-0.5 text-right font-semibold">Top 1</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hint = topPostHint(row)
              const top = row.topPost
              const topUrl = top?.postUrl

              return (
                <tr
                  key={row.slug}
                  className="border-b border-[rgb(var(--color-border-tertiary)/0.35)] last:border-b-0"
                >
                  <td className="px-2 py-0.5">
                    <div
                      className="flex min-w-0 items-baseline gap-1.5"
                      title={
                        row.instagramUsername
                          ? `${row.name} (@${row.instagramUsername})`
                          : row.name
                      }
                    >
                      <span className="min-w-0 truncate font-medium text-text-primary">{row.name}</span>
                      {row.instagramUsername ? (
                        <span className="shrink-0 whitespace-nowrap text-text-muted max-md:text-[10px]">
                          @{row.instagramUsername}
                        </span>
                      ) : (
                        <span className="shrink-0 whitespace-nowrap text-amber-700 max-md:text-[10px]">
                          sem @
                        </span>
                      )}
                    </div>
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
                  <td className="px-2 py-0.5 text-right">
                    {top ? (
                      topUrl ? (
                        <a
                          href={topUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={hint}
                          className="inline-flex max-w-full items-center justify-end gap-1 text-[rgb(var(--color-primary))] hover:underline"
                        >
                          <span className="tabular-nums">{formatInt(top.engagement)}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                          <span className="sr-only">Abrir postagem no Instagram</span>
                        </a>
                      ) : (
                        <span className="inline-block tabular-nums text-text-secondary" title={hint}>
                          {formatInt(top.engagement)}
                        </span>
                      )
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
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
          Verde = melhor entre monitorados · vermelho = menor no grupo · Top 1 = post com mais engajamento
          (passe o mouse para ver o texto)
        </p>
      </div>
    </div>
  )
}
