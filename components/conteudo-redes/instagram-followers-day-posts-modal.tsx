'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BarChart4,
  Download,
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  Share2,
  X,
  Eye,
} from 'lucide-react'
import type { InstagramDayPostRecord } from '@/lib/instagram-engagement-history'
import { formatEngagementValue, formatFollowersDelta } from '@/lib/instagram-followers-history-chart'
import { computeAnchoredPopupPosition, type PopupAnchor } from '@/lib/anchored-popup-position'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<string, string> = {
  image: 'Imagem',
  video: 'Vídeo',
  carousel: 'Carrossel',
}

type InstagramFollowersDayPostsModalProps = {
  open: boolean
  onClose: () => void
  anchor: PopupAnchor | null
  publishDate: string
  displayDate: string
  followerDelta: number
  avgEngagement?: number | null
  posts: InstagramDayPostRecord[]
  loading?: boolean
}

function MetricPill({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Heart
  label: string
  value: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-card bg-background px-2 py-1 text-xs',
        className
      )}
      title={label}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-semibold text-text-primary">{value.toLocaleString('pt-BR')}</span>
    </div>
  )
}

function PostCard({ post }: { post: InstagramDayPostRecord }) {
  const typeLabel = TYPE_LABELS[post.type] ?? post.type

  return (
    <article className="overflow-hidden rounded-xl border border-card bg-surface">
      <div className="flex flex-col">
        <div className="relative h-28 w-full shrink-0 bg-background">
          {post.thumbnail ? (
            <img src={post.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-secondary">Sem preview</div>
          )}
          <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            {typeLabel}
          </span>
        </div>

        <div className="border-t border-card bg-surface-secondary px-3 py-2.5">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <MetricPill icon={Heart} label="Curtidas" value={post.metrics.likes} className="text-red-600" />
            <MetricPill
              icon={MessageCircle}
              label="Comentários"
              value={post.metrics.comments}
              className="text-blue-600"
            />
            <MetricPill icon={Share2} label="Compartilhamentos" value={post.metrics.shares} className="text-green-600" />
            <MetricPill icon={Download} label="Salvamentos" value={post.metrics.saves} className="text-orange-600" />
            {post.metrics.views > 0 ? (
              <MetricPill icon={Eye} label="Visualizações" value={post.metrics.views} className="text-cyan-600" />
            ) : null}
            <MetricPill
              icon={BarChart4}
              label="Engajamento"
              value={post.metrics.engagement}
              className="text-accent-gold"
            />
          </div>
          <p className="line-clamp-2 text-xs text-text-primary">{post.caption?.trim() || 'Sem legenda'}</p>
          {post.url ? (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-gold hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir no Instagram
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function InstagramFollowersDayPostsModal({
  open,
  onClose,
  anchor,
  publishDate,
  displayDate,
  followerDelta,
  avgEngagement,
  posts,
  loading = false,
}: InstagramFollowersDayPostsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchor || !panelRef.current) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      if (!panelRef.current || !anchor) return
      const rect = panelRef.current.getBoundingClientRect()
      setPosition(computeAnchoredPopupPosition(anchor, rect.width, rect.height))
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, anchor, posts.length, loading])

  if (!open || !anchor) return null

  const panel = (
    <>
      <div className="fixed inset-0 z-[119]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        className="fixed z-[120] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-card bg-bg-surface shadow-2xl"
        style={{
          left: position?.left ?? -9999,
          top: position?.top ?? -9999,
          visibility: position ? 'visible' : 'hidden',
          maxHeight: 'min(70vh, 520px)',
        }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="followers-day-posts-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-card px-4 py-3">
          <div className="min-w-0">
            <h3 id="followers-day-posts-title" className="text-base font-semibold text-text-primary">
              Publicações · {displayDate}
            </h3>
            <p className="mt-1 text-xs text-secondary">
              Seguidores:{' '}
              <span
                className={cn(
                  'font-semibold',
                  followerDelta > 0
                    ? 'text-status-success'
                    : followerDelta < 0
                      ? 'text-status-error'
                      : 'text-text-primary'
                )}
              >
                {formatFollowersDelta(followerDelta)}
              </span>
              {typeof avgEngagement === 'number' ? (
                <>
                  {' '}
                  · Engajamento médio:{' '}
                  <span className="font-semibold text-indigo-600">
                    {formatEngagementValue(avgEngagement)}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-card p-1.5 text-secondary transition-colors hover:bg-background hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex h-32 flex-col items-center justify-center text-secondary">
              <Loader2 className="mb-2 h-6 w-6 animate-spin text-accent-gold" />
              <p className="text-sm">Carregando...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-card text-secondary">
              <p className="text-sm">Nenhuma publicação neste dia.</p>
              <p className="mt-1 text-xs">{publishDate}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )

  return createPortal(panel, document.body)
}
