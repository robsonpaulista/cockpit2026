'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { buildYoutubeCompareRows } from '@/lib/youtube-radar-aggregate'
import type { YoutubeCompareChannelRow } from '@/lib/youtube-radar-aggregate'
import { labelActorType } from '@/lib/youtube-radar-labels'
import type { PoliticalActorWithTerms, YoutubeMentionWithActor } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface YoutubeCompareBoardProps {
  actors: PoliticalActorWithTerms[]
  mentions: YoutubeMentionWithActor[]
  lookbackDays: number
  loading?: boolean
}

function TopChannelsInline({ channels }: { channels: YoutubeCompareChannelRow[] }) {
  if (channels.length === 0) {
    return <span className="text-xs text-text-muted">—</span>
  }

  const label = channels.map((c) => `${c.channel_title} (${c.count})`).join(' · ')

  return (
    <p className="truncate text-xs text-text-secondary" title={label}>
      {channels.map((c, i) => (
        <Fragment key={c.channel_title}>
          {i > 0 ? <span className="text-text-muted"> · </span> : null}
          {c.channel_title}
          <span className="text-text-muted"> ({c.count})</span>
        </Fragment>
      ))}
    </p>
  )
}

function MentionList({ mentions }: { mentions: YoutubeMentionWithActor[] }) {
  if (mentions.length === 0) {
    return (
      <p className="px-4 py-2.5 pl-10 text-xs text-text-muted">
        Nenhum vídeo nesta janela. Rode a busca no YouTube para este candidato.
      </p>
    )
  }

  return (
    <ul className="border-t border-[rgb(var(--color-border-tertiary)/0.45)] bg-bg-app">
      {mentions.map((m) => (
        <li
          key={m.id}
          className="flex items-center gap-3 border-b border-[rgb(var(--color-border-tertiary)/0.3)] px-4 py-2 pl-10 last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-text-primary" title={m.video_title}>
              {m.video_title}
            </p>
            <p className="truncate text-[11px] text-text-muted">
              {m.channel_title ?? '—'} · {formatDate(m.published_at)} · {m.search_term}
            </p>
          </div>
          <span className="shrink-0 text-right text-sm font-medium tabular-nums text-text-primary">
            {formatInt(m.views)}
          </span>
          <a
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[rgb(var(--color-primary))]"
            aria-label={`Abrir ${m.video_title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  )
}

export function YoutubeCompareBoard({ actors, mentions, lookbackDays, loading = false }: YoutubeCompareBoardProps) {
  const rows = useMemo(() => buildYoutubeCompareRows(actors, mentions), [actors, mentions])
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)

  const toggleRow = (slug: string) => {
    setExpandedSlug((prev) => (prev === slug ? null : slug))
  }

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
        Cadastre candidatos ativos acima e rode a busca no YouTube.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface">
      <div className="border-b border-[rgb(var(--color-border-tertiary)/0.85)] px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">Comparativo · últimos {lookbackDays} dias</h2>
        <p className="text-xs text-text-muted">Menções em vídeos públicos por candidato monitorado</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[rgb(var(--color-border-tertiary)/0.85)] text-[10px] font-medium uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">Candidato</th>
              <th className="w-20 px-3 py-2 text-right font-medium">Vídeos</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Views</th>
              <th className="px-4 py-2 font-medium">Principais canais</th>
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
                        onClick={() => toggleRow(row.actor.slug)}
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
                      {formatInt(row.videoCount)}
                    </td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-text-primary">
                      {formatInt(row.totalViews)}
                    </td>
                    <td className="max-w-0 px-4 py-2">
                      <TopChannelsInline channels={row.topChannels} />
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b border-[rgb(var(--color-border-tertiary)/0.5)]">
                      <td colSpan={4} className="p-0">
                        <MentionList mentions={row.mentions} />
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
