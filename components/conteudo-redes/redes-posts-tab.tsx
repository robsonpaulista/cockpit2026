'use client'

import { useMemo, useState } from 'react'
import { Download, Eye, Heart, MessageCircle, Share2, TrendingUp } from 'lucide-react'
import { ChampionPostCard } from '@/components/conteudo-redes/champion-post-card'
import { InstagramBestPostByThemeTable } from '@/components/conteudo-redes/instagram-best-post-by-theme-table'
import { InstagramContentTypeComparison } from '@/components/conteudo-redes/instagram-content-type-comparison'
import { InstagramFollowersHistoryChart } from '@/components/conteudo-redes/instagram-followers-history-chart'
import { InstagramThemeComparisonTable } from '@/components/conteudo-redes/instagram-theme-comparison-table'
import {
  TseBarraRotulo,
  TseCard,
  TseDado,
  TseDados,
  TseListaFiltro,
  TseVazio,
  tseCardClass,
} from '@/components/tse/tse-ui'
import { idPostInstagram, type InstagramPost, type InstagramRedes } from '@/hooks/use-instagram-redes'
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ORDER,
  type ContentStatsBundle,
  type ContentTypeKey,
} from '@/lib/instagram-content-type-comparison'
import { mapMetricsPostsToDayRecords } from '@/lib/instagram-day-posts'
import { formatEngagementValue, formatFollowersDelta } from '@/lib/instagram-followers-history-chart'
import type { ComparisonAverages } from '@/lib/instagram-metric-comparison'
import type { ThemeStatsBundle } from '@/lib/instagram-theme-comparison'

const fmt = (n: number): string => n.toLocaleString('pt-BR')

const COR_TIPO: Record<ContentTypeKey, string> = {
  image: 'var(--tse-yellow)',
  video: 'var(--tse-olive)',
  carousel: 'var(--tse-green)',
}

function medias(posts: InstagramPost[]): ComparisonAverages {
  const n = posts.length
  const soma = (f: (p: InstagramPost) => number) => posts.reduce((s, p) => s + f(p), 0)
  const media = (f: (p: InstagramPost) => number) => (n > 0 ? Math.round(soma(f) / n) : 0)
  return {
    posts: n,
    avgLikes: media((p) => p.metrics.likes || 0),
    avgComments: media((p) => p.metrics.comments || 0),
    avgViews: media((p) => p.metrics.views || 0),
    avgShares: media((p) => p.metrics.shares || 0),
    avgSaves: media((p) => p.metrics.saves || 0),
    avgEngagement: media((p) => p.metrics.engagement || 0),
  }
}

function maiorPor(posts: InstagramPost[], valor: (p: InstagramPost) => number): InstagramPost {
  return posts.reduce((melhor, p) => (valor(p) > valor(melhor) ? p : melhor), posts[0])
}

const CAMPEOES: Array<{ titulo: string; icone: typeof Heart; valor: (p: InstagramPost) => number }> = [
  { titulo: 'Mais curtidas', icone: Heart, valor: (p) => p.metrics.likes || 0 },
  { titulo: 'Mais comentários', icone: MessageCircle, valor: (p) => p.metrics.comments || 0 },
  { titulo: 'Mais visualizações', icone: Eye, valor: (p) => p.metrics.views || 0 },
  { titulo: 'Mais compartilhamentos', icone: Share2, valor: (p) => p.metrics.shares || 0 },
  { titulo: 'Mais salvamentos', icone: Download, valor: (p) => p.metrics.saves || 0 },
  { titulo: 'Maior engajamento', icone: TrendingUp, valor: (p) => p.metrics.engagement || 0 },
]

