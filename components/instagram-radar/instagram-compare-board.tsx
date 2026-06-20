'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { buildInstagramRadarCompareRows } from '@/lib/instagram-radar-aggregate'
import type { InstagramRadarCompareActorRow } from '@/lib/instagram-radar-aggregate'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import { labelActorType } from '@/lib/youtube-radar-labels'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function formatDecimal(n: number, digits = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface InstagramCompareBoardProps {
  actors: PoliticalActorWithTerms[]
  posts: InstagramRadarPostWithActor[]
  lookbackDays: number
  loading?: boolean
}

function PostList({ posts }: { posts: InstagramRadarPostWithActor[] }) {
  if (posts.length === 0) {
    return (
      <p className="px-4 py-2.5 pl-10 text-xs text-text-muted">
        Nenhum post nesta janela. Cadastre o @ Instagram e rode a coleta Apify.
      </p>
    )
  }

  return (
    <ul className="border-t border-[rgb(var(--color-border-tertiary)/0.45)] bg-bg-app">
      {posts.slice(0, 12).map((post) => (
        <li
          key={post.id}
          className="flex items-start gap-3 border-b border-[rgb(var(--color-border-tertiary)/0.3)] px-4 py-2 pl-10 last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm text-text-primary">
              {post.caption?.trim() || '(sem legenda)'}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {formatDate(post.posted_at)}
              {post.post_type ? ` · ${post.post_type}` : ''}
              {' · '}
              {formatInt(post.likes_count)} curtidas · {formatInt(post.comments_count)} comentários
            </p>
          </div>
          <a
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[rgb(var(--color-primary))] hover:opacity-80"
            aria-label="Abrir post"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </li>
      ))}
    </ul>
  )
}

function ActorRow({ row }: { row: InstagramRadarCompareActorRow }) {
  const [open, setOpen] = useState(false)
  const { actor } = row

  return (
    <div className="border-b border-[rgb(var(--color-border-tertiary)/0.55)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-bg-app/60"
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-text-primary">{actor.name}</span>
            <span className="rounded bg-bg-app px-1.5 py-0.5 text-[10px] text-text-muted">
              {labelActorType(actor.actor_type)}
            </span>
            {row.instagramUsername ? (
              <span className="text-xs text-[rgb(var(--color-primary))]">@{row.instagramUsername}</span>
            ) : (
              <span className="text-xs text-amber-700">sem @</span>
            )}
            {row.actor.actor_type === 'own_candidate' ? (
              <span className="rounded bg-[#E6F1FB] px-1.5 py-0.5 text-[10px] font-medium text-[rgb(var(--color-primary))]">
                API própria
              </span>
            ) : (
              <span className="rounded bg-bg-app px-1.5 py-0.5 text-[10px] text-text-muted">Apify</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
            <span>{formatInt(row.postCount)} posts</span>
            <span>{formatDecimal(row.postsPerWeek)}/semana</span>
            <span>eng. médio {formatInt(row.avgEngagement)}</span>
            {row.reelCount > 0 ? <span>{formatInt(row.reelCount)} reels</span> : null}
          </div>
          {row.topPost ? (
            <p className="mt-1 truncate text-xs text-text-muted" title={row.topPost.caption ?? undefined}>
              Top: {formatInt(row.topPost.engagement)} eng. — {row.topPost.caption?.slice(0, 80) ?? '—'}
            </p>
          ) : null}
        </div>
      </button>
      {open ? <PostList posts={row.posts} /> : null}
    </div>
  )
}

export function InstagramCompareBoard({
  actors,
  posts,
  lookbackDays,
  loading = false,
}: InstagramCompareBoardProps) {
  const rows = buildInstagramRadarCompareRows(actors, posts, lookbackDays)

  if (loading) {
    return (
      <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-8 text-center text-sm text-text-muted">
        Carregando posts…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-8 text-center text-sm text-text-muted">
        Nenhum candidato ativo. Cadastre perfis em Candidatos monitorados.
      </div>
    )
  }

  const withIg = rows.filter((r) => r.instagramUsername)
  const withoutIg = rows.filter((r) => !r.instagramUsername)

  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface">
      <div className="border-b border-[rgb(var(--color-border-tertiary)/0.55)] px-4 py-2.5">
        <p className="text-sm font-medium text-text-primary">Comparativo Instagram · últimos {lookbackDays} dias</p>
        <p className="text-xs text-text-muted">
          Foco em conteúdo e engajamento relativo — não seguidores.
        </p>
      </div>
      {withIg.map((row) => (
        <ActorRow key={row.actor.id} row={row} />
      ))}
      {withoutIg.length > 0 ? (
        <Fragment>
          <p className="border-t border-[rgb(var(--color-border-tertiary)/0.55)] bg-amber-50 px-4 py-2 text-xs text-amber-900">
            {withoutIg.length} candidato{withoutIg.length === 1 ? '' : 's'} sem @ Instagram:{' '}
            {withoutIg.map((r) => r.actor.name).join(', ')}
          </p>
        </Fragment>
      ) : null}
    </div>
  )
}
