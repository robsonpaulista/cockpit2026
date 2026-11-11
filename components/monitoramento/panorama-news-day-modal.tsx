'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Loader2, X } from 'lucide-react'
import { computeAnchoredPopupPosition } from '@/lib/anchored-popup-position'
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

export function PanoramaNewsDayModal({ selection, onClose }: PanoramaNewsDayModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [mentions, setMentions] = useState<GoogleNewsMentionWithActor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const carregar = useCallback(async (sel: PanoramaNewsDaySelection) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        politico: sel.slug,
        date: sel.date,
        limit: '100',
        channel: 'news',
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
        className="fixed z-[120] flex w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[var(--tse-border)] bg-white shadow-2xl"
        style={{
          left: position?.left ?? -9999,
          top: position?.top ?? -9999,
          visibility: position ? 'visible' : 'hidden',
          maxHeight: 'min(420px, calc(100vh - 1.5rem))',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panorama-news-day-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--tse-border)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--tse-muted)]">Notícias relacionadas</p>
            <h2 id="panorama-news-day-title" className="truncate text-sm font-semibold text-[var(--tse-text)]">
              {selection.name}
            </h2>
            <p className="mt-0.5 text-xs capitalize text-[var(--tse-muted)]">{formatDayLabel(selection.date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--tse-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando matérias…
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-status-danger">{error}</p>
          ) : mentions.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--tse-muted)]">
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
                  className="rounded-lg border border-[var(--tse-border)] bg-[var(--tse-bar)] px-3 py-2.5"
                >
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-sm font-medium leading-snug text-[var(--tse-text)] hover:text-[var(--tse-muted)]"
                  >
                    <span className="min-w-0 flex-1">{m.title}</span>
                    <ExternalLink
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100"
                      aria-hidden
                    />
                  </a>
                  <p className="mt-1 text-[11px] text-[var(--tse-muted)]">
                    {m.source_name ?? 'Fonte desconhecida'} ·{' '}
                    {formatTime(m.published_at ?? m.collected_at)}
                  </p>
                  {m.summary ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-[var(--tse-muted)]">{m.summary}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className={cn(
            'border-t border-[var(--tse-border)] px-4 py-2.5 text-[11px] text-[var(--tse-muted)]',
            loading ? 'opacity-60' : ''
          )}
        >
          {loading
            ? '…'
            : `${mentions.length} matéria${mentions.length === 1 ? '' : 's'} · heatmap: ${selection.count}`}
        </div>
      </div>
    </>
  )

  return createPortal(panel, document.body)
}
