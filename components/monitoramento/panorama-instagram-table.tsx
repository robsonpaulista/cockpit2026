'use client'

import { ExternalLink } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { tseTabela } from '@/components/tse/tse-ui'
import type { PanoramaHighlight } from '@/lib/monitoramento-panorama'
import type { PanoramaInstagramTableRow } from '@/lib/monitoramento-panorama-charts'
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
  if (h === 'best') return 'bg-[var(--tse-yellow-soft)] font-bold text-[var(--tse-text)]'
  if (h === 'worst') return 'text-[var(--tse-muted)]'
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

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase()
}

function CandidateAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
  }
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tse-yellow-soft)] text-[10px] font-black text-[var(--tse-gold-text)]"
      aria-hidden
    >
      {initialsFromName(name)}
    </span>
  )
}

const thClass = cn(tseTabela.th, 'px-2.5 py-1.5')
const tdClass = cn(tseTabela.td, 'px-2.5 py-1')

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
    <div className={cn('flex h-full min-h-0 flex-col gap-1.5', className)}>
      <div className={cn('min-h-0 flex-1', tseTabela.container, 'rounded-none bg-transparent shadow-none')}>
        <table className={cn(tseTabela.table, 'text-[12px] leading-tight')} data-tse-tabela>
          <thead className={tseTabela.thead}>
            <tr>
              <th className={thClass}>Candidato</th>
              <th className={cn(thClass, 'text-right')}>Posts</th>
              <th className={cn(thClass, 'hidden text-right md:table-cell')}>/sem</th>
              <th className={cn(thClass, 'text-right')}>Eng. médio</th>
              <th className={cn(thClass, 'hidden text-right md:table-cell')}>Curt. média</th>
              <th className={cn(thClass, 'hidden text-right md:table-cell')}>Com. média</th>
              <th className={cn(thClass, 'text-right')}>Top 1</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hint = topPostHint(row)
              const top = row.topPost
              const topUrl = top?.postUrl

              return (
                <tr key={row.slug} className={tseTabela.tr}>
                  <td className={tdClass}>
                    <div
                      className="flex min-w-0 items-center gap-1.5"
                      title={row.instagramUsername ? `@${row.instagramUsername}` : 'sem @ cadastrado'}
                    >
                      <CandidateAvatar name={row.name} avatarUrl={row.avatarUrl} />
                      <span className="min-w-0 truncate font-bold">{row.name}</span>
                    </div>
                  </td>
                  <td className={cn(tdClass, 'text-right tabular-nums', cellHighlight(row.highlights.postCount))}>
                    <AnimatedCounter value={row.postCount} resetKey={animationEpoch} />
                  </td>
                  <td className={cn(tdClass, 'hidden text-right tabular-nums text-[var(--tse-muted)] md:table-cell')}>
                    {formatDecimal(row.postsPerWeek)}
                  </td>
                  <td className={cn(tdClass, 'text-right tabular-nums', cellHighlight(row.highlights.avgEngagement))}>
                    <AnimatedCounter value={row.avgEngagement} resetKey={animationEpoch} />
                  </td>
                  <td className={cn(tdClass, 'hidden text-right tabular-nums text-[var(--tse-muted)] md:table-cell')}>
                    {row.postCount > 0 ? <AnimatedCounter value={row.avgLikes} resetKey={animationEpoch} /> : '—'}
                  </td>
                  <td className={cn(tdClass, 'hidden text-right tabular-nums text-[var(--tse-muted)] md:table-cell')}>
                    {row.postCount > 0 ? <AnimatedCounter value={row.avgComments} resetKey={animationEpoch} /> : '—'}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    {top ? (
                      topUrl ? (
                        <a
                          href={topUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={hint}
                          className="inline-flex max-w-full items-center justify-end gap-1 font-bold text-[var(--tse-olive)] hover:underline"
                        >
                          <span className="tabular-nums">{formatInt(top.engagement)}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                          <span className="sr-only">Abrir postagem no Instagram</span>
                        </a>
                      ) : (
                        <span className="inline-block tabular-nums text-[var(--tse-muted)]" title={hint}>
                          {formatInt(top.engagement)}
                        </span>
                      )
                    ) : (
                      <span className="text-[var(--tse-muted)]">—</span>
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
          <p className="text-[12px] text-[var(--tse-gold-text)]">
            {withoutUsername.length} sem @ cadastrado — configure em Candidatos monitorados.
          </p>
        ) : null}
        <p className="text-[12px] text-[var(--tse-muted)]">
          Destaque amarelo = melhor entre monitorados · Top 1 = post com mais engajamento
        </p>
      </div>
    </div>
  )
}
