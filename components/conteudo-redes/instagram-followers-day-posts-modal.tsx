'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BarChart4, Download, ExternalLink, Eye, Heart, MessageCircle, Share2, X } from 'lucide-react'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'
import { TseCarregando, tseLinkAcaoClass } from '@/components/tse/tse-ui'
import type { InstagramDayPostRecord } from '@/lib/instagram-engagement-history'
import { formatEngagementValue, formatFollowersDelta } from '@/lib/instagram-followers-history-chart'
import { computeAnchoredPopupPosition, type PopupAnchor } from '@/lib/anchored-popup-position'

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

function Metrica({ icon: Icon, label, value }: { icon: typeof Heart; label: string; value: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-[var(--tse-bar)] px-2 py-1 text-[11px]"
      title={label}
    >
      <Icon className="h-3.5 w-3.5 text-[var(--tse-gold-text)]" />
      <strong className="tabular-nums">{value.toLocaleString('pt-BR')}</strong>
    </span>
  )
}

function PostDoDia({ post }: { post: InstagramDayPostRecord }) {
  return (
    <article className="overflow-hidden rounded-xl border border-[var(--tse-border)] bg-white">
      <div className="relative h-28 w-full bg-[var(--tse-bar)]">
        {post.thumbnail ? (
          <img src={post.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-[var(--tse-muted)]">Sem preview</div>
        )}
        <span className="absolute left-2 top-2 rounded bg-[var(--tse-yellow)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {TYPE_LABELS[post.type] ?? post.type}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Metrica icon={Heart} label="Curtidas" value={post.metrics.likes} />
          <Metrica icon={MessageCircle} label="Comentários" value={post.metrics.comments} />
          <Metrica icon={Share2} label="Compartilhamentos" value={post.metrics.shares} />
          <Metrica icon={Download} label="Salvamentos" value={post.metrics.saves} />
          {post.metrics.views > 0 ? <Metrica icon={Eye} label="Visualizações" value={post.metrics.views} /> : null}
          <Metrica icon={BarChart4} label="Engajamento" value={post.metrics.engagement} />
        </div>
        <p className="line-clamp-2 text-[12px]">{post.caption?.trim() || 'Sem legenda'}</p>
        {post.url ? (
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-2 inline-flex items-center gap-1 ${tseLinkAcaoClass}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir no Instagram
          </a>
        ) : null}
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
    <div style={TSE_TOKENS} className="text-[var(--tse-text)]">
      <div className="fixed inset-0 z-[119]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        className="fixed z-[120] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
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
        <div className="flex items-start justify-between gap-3 bg-[var(--tse-bar)] px-4 py-3">
          <div className="min-w-0">
            <h3 id="followers-day-posts-title" className="text-[15px] font-bold">
              Publicações · {displayDate}
            </h3>
            <p className="mt-1 text-[12px] text-[var(--tse-muted)]">
              Seguidores:{' '}
              <strong
                className={
                  followerDelta > 0
                    ? 'text-[var(--tse-olive)]'
                    : followerDelta < 0
                      ? 'text-[#B42318]'
                      : 'text-[var(--tse-text)]'
                }
              >
                {formatFollowersDelta(followerDelta)}
              </strong>
              {typeof avgEngagement === 'number' ? (
                <>
                  {' '}
                  · Engajamento médio:{' '}
                  <strong className="text-[var(--tse-gold-text)]">{formatEngagementValue(avgEngagement)}</strong>
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-white hover:text-[var(--tse-text)]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <TseCarregando texto="Carregando…" className="min-h-32" />
          ) : posts.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--tse-border)] text-[13px] text-[var(--tse-muted)]">
              <p>Nenhuma publicação neste dia.</p>
              <p className="mt-1 text-[11px]">{publishDate}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <PostDoDia key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
