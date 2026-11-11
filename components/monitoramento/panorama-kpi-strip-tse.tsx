'use client'

import { Instagram, Megaphone, Newspaper, Search, Youtube, type LucideIcon } from 'lucide-react'
import { TsePill, tseCardClass } from '@/components/tse/tse-ui'
import type { PanoramaPlatformId } from '@/lib/monitoramento-panorama-charts'
import type { PanoramaKpiBadge, PanoramaPlatformKpiCard } from '@/lib/monitoramento-panorama-kpis'
import { cn } from '@/lib/utils'

const PLATFORM_ORDER: PanoramaPlatformId[] = [
  'google-news',
  'instagram',
  'youtube',
  'google-trends',
  'meta-ads',
]

const PLATFORM_ICONS: Record<PanoramaPlatformId, LucideIcon> = {
  'google-news': Newspaper,
  instagram: Instagram,
  youtube: Youtube,
  'google-trends': Search,
  'meta-ads': Megaphone,
}

const TOM_BADGE: Record<PanoramaKpiBadge, 'amarelo' | 'verde' | 'neutro'> = {
  leader: 'amarelo',
  growth: 'verde',
  outsider: 'neutro',
}

export function PanoramaKpiStripTse({ cards }: { cards: PanoramaPlatformKpiCard[] }) {
  if (cards.length === 0) return null

  const ordered = PLATFORM_ORDER.map((id) => cards.find((c) => c.platformId === id)).filter(
    (c): c is PanoramaPlatformKpiCard => Boolean(c),
  )

  return (
    <section>
      <div className="mb-3">
        <p className="text-xl font-bold uppercase">Leitura rápida por plataforma</p>
        <p className="mt-1 hidden text-[15px] text-[var(--tse-muted)] sm:block">
          O primeiro indicador resume os últimos 30 dias; o segundo destaca quem mais avançou na comparação dos
          últimos 7 dias com a semana anterior.
        </p>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ordered.map((card) => {
          const Icone = PLATFORM_ICONS[card.platformId]
          const primario = card.insights[0]
          const secundario = card.insights[1]
          return (
            <article
              key={card.platformId}
              className={cn(tseCardClass, 'flex min-h-[8.5rem] min-w-0 flex-col', card.empty && 'opacity-70')}
            >
              <div className="flex items-start gap-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tse-yellow-soft)] text-[var(--tse-gold-text)]">
                  <Icone className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-bold leading-snug">{card.platformLabel}</h3>
                  <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--tse-muted)]">
                    {card.metricLabel}
                  </p>
                </div>
              </div>

              {card.empty || !primario ? (
                <p className="mt-auto pt-3 text-[13px] text-[var(--tse-muted)]">Sem dados suficientes no período.</p>
              ) : (
                <div className="mt-3 flex flex-1 flex-col gap-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TsePill tom={TOM_BADGE[primario.badge]}>{primario.badgeLabel}</TsePill>
                      {primario.name ? <span className="truncate text-[13px] font-bold">{primario.name}</span> : null}
                    </div>
                    <p className="mt-1.5 text-[20px] font-black leading-none tabular-nums text-[var(--tse-text)]">
                      {primario.text}
                    </p>
                  </div>
                  {secundario ? (
                    <div className="mt-auto border-t border-[#EEEEEE] pt-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TsePill tom={TOM_BADGE[secundario.badge]} className="text-[10px]">
                          {secundario.badgeLabel}
                        </TsePill>
                        {secundario.name ? (
                          <span className="truncate text-[12px] font-bold">{secundario.name}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12px] text-[var(--tse-muted)]">{secundario.text}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
