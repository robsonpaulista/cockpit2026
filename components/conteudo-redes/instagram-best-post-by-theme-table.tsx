'use client'

import { ExternalLink } from 'lucide-react'
import { TseCard, TsePill, tseLinkAcaoClass, tseTabela } from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'

export type BestPostByThemeRow = {
  theme: string
  thumbnail?: string
  caption?: string
  url: string
  engagement: number
  postedAt?: string
}

export function InstagramBestPostByThemeTable({ rows, periodLabel }: { rows: BestPostByThemeRow[]; periodLabel: string }) {
  if (rows.length === 0) return null

  return (
    <TseCard titulo="Melhor publicação por tema" subtitulo={`Maior engajamento em cada tema classificado · ${periodLabel}`}>
      <div className={cn('mt-3', tseTabela.container, 'shadow-none ring-1 ring-[#EEEEEE]')}>
        <table className={cn(tseTabela.table, 'min-w-[36rem]')} data-tse-tabela>
          <thead className={tseTabela.thead}>
            <tr>
              <th className={tseTabela.th}>Tema</th>
              <th className={tseTabela.th}>Publicação</th>
              <th className={cn(tseTabela.th, 'text-right')}>Engajamento</th>
              <th className={cn(tseTabela.th, 'w-20 text-right')} aria-label="Link" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.theme} className={tseTabela.tr}>
                <td className={tseTabela.td}>
                  <TsePill tom="neutro" className="max-w-[11rem] truncate uppercase">
                    {row.theme}
                  </TsePill>
                </td>
                <td className={tseTabela.td}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--tse-bar)]">
                      {row.thumbnail ? <img src={row.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <p className="line-clamp-2 min-w-0 text-[12px] leading-snug">{row.caption?.trim() || 'Sem legenda'}</p>
                  </div>
                </td>
                <td className={cn(tseTabela.td, 'text-right font-black tabular-nums')}>
                  {row.engagement.toLocaleString('pt-BR')}
                </td>
                <td className={cn(tseTabela.td, 'text-right')}>
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('inline-flex items-center gap-1', tseLinkAcaoClass)}
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
    </TseCard>
  )
}
