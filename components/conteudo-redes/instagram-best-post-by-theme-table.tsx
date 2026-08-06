'use client'

import { ExternalLink } from 'lucide-react'
import { PremiumSectionHeader } from '@/components/conteudo-redes/premium-section-header'
import { cn } from '@/lib/utils'

export type BestPostByThemeRow = {
  theme: string
  thumbnail?: string
  caption?: string
  url: string
  engagement: number
  postedAt?: string
}

type InstagramBestPostByThemeTableProps = {
  rows: BestPostByThemeRow[]
  periodLabel?: string
  sectionClassName?: string
  panelClassName?: string
  /** Oculta título/descrição (útil quando o container já tem cabeçalho de grupo). */
  hideHeader?: boolean
}

export function InstagramBestPostByThemeTable({
  rows,
  periodLabel,
  sectionClassName = '',
  panelClassName = 'overflow-hidden rounded-[18px] border border-[#ebe8e4] bg-white shadow-[0_1px_2px_rgba(28,25,23,0.03)]',
  hideHeader = false,
}: InstagramBestPostByThemeTableProps) {
  if (rows.length === 0) return null

  const description = periodLabel
    ? `Maior engajamento em cada tema classificado · ${periodLabel}`
    : 'Maior engajamento em cada tema classificado no período'

  return (
    <div className={sectionClassName}>
      {hideHeader ? null : (
        <PremiumSectionHeader
          title="Melhor publicação por tema"
          description={description}
        />
      )}

      <div className={panelClassName}>
        <div className="overflow-x-auto">
                      <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#ebe8e4] bg-[#fafaf8]">
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
                  Tema
                </th>
                <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
                  Publicação
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
                  Engajamento
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
                  Link
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.theme}
                  className={cn(
                    'border-b border-[#ebe8e4] last:border-b-0',
                    index % 2 === 1 && 'bg-[#fafaf8]/60',
                  )}
                >
                  <td className="px-4 py-2.5 align-middle">
                    <span className="inline-flex max-w-[10rem] truncate rounded-full border border-[#ebe8e4] bg-white px-2.5 py-0.5 text-[12px] font-medium text-[#1c1917]">
                      {row.theme}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#f3f1ec]">
                        {row.thumbnail ? (
                          <img
                            src={row.thumbnail}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-[#a8a29e]">
                            —
                          </div>
                        )}
                      </div>
                      <p className="line-clamp-2 min-w-0 text-[12px] leading-snug text-[#57534e]">
                        {row.caption?.trim() || 'Sem legenda'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right align-middle">
                    <span className="text-[13px] font-semibold tabular-nums text-[#1c1917]">
                      {row.engagement.toLocaleString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right align-middle">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-[#c27803] hover:text-[#a16207]"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden />
                      Ver
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
