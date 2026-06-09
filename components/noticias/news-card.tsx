'use client'

import { IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react'
import {
  formatNewsMetaDate,
  newsItemDate,
  RISK_TAG_CLASS,
  riskLabel,
  SENTIMENT_TAG_CLASS,
  sentimentLabel,
  THEME_TAG_CLASS,
} from '@/lib/noticias-page-utils'
import { cn } from '@/lib/utils'
import type { NewsItem } from '@/types'

interface NewsCardProps {
  item: NewsItem
  isLixo: boolean
  isHighlighted: boolean
  isHiding: boolean
  showUndo: boolean
  togglingHighlight: boolean
  onToggleHighlight: () => void
  onMarkLixo: () => void
  onUndoLixo: () => void
  onEditTags: () => void
}

const tagBase =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium'

export function NewsCard({
  item,
  isLixo,
  isHighlighted,
  isHiding,
  showUndo,
  togglingHighlight,
  onToggleHighlight,
  onMarkLixo,
  onUndoLixo,
  onEditTags,
}: NewsCardProps) {
  const isHighRisk = item.risk_level === 'high'
  const date = newsItemDate(item)
  const metaDate = date ? formatNewsMetaDate(date) : '—'

  return (
    <article
      className={cn(
        'noticias-news-card group mb-1.5 overflow-hidden rounded-xl border bg-bg-surface transition-[border-color,opacity,max-height,margin,padding] duration-200 ease-out',
        isHiding && 'noticias-news-card--hiding pointer-events-none',
        isLixo && !isHiding && 'opacity-45',
        isHighlighted && 'border-[rgb(var(--color-primary))]/30 bg-[#FAFCFF] border-l-[3px] border-l-[rgb(var(--color-primary))]',
        !isHighlighted && isHighRisk && 'border-l-[3px] border-l-[#E24B4A]',
        !isHighlighted && !isHighRisk && 'border-[rgb(var(--color-border-tertiary)/0.85)] hover:border-[rgb(var(--color-border-secondary)/0.9)]',
        isHighlighted && isHighRisk && 'border-l-[3px] border-l-[rgb(var(--color-primary))]'
      )}
    >
      <div className="flex items-start gap-2 px-3.5 py-3 pb-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-medium leading-[1.45] text-text-primary">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-[rgb(var(--color-primary))] transition-colors">
                {item.title}
              </a>
            ) : (
              item.title
            )}
            {isHighRisk ? (
              <span className="ml-2 inline-flex align-middle rounded-full border border-[#F09595] bg-[#FCEBEB] px-1.5 py-px text-[10px] font-medium text-[#A32D2D]">
                ⚠ Risco alto
              </span>
            ) : null}
          </h3>
          <p className="mb-[7px] mt-0.5 text-[11px] text-text-muted">
            {item.source} · {metaDate}
          </p>
          <button type="button" onClick={onEditTags} className="flex flex-wrap items-center gap-1.5 text-left">
            {item.sentiment ? (
              <span className={cn(tagBase, SENTIMENT_TAG_CLASS[item.sentiment])}>
                {sentimentLabel(item.sentiment)}
              </span>
            ) : null}
            {item.risk_level ? (
              <span className={cn(tagBase, RISK_TAG_CLASS[item.risk_level])}>
                Risco {riskLabel(item.risk_level)}
              </span>
            ) : null}
            {item.theme ? (
              <span className={cn(tagBase, THEME_TAG_CLASS)}>{item.theme}</span>
            ) : null}
          </button>
          {isLixo && !isHiding ? (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-full border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app px-2 py-0.5 text-[10px] text-text-muted">
                Lixo
              </span>
              {showUndo ? (
                <button
                  type="button"
                  onClick={onUndoLixo}
                  className="text-[11px] font-medium text-[rgb(var(--color-primary))] hover:underline"
                >
                  Desfazer
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            'flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100',
            isHighlighted && 'opacity-100'
          )}
        >
          <button
            type="button"
            onClick={onToggleHighlight}
            disabled={togglingHighlight}
            data-tip={isHighlighted ? 'Remover do briefing' : 'Destacar no briefing'}
            aria-label={isHighlighted ? 'Remover do briefing' : 'Destacar no briefing'}
            className={cn(
              'news-action-btn flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-transparent bg-transparent transition-colors disabled:opacity-50',
              isHighlighted
                ? 'text-[rgb(var(--color-primary))]'
                : 'text-text-secondary hover:border-[rgb(var(--color-border-secondary)/0.85)] hover:bg-bg-app hover:text-[rgb(var(--color-primary))]'
            )}
          >
            {isHighlighted ? (
              <IconStarFilled className="h-[15px] w-[15px]" stroke={1.5} aria-hidden />
            ) : (
              <IconStar className="h-[15px] w-[15px] opacity-70" stroke={1.5} aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={onMarkLixo}
            data-tip="Marcar como lixo"
            aria-label="Marcar como lixo"
            className="news-action-btn flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-transparent bg-transparent text-text-secondary transition-colors hover:border-[#F7C1C1] hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
          >
            <IconTrash className="h-[15px] w-[15px] opacity-70" stroke={1.5} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  )
}
