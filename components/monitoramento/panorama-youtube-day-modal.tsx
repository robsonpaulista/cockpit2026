'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Loader2, X } from 'lucide-react'
import { computeAnchoredPopupPosition } from '@/lib/anchored-popup-position'
import type { YoutubeMentionWithActor } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

export type PanoramaYoutubeDaySelection = {
  slug: string
  name: string
  date: string
  count: number
  anchor: { x: number; y: number }
}

interface PanoramaYoutubeDayModalProps {
  selection: PanoramaYoutubeDaySelection | null
  onClose: () => void
}

const PANEL_WIDTH = 400
const PANEL_ESTIMATED_HEIGHT = 360

function formatDayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatViews(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function PanoramaYoutubeDayModal({ selection, onClose }: PanoramaYoutubeDayModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [mentions, setMentions] = useState<YoutubeMentionWithActor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const carregar = useCallback(async (sel: PanoramaYoutubeDaySelection) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        politico: sel.slug,
        date: sel.date,
        limit: '100',
      })
      const res = await fetch(`/api/youtube/mentions?${params.toString()}`, { cache: 'no-store' })
      const j = (await res.json()) as {
        error?: string
        mentions?: YoutubeMentionWithActor[]
      }
      if (!res.ok) throw new Error(j.error ?? 'Falha ao carregar vídeos.')
      setMentions(j.mentions ?? [])
    } catch (e) {
      setMentions([])
      setError(e instanceof Error ? e.message : 'Erro ao carregar vídeos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selection) {
      setMentions([])
      setError('')
      setPosition(null)
      return
    }
    void carregar(selection)
  }, [selection, carregar])

  useLayoutEffect(() => {
    if (!selection) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      if (!selection) return
      const rect = panelRef.current?.getBoundingClientRect()
      const width = rect && rect.width > 0 ? rect.width : PANEL_WIDTH
      const height = rect && rect.height > 0 ? rect.height : PANEL_ESTIMATED_HEIGHT
      setPosition(computeAnchoredPopupPosition(selection.anchor, width, height))
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [selection, loading, mentions.length, error])

  useEffect(() => {
    if (!selection) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, onClose])

  if (!mounted || !selection) return null

  const totalViews = mentions.reduce((sum, mention) => sum + (mention.views ?? 0), 0)

  const panel = (
    <>
      <div
        className="fixed inset-0 z-[119] bg-black/25"
        role="presentation"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        className="fixed z-[120] flex w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface shadow-2xl"
        style={{
          left: position?.left ?? -9999,
          top: position?.top ?? -9999,
          visibility: position ? 'visible' : 'hidden',
          maxHeight: 'min(420px, calc(100vh - 1.5rem))',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panorama-youtube-day-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--color-border-tertiary)/0.85)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#DC2626]">YouTube</p>
            <h2 id="panorama-youtube-day-title" className="truncate text-sm font-semibold text-text-primary">
              {selection.name}
            </h2>
            <p className="mt-0.5 text-xs capitalize text-text-muted">{formatDayLabel(selection.date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-bg-app hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando vídeos…
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-status-danger">{error}</p>
          ) : mentions.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              Nenhum vídeo encontrado para este dia.
              {selection.count > 0
                ? ' Os dados do heatmap podem estar desatualizados — recarregue o panorama.'
                : null}
            </p>
          ) : (
            <ul className="space-y-2">
              {mentions.map((mention) => (
                <li
                  key={mention.id}
                  className="rounded-lg border border-[rgb(var(--color-border-tertiary)/0.6)] bg-bg-app px-3 py-2.5"
                >
                  <a
                    href={mention.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-sm font-medium leading-snug text-text-primary hover:text-[rgb(var(--color-primary))]"
                  >
                    <span className="min-w-0 flex-1">{mention.video_title}</span>
                    <ExternalLink
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100"
                      aria-hidden
                    />
                  </a>
                  <p className="mt-1 text-[11px] text-text-muted">
                    {mention.channel_title ?? 'Canal desconhecido'} · {formatTime(mention.published_at)} ·{' '}
                    {formatViews(mention.views ?? 0)} views
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className={cn(
            'border-t border-[rgb(var(--color-border-tertiary)/0.85)] px-4 py-2.5 text-[11px] text-text-muted',
            loading ? 'opacity-60' : ''
          )}
        >
          {loading
            ? '…'
            : `${mentions.length} vídeo${mentions.length === 1 ? '' : 's'} · ${formatViews(totalViews)} views · heatmap: ${formatViews(selection.count)}`}
        </div>
      </div>
    </>
  )

  return createPortal(panel, document.body)
}
