'use client'

import { IconMapPin } from '@tabler/icons-react'
import type { InstagramCityCaptionAggregate } from '@/lib/instagram-city-caption-stats'
import { cn } from '@/lib/utils'
import { conteudoRedesAmberTextClass } from '@/lib/conteudo-redes-styles'
import { InstagramCityTrendChart } from '@/components/conteudo-redes/instagram-city-trend-chart'

type SortKey = 'engagement' | 'likes' | 'comments' | 'posts' | 'avgEngagement'

type Props = {
  aggregate: InstagramCityCaptionAggregate
  sortKey?: SortKey
  cardClassName?: string
}

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function InstagramCaptionCityRanking({
  aggregate,
  sortKey = 'engagement',
  cardClassName = 'rounded-[18px] border border-[#ebe8e4] bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.03)]',
}: Props) {
  const cities = [...aggregate.cities].sort((a, b) => {
    const av =
      sortKey === 'likes'
        ? a.likes
        : sortKey === 'comments'
          ? a.comments
          : sortKey === 'posts'
            ? a.posts
            : sortKey === 'avgEngagement'
              ? a.avgEngagement
              : a.engagement
    const bv =
      sortKey === 'likes'
        ? b.likes
        : sortKey === 'comments'
          ? b.comments
          : sortKey === 'posts'
            ? b.posts
            : sortKey === 'avgEngagement'
              ? b.avgEngagement
              : b.engagement
    if (bv !== av) return bv - av
    return a.municipio.localeCompare(b.municipio, 'pt-BR')
  })

  const maxPrimary = Math.max(
    ...cities.map((c) =>
      sortKey === 'likes'
        ? c.likes
        : sortKey === 'comments'
          ? c.comments
          : sortKey === 'posts'
            ? c.posts
            : sortKey === 'avgEngagement'
              ? c.avgEngagement
              : c.engagement,
    ),
    0,
  )

  if (aggregate.postsTotal === 0) {
    return (
      <div className="py-12 text-center">
        <IconMapPin className={cn('mx-auto mb-4 h-12 w-12 opacity-70', conteudoRedesAmberTextClass)} stroke={1.5} />
        <p className="mb-2 font-medium">Nenhuma publicação no período</p>
        <p className="mx-auto max-w-lg text-sm text-[#78716c]">
          Carregue ou atualize os dados do Instagram para medir engajamento por cidade citada na
          legenda.
        </p>
      </div>
    )
  }

  if (cities.length === 0) {
    return (
      <div className="py-12 text-center">
        <IconMapPin
          className={cn('mx-auto mb-4 h-12 w-12 opacity-70', conteudoRedesAmberTextClass)}
          stroke={1.5}
        />
        <p className="mb-2 font-medium">Nenhuma cidade detectada nas legendas</p>
        <p className="mx-auto max-w-lg text-sm text-[#78716c]">
          Analisamos o header (primeira linha) e o corpo das {formatInt(aggregate.postsTotal)}{' '}
          postagens em busca dos 224 municípios do Piauí. Ajuste o formato do header (ex.: nome da
          cidade na primeira linha) para melhorar a cobertura.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[#78716c]">
        Match nos 224 municípios do PI pelo header da legenda · {formatInt(aggregate.postsWithCity)}{' '}
        de {formatInt(aggregate.postsTotal)} posts com cidade
        {aggregate.postsWithoutCity > 0
          ? ` · ${formatInt(aggregate.postsWithoutCity)} sem match`
          : ''}
        . Ordenado por engajamento · 1 ponto por dia (posts no mesmo dia somados).
      </p>

      <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:max-w-3xl">
        <div className={cn(cardClassName, 'p-3')}>
          <p className="text-[11px] uppercase tracking-wide text-[#a8a29e]">Cidades</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[#1c1917]">
            {formatInt(cities.length)}
          </p>
        </div>
        <div className={cn(cardClassName, 'p-3')}>
          <p className="text-[11px] uppercase tracking-wide text-[#a8a29e]">Posts com cidade</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[#1c1917]">
            {formatInt(aggregate.postsWithCity)}
          </p>
        </div>
        <div className={cn(cardClassName, 'p-3')}>
          <p className="text-[11px] uppercase tracking-wide text-[#a8a29e]">Curtidas</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[#1c1917]">
            {formatInt(cities.reduce((s, c) => s + c.likes, 0))}
          </p>
        </div>
        <div className={cn(cardClassName, 'p-3')}>
          <p className="text-[11px] uppercase tracking-wide text-[#a8a29e]">Engajamento</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[#1c1917]">
            {formatInt(cities.reduce((s, c) => s + c.engagement, 0))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cities.map((city, index) => {
          const primary =
            sortKey === 'likes'
              ? city.likes
              : sortKey === 'comments'
                ? city.comments
                : sortKey === 'posts'
                  ? city.posts
                  : sortKey === 'avgEngagement'
                    ? city.avgEngagement
                    : city.engagement
          const barWidth = maxPrimary > 0 ? (primary / maxPrimary) * 100 : 0

          return (
            <div key={city.municipio} className={cn(cardClassName, 'p-4')}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-medium',
                      index === 0 ? 'bg-[#f04b23] text-white' : 'bg-[#f04b23]/12 text-[#f04b23]',
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-[#1c1917]">
                      {city.municipio}
                    </p>
                    <p className="text-[11px] text-[#78716c]">
                      {formatInt(city.posts)} post{city.posts === 1 ? '' : 's'}
                      {' · '}
                      média {formatInt(city.avgEngagement)} eng.
                      {' · '}
                      {formatInt(city.avgLikes)} curtidas/post
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-semibold tabular-nums text-[#1c1917]">
                    {formatInt(primary)}
                  </p>
                  <p className="text-[11px] text-[#a8a29e]">
                    {sortKey === 'likes'
                      ? 'curtidas'
                      : sortKey === 'comments'
                        ? 'comentários'
                        : sortKey === 'posts'
                          ? 'posts'
                          : sortKey === 'avgEngagement'
                            ? 'eng. médio'
                            : 'engajamento'}
                  </p>
                </div>
              </div>

              <InstagramCityTrendChart
                points={city.series.map((p) => ({
                  date: p.postedAt,
                  value: p.engagement,
                  postsCount: p.postsInDay ?? 1,
                  label: new Date(p.postedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }),
                }))}
                valueLabel="Engajamento"
                emptyHint={
                  city.posts <= 1
                    ? 'Só 1 post nesta cidade no período — precisa de mais postagens para ver tendência.'
                    : 'Sem data nas postagens para montar a linha do tempo.'
                }
              />

              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#f3f1ec]">
                <div
                  className="h-full rounded-full bg-[#f04b23] transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