export function RedesPostsTab({ redes }: { redes: InstagramRedes }) {
  const { postsPeriodo, classificacoes, metrics, metricsHistory, periodLabel } = redes
  const [filtroTipo, setFiltroTipo] = useState<ContentTypeKey | null>(null)

  const temaDe = (post: InstagramPost): string | undefined => classificacoes[idPostInstagram(post)]?.theme

  const statsTipo = useMemo<ContentStatsBundle>(
    () => ({
      image: medias(postsPeriodo.filter((p) => p.type === 'image')),
      video: medias(postsPeriodo.filter((p) => p.type === 'video')),
      carousel: medias(postsPeriodo.filter((p) => p.type === 'carousel')),
    }),
    [postsPeriodo],
  )

  const postsFiltrados = filtroTipo ? postsPeriodo.filter((p) => p.type === filtroTipo) : postsPeriodo

  const porTema = new Map<string, InstagramPost[]>()
  for (const post of postsFiltrados) {
    const tema = temaDe(post)
    if (tema) porTema.set(tema, [...(porTema.get(tema) ?? []), post])
  }
  const statsTema: ThemeStatsBundle = Object.fromEntries([...porTema].map(([tema, lista]) => [tema, medias(lista)]))
  const melhorPorTema = [...porTema]
    .map(([tema, lista]) => {
      const p = maiorPor(lista, (x) => x.metrics.engagement || 0)
      return {
        theme: tema,
        thumbnail: p.thumbnail,
        caption: p.caption,
        url: p.url,
        engagement: p.metrics.engagement || 0,
        postedAt: p.postedAt,
      }
    })
    .sort((a, b) => b.engagement - a.engagement)

  const postsGrafico = useMemo(
    () => postsPeriodo.map((p) => ({ postedAt: p.postedAt, engagement: p.metrics.engagement || 0 })),
    [postsPeriodo],
  )
  const postsDia = useMemo(() => mapMetricsPostsToDayRecords(postsPeriodo), [postsPeriodo])

  const classificados = postsPeriodo.filter((p) => temaDe(p)).length
  const pctClassificados = postsPeriodo.length ? (classificados / postsPeriodo.length) * 100 : 0
  const engajamentoTotal = postsFiltrados.reduce((s, p) => s + (p.metrics.engagement || 0), 0)
  const curtidasTotal = postsFiltrados.reduce((s, p) => s + (p.metrics.likes || 0), 0)
  const engajamentoMedio = postsPeriodo.length
    ? postsPeriodo.reduce((s, p) => s + (p.metrics.engagement || 0), 0) / postsPeriodo.length
    : 0
  const crescimento = metricsHistory?.summary?.growth
  const escopo = filtroTipo ? CONTENT_TYPE_LABELS[filtroTipo] : `Últimos ${periodLabel}`

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[270px_1fr]">
      <aside className="space-y-4">
        <section className={tseCardClass}>
          <h2 className="text-xl font-bold">Dados Gerais</h2>
          <p className="mt-2 text-[10px] font-semibold text-[var(--tse-muted)]">Instagram · últimos {periodLabel}</p>
          <TseDados>
            <TseDado rotulo="Seguidores" valor={fmt(metrics?.followers?.total ?? 0)} />
            {typeof crescimento === 'number' ? (
              <TseDado
                rotulo="Variação no período"
                valor={formatFollowersDelta(crescimento)}
                sufixo={`(${metricsHistory?.summary?.growthPercentage ?? 0}%)`}
              />
            ) : null}
            <TseDado rotulo="Publicações" valor={fmt(postsPeriodo.length)} />
            <TseDado rotulo="Engajamento médio" valor={formatEngagementValue(engajamentoMedio)} sufixo="/ post" />
            <TseDado rotulo="Classificados" valor={fmt(classificados)} sufixo={`/ ${fmt(postsPeriodo.length)}`} />
          </TseDados>
          <TseBarraRotulo pct={pctClassificados} rotulo={`${Math.round(pctClassificados)}%`} />
          <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Publicações com tema definido</p>
        </section>

        <TseListaFiltro
          titulo="Tipo de conteúdo"
          itens={CONTENT_TYPE_ORDER.map((tipo) => ({
            id: tipo,
            label: CONTENT_TYPE_LABELS[tipo],
            valor: statsTipo[tipo].posts,
            cor: COR_TIPO[tipo],
          }))}
          ativo={filtroTipo}
          onChange={setFiltroTipo}
        />
      </aside>

      <main className="min-w-0 space-y-4">
        <section className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-white px-5 py-4 shadow-sm">
          <div className="min-w-[180px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-bold uppercase">Publicações</p>
              <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold text-white">
                {escopo}
              </span>
            </div>
            <p className="text-[15px] text-[var(--tse-muted)]">
              {fmt(postsFiltrados.length)} {postsFiltrados.length === 1 ? 'publicação' : 'publicações'} no recorte
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black">{fmt(engajamentoTotal)}</p>
            <p className="text-[13px] text-[var(--tse-muted)]">engajamento</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black">{fmt(curtidasTotal)}</p>
            <p className="text-[13px] text-[var(--tse-muted)]">curtidas</p>
          </div>
        </section>

        <InstagramFollowersHistoryChart
          metricsHistory={metricsHistory}
          loading={redes.loadingHistory}
          onRefresh={() => void redes.carregarHistorico()}
          posts={postsGrafico}
          livePosts={postsDia}
        />

        {postsPeriodo.length === 0 ? (
          <TseVazio>Nenhuma publicação nos últimos {periodLabel}.</TseVazio>
        ) : (
          <>
            <InstagramContentTypeComparison contentStats={statsTipo} />

            {porTema.size > 0 ? (
              <>
                <InstagramThemeComparisonTable themeStats={statsTema} />
                <InstagramBestPostByThemeTable rows={melhorPorTema} periodLabel={escopo} />
              </>
            ) : (
              <TseVazio>Classifique publicações na aba Audiência para ver os comparativos por tema.</TseVazio>
            )}

            <TseCard titulo="Campeões por indicador" subtitulo={`Publicações que se destacaram em cada métrica · ${escopo}`}>
              {postsFiltrados.length === 0 ? (
                <p className="mt-3 text-[13px] text-[var(--tse-muted)]">Nenhuma publicação no recorte.</p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 min-[1600px]:grid-cols-3">
                  {CAMPEOES.map((c) => {
                    const post = maiorPor(postsFiltrados, c.valor)
                    return (
                      <ChampionPostCard
                        key={c.titulo}
                        title={c.titulo}
                        icon={c.icone}
                        post={post}
                        metricValue={c.valor(post)}
                      />
                    )
                  })}
                </div>
              )}
            </TseCard>
          </>
        )}
      </main>
    </div>
  )
}
