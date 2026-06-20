'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, X } from 'lucide-react'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import { cn } from '@/lib/utils'

export type PanoramaNewsDaySelection = {
  slug: string
  name: string
  date: string
  count: number
  anchor: { x: number; y: number }
}

interface PanoramaNewsDayModalProps {
  selection: PanoramaNewsDaySelection | null
  onClose: () => void
}

const VIEWPORT_PADDING = 12
const ANCHOR_OFFSET = 10
const PANEL_WIDTH = 400
const PANEL_MAX_HEIGHT = 420

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

function clampPanelPosition(
  anchor: { x: number; y: number },
  panel: { width: number; height: number }
): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  let left = anchor.x + ANCHOR_OFFSET
  let top = anchor.y + ANCHOR_OFFSET

  if (left + panel.width + VIEWPORT_PADDING > vw) {
    left = anchor.x - panel.width - ANCHOR_OFFSET
  }
  if (left < VIEWPORT_PADDING) {
    left = Math.max(VIEWPORT_PADDING, vw - panel.width - VIEWPORT_PADDING)
  }

  if (top + panel.height + VIEWPORT_PADDING > vh) {
    top = anchor.y - panel.height - ANCHOR_OFFSET
  }
  if (top < VIEWPORT_PADDING) {
    top = VIEWPORT_PADDING
  }

  return { top, left }
}

export function PanoramaNewsDayModal({ selection, onClose }: PanoramaNewsDayModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [mentions, setMentions] = useState<GoogleNewsMentionWithActor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const carregar = useCallback(async (sel: PanoramaNewsDaySelection) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        politico: sel.slug,
        date: sel.date,
        limit: '100',
      })
      const res = await fetch(`/api/google-news/mentions?${params.toString()}`, { cache: 'no-store' })
      const j = (await res.json()) as {
        error?: string
        mentions?: GoogleNewsMentionWithActor[]
      }
      if (!res.ok) throw new Error(j.error ?? 'Falha ao carregar matérias.')
      setMentions(j.mentions ?? [])
    } catch (e) {
      setMentions([])
      setError(e instanceof Error ? e.message : 'Erro ao carregar matérias.')
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

  const updatePosition = useCallback(() => {
    if (!selection || !panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    setPosition(clampPanelPosition(selection.anchor, { width: rect.width, height: rect.height }))
  }, [selection])

  useLayoutEffect(() => {
    if (!selection) return
    updatePosition()
  }, [selection, loading, mentions.length, error, updatePosition])

  useEffect(() => {
    if (!selection) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onResize = () => updatePosition()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [selection, onClose, updatePosition])

  if (!selection) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/20"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={cn(
          'fixed flex flex-col overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface shadow-2xl',
          position ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        style={{
          top: position?.top ?? selection.anchor.y,
          left: position?.left ?? selection.anchor.x,
          width: `min(${PANEL_WIDTH}px, calc(100vw - ${VIEWPORT_PADDING * 2}px))`,
          maxHeight: `min(${PANEL_MAX_HEIGHT}px, calc(100vh - ${VIEWPORT_PADDING * 2}px))`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panorama-news-day-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--color-border-tertiary)/0.85)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-primary))]">
              Google News
            </p>
            <h2 id="panorama-news-day-title" className="truncate text-sm font-semibold text-text-primary">
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
              Carregando matérias…
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-status-danger">{error}</p>
          ) : mentions.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              Nenhuma matéria encontrada para este dia.
              {selection.count > 0
                ? ' Os dados do heatmap podem estar desatualizados — recarregue o panorama.'
                : null}
            </p>
          ) : (
            <ul className="space-y-2">
              {mentions.map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-[rgb(var(--color-border-tertiary)/0.6)] bg-bg-app px-3 py-2.5"
                >
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-sm font-medium leading-snug text-text-primary hover:text-[rgb(var(--color-primary))]"
                  >
                    <span className="min-w-0 flex-1">{m.title}</span>
                    <ExternalLink
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100"
                      aria-hidden
                    />
                  </a>
                  <p className="mt-1 text-[11px] text-text-muted">
                    {m.source_name ?? 'Fonte desconhecida'} · {formatTime(m.published_at)}
                  </p>
                  {m.summary ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-text-secondary">{m.summary}</p>
                  ) : null}
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
            : `${mentions.length} matéria${mentions.length === 1 ? '' : 's'} · heatmap: ${selection.count}`}
        </div>
      </div>
    </div>
  )
}
