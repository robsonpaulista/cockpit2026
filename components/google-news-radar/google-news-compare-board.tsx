'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { buildGoogleNewsCompareRows } from '@/lib/google-news-aggregate'
import type { GoogleNewsCompareSourceRow } from '@/lib/google-news-aggregate'
import { labelActorType } from '@/lib/youtube-radar-labels'
import { labelGoogleNewsCollectChannel, labelGoogleNewsPlatform } from '@/lib/google-news-platform'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

/** Extrai texto de data relativa do summary (vídeos Google). */
function extractVideoDateHint(summary: string | null | undefined): string | null {
  if (!summary?.trim()) return null
  const patterns = [
    /\d{1,2}\s+de\s+[\wçãéíóú.]+\s+de\s+\d{4}/i,
    /\d+\s+[\wçãéíóú]+\s+atrás/i,
    /há\s+\d+\s*[\wçãéíóú]+/i,
    /\d+\s+(?:weeks?|days?|hours?|months?|years?)\s+ago/i,
    /\b(?:ontem|hoje|yesterday|today)\b/i,
  ]
  for (const pattern of patterns) {
    const match = summary.match(pattern)
    if (match?.[0]) return match[0].trim()
  }
  return null
}

function formatDate(
  iso: string | null,
  fallbackIso?: string | null,
  preferVideoDate = false,
  dateHint?: string | null
): string {
  if (preferVideoDate) {
    if (iso) {
      const formatted = new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      if (dateHint?.trim()) return `${formatted} (${dateHint.trim()})`
      return formatted
    }
    if (dateHint?.trim()) return dateHint.trim()
    return 'data indisponível'
  }
  const value = iso ?? fallbackIso
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface GoogleNewsCompareBoardProps {
  actors: PoliticalActorWithTerms[]
  mentions: GoogleNewsMentionWithActor[]
  lookbackDays: number
  loading?: boolean
  variant?: 'news' | 'videos'
}

function TopSourcesInline({ sources }: { sources: GoogleNewsCompareSourceRow[] }) {
  if (sources.length === 0) {
    return <span className="text-xs text-text-muted">—</span>
  }

  const label = sources.map((s) => `${s.source_name} (${s.count})`).join(' · ')

  return (
    <p className="truncate text-xs text-text-secondary" title={label}>
      {sources.map((s, i) => (
        <Fragment key={s.source_name}>
          {i > 0 ? <span className="text-text-muted"> · </span> : null}
          {s.source_name}
          <span className="text-text-muted"> ({s.count})</span>
        </Fragment>
      ))}
    </p>
  )
}

function ArticleList({
  mentions,
  emptyMessage,
  preferVideoDate = false,
}: {
  mentions: GoogleNewsMentionWithActor[]
  emptyMessage: string
  preferVideoDate?: boolean
}) {
  if (mentions.length === 0) {
    return <p className="px-4 py-2.5 pl-10 text-xs text-text-muted">{emptyMessage}</p>
  }

  return (
    <ul className="border-t border-[rgb(var(--color-border-tertiary)/0.45)] bg-bg-app">
      {mentions.map((m) => (
        <li
          key={m.id}
          className={cn(
            'flex gap-3 border-b border-[rgb(var(--color-border-tertiary)/0.3)] px-4 py-2.5 pl-10 last:border-b-0',
            preferVideoDate ? 'items-start' : 'items-center'
          )}
        >
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-sm text-text-primary',
                preferVideoDate ? 'whitespace-normal leading-snug' : 'truncate'
              )}
              title={m.title}
            >
              {m.title}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-text-muted">
              <span className="font-medium text-[#C8900A]">
                {labelGoogleNewsPlatform(m.platform ?? 'website')}
              </span>
              {' · '}
              {m.source_name ?? '—'}
              {' · '}
              {labelGoogleNewsCollectChannel(m.collect_channel ?? 'google_news_rss')}
              {' · '}
              {formatDate(
                m.published_at,
                m.collected_at,
                preferVideoDate,
                preferVideoDate ? extractVideoDateHint(m.summary) : null
              )}
            </p>
          </div>
          <a
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('shrink-0 text-[rgb(var(--color-primary))]', preferVideoDate && 'mt-0.5')}
            aria-label={`Abrir ${m.title}`}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  )
}

export function GoogleNewsCompareBoard({
  actors,
  mentions,
  lookbackDays,
  loading = false,
  variant = 'news',
}: GoogleNewsCompareBoardProps) {
  const isVideos = variant === 'videos'
  const filteredMentions = mentions.filter((m) => {
    const ch = m.collect_channel ?? 'google_news_rss'
    return isVideos ? ch === 'google_videos' : ch === 'google_news_rss' || ch === 'google_web'
  })

  const rows = buildGoogleNewsCompareRows(actors, filteredMentions)
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)

  const emptyMessage = isVideos
    ? 'Nenhum vídeo nesta janela. Rode a coleta na aba Google Vídeos (piloto castração).'
    : 'Nenhuma menção nesta janela. Rode a coleta para buscar no Google Notícias e na web.'

  const boardEmptyMessage = isVideos
    ? 'Configure APIFY_TOKEN e rode a coleta (piloto castração / causa animal).'
    : 'Cadastre candidatos ativos e rode a coleta (Google Notícias + busca web).'

  const subtitle = isVideos
    ? 'Vídeos indexados na aba Vídeos do Google (Playwright — piloto castração): Instagram, Facebook, YouTube…'
    : 'Menções no Google Notícias (RSS) e na busca web'

  const countLabel = isVideos ? 'Vídeos' : 'Notícias'

  if (loading) {
    return (
      <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-10 text-center text-sm text-text-muted">
        Carregando quadro comparativo…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-6 py-12 text-center text-sm text-text-muted">
        {boardEmptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface">
      <div className="border-b border-[rgb(var(--color-border-tertiary)/0.85)] px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">Comparativo · últimos {lookbackDays} dias</h2>
        <p className="text-xs text-text-muted">{subtitle}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[rgb(var(--color-border-tertiary)/0.85)] text-[10px] font-medium uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">Candidato</th>
              <th className="w-24 px-3 py-2 text-right font-medium">{countLabel}</th>
              <th className="px-4 py-2 font-medium">Principais fontes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const expanded = expandedSlug === row.actor.slug

              return (
                <Fragment key={row.actor.id}>
                  <tr
                    className={cn(
                      'border-b border-[rgb(var(--color-border-tertiary)/0.5)] transition-colors',
                      expanded ? 'bg-[#E6F1FB]/40' : 'hover:bg-bg-app'
                    )}
                  >
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setExpandedSlug(expanded ? null : row.actor.slug)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left"
                        aria-expanded={expanded}
                      >
                        <span className="shrink-0 text-text-muted">
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-text-primary">
                            {row.actor.name}
                          </span>
                          <span className="block text-[11px] text-text-muted">
                            {labelActorType(row.actor.actor_type)}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium tabular-nums text-text-primary">
                      {formatInt(row.articleCount)}
                    </td>
                    <td className="max-w-0 px-4 py-2">
                      <TopSourcesInline sources={row.topSources} />
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b border-[rgb(var(--color-border-tertiary)/0.5)]">
                      <td colSpan={3} className="p-0">
                        <ArticleList
                          mentions={row.mentions}
                          emptyMessage={emptyMessage}
                          preferVideoDate={isVideos}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
