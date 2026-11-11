'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, Newspaper } from 'lucide-react'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import { TseModal, TsePill, tseBotaoNeutroClass } from '@/components/tse/tse-ui'

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

function summaryUtil(title: string, summary: string | null | undefined): string | null {
  if (!summary?.trim()) return null
  const t = title.trim().toLowerCase()
  const s = summary.trim()
  if (s.toLowerCase() === t) return null
  if (s.toLowerCase().startsWith(t) && s.length < t.length + 40) return null
  return s
}

export function PanoramaNewsDayModal({ selection, onClose }: PanoramaNewsDayModalProps) {
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
      return
    }
    void carregar(selection)
  }, [selection, carregar])

  if (!selection) return null

  const dayLabel = formatDayLabel(selection.date)

  return (
    <TseModal
      id="panorama-news-day-title"
      titulo={
        <span className="inline-flex items-center gap-2">
          <Newspaper className="h-5 w-5 fill-[var(--tse-yellow)] text-[var(--tse-yellow)]" aria-hidden />
          Notícias relacionadas
        </span>
      }
      subtitulo={
        <span className="capitalize">
          {selection.name} · {dayLabel}
        </span>
      }
      largura="max-w-2xl"
      onClose={onClose}
      rodape={
        <>
          <p className="text-[12px] text-[var(--tse-muted)]">
            {loading
              ? 'Carregando…'
              : `${mentions.length} matéria${mentions.length === 1 ? '' : 's'} · heatmap: ${selection.count}`}
          </p>
          <button type="button" onClick={onClose} className={tseBotaoNeutroClass}>
            Fechar
          </button>
        </>
      }
    >
      {loading && mentions.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-[var(--tse-muted)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--tse-yellow)]" aria-hidden />
          Carregando matérias…
        </p>
      ) : null}

      {error ? <p className="py-6 text-center text-[13px] text-red-700">{error}</p> : null}

      {!loading && !error && mentions.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--tse-muted)]">
          Nenhuma matéria encontrada para este dia.
          {selection.count > 0
            ? ' Os dados do heatmap podem estar desatualizados — recarregue o panorama.'
            : null}
        </p>
      ) : null}

      {mentions.length > 0 ? (
        <ul className="overflow-hidden rounded-xl bg-white shadow-sm">
          {mentions.map((m, index) => {
            const resumo = summaryUtil(m.title, m.summary)
            return (
              <li
                key={m.id}
                className="border-t border-[#EEEEEE] first:border-t-0"
              >
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--tse-yellow-soft)]"
                >
                  <span className="mt-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-[var(--tse-bar)] text-[11px] font-black tabular-nums text-[var(--tse-gold-text)] group-hover:bg-[var(--tse-yellow)] group-hover:text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold leading-snug text-[var(--tse-text)] group-hover:underline">
                      {m.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <TsePill tom="neutro">{m.source_name ?? 'Fonte desconhecida'}</TsePill>
                      <span className="text-[11px] tabular-nums text-[var(--tse-muted)]">
                        {formatTime(m.published_at ?? m.collected_at)}
                      </span>
                    </div>
                    {resumo ? (
                      <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-[var(--tse-muted)]">
                        {resumo}
                      </p>
                    ) : null}
                  </div>
                  <ExternalLink
                    className="mt-1 h-4 w-4 shrink-0 text-[var(--tse-muted)] opacity-50 transition group-hover:text-[var(--tse-olive)] group-hover:opacity-100"
                    aria-hidden
                  />
                  <span className="sr-only">Abrir matéria</span>
                </a>
              </li>
            )
          })}
        </ul>
      ) : null}

    </TseModal>
  )
}
