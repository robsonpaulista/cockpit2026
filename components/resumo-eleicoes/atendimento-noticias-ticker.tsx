'use client'

import { useEffect, useMemo, useState } from 'react'
import { Newspaper } from 'lucide-react'
import {
  fetchAtendimentoNoticiasMunicipio,
  type AtendimentoNoticiasPayload,
} from '@/lib/services/atendimento-noticias-client'
import type { PortalNoticiaItem } from '@/lib/radar-224/scrape-listagem-portal'

function TickerItems({ itens, prefix }: { itens: PortalNoticiaItem[]; prefix: string }) {
  return (
    <>
      {itens.map((n) => (
        <a
          key={`${prefix}-${n.fonteId}-${n.articleId}`}
          href={n.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[12px] text-[var(--tse-text)] hover:underline"
          title={n.title}
        >
          <span className="text-[var(--tse-muted)]">
            {n.category || n.fonteNome}
            {n.publishedLabel ? ` · ${n.publishedLabel}` : ''}
          </span>
          <span className="font-medium">{n.title}</span>
          <span className="text-[var(--tse-muted)]" aria-hidden>
            ·
          </span>
        </a>
      ))}
    </>
  )
}

export function AtendimentoNoticiasTicker({ municipio }: { municipio: string }) {
  const [payload, setPayload] = useState<AtendimentoNoticiasPayload | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchAtendimentoNoticiasMunicipio(municipio)
      .then((data) => {
        if (!cancelled) setPayload(data)
      })
      .catch(() => {
        if (!cancelled) setPayload(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [municipio])

  const itens = payload?.itens ?? []
  // Com poucas matérias a faixa fica curta e “parece” mais rápida — piso mais alto.
  const durationSec = useMemo(
    () => Math.max(90, Math.min(160, Math.max(itens.length, 5) * 14)),
    [itens.length],
  )

  if (!loading && itens.length === 0) return null

  return (
    <section
      className="mt-2 flex h-8 items-stretch overflow-hidden rounded-lg border border-[#E6E6E3] bg-white"
      aria-label={`Notícias de ${municipio}`}
    >
      <div className="flex shrink-0 items-center gap-1.5 border-r border-[#E6E6E3] bg-[#F5F6F8] px-2.5 text-[10px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
        <Newspaper className="h-3.5 w-3.5" aria-hidden />
        Notícias
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {loading && itens.length === 0 ? (
          <p className="flex h-full items-center px-3 text-[12px] text-[var(--tse-muted)]">Carregando notícias…</p>
        ) : (
          <div
            className="atendimento-noticias-ticker-track absolute inset-y-0 left-0 items-center gap-6 px-3"
            style={{ animationDuration: `${durationSec}s` }}
          >
            <TickerItems itens={itens} prefix="a" />
            <TickerItems itens={itens} prefix="b" />
          </div>
        )}
      </div>
    </section>
  )
}
