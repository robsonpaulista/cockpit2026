'use client'

import { useEffect, useState } from 'react'
import {
  CAMPEOES_INDICADORES,
  maiorPorIndicador,
  type CampeaoIndicadorId,
} from '@/components/conteudo-redes/instagram-campeoes'
import { RedesPostCard } from '@/components/conteudo-redes/redes-post-card'
import {
  TseBarraRotulo,
  TseBusca,
  TseCarregarMais,
  TseDado,
  TseDados,
  TseListaFiltro,
  TseSegmentado,
  TseVazio,
  tseCardClass,
  tseControleClass,
  tseLinkAcaoClass,
} from '@/components/tse/tse-ui'
import { idPostInstagram, type InstagramPost, type InstagramRedes } from '@/hooks/use-instagram-redes'
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ORDER,
  type ContentTypeKey,
} from '@/lib/instagram-content-type-comparison'
import { formatEngagementValue, formatFollowersDelta } from '@/lib/instagram-followers-history-chart'
import { cn } from '@/lib/utils'

type FiltroImpulso = 'todas' | 'boosted' | 'organic'

const PAGE_SIZE = 30
const SEM_TEMA = '__sem_tema__'
const fmt = (n: number): string => n.toLocaleString('pt-BR')

const COR_TIPO: Record<ContentTypeKey, string> = {
  image: 'var(--tse-yellow)',
  video: 'var(--tse-olive)',
  carousel: 'var(--tse-green)',
}

const normalizar = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export function RedesAudienciaTab({ redes }: { redes: InstagramRedes }) {
  const { postsPeriodo, classificacoes, metrics, metricsHistory, periodLabel } = redes
  const [filtroTema, setFiltroTema] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<ContentTypeKey | null>(null)
  const [filtroImpulso, setFiltroImpulso] = useState<FiltroImpulso>('todas')
  const [campeaoAtivo, setCampeaoAtivo] = useState<CampeaoIndicadorId | null>(null)
  const [busca, setBusca] = useState<string>('')
  const [limite, setLimite] = useState<number>(PAGE_SIZE)

  useEffect(() => {
    setLimite(PAGE_SIZE)
  }, [filtroTema, filtroTipo, filtroImpulso, busca, postsPeriodo])

  const classificacaoDe = (post: InstagramPost) => classificacoes[idPostInstagram(post)] ?? {}

  const engajamentoPorTema = new Map<string, { posts: number; engajamento: number }>()
  const engajamentoPorTipo = new Map<ContentTypeKey, { posts: number; engajamento: number }>()
  let semTema = 0
  let engajamentoSemTema = 0
  let impulsionadas = 0
  for (const post of postsPeriodo) {
    const c = classificacaoDe(post)
    const eng = post.metrics.engagement || 0
    if (c.theme) {
      const atual = engajamentoPorTema.get(c.theme) ?? { posts: 0, engajamento: 0 }
      engajamentoPorTema.set(c.theme, { posts: atual.posts + 1, engajamento: atual.engajamento + eng })
    } else {
      semTema += 1
      engajamentoSemTema += eng
    }
    if (CONTENT_TYPE_ORDER.includes(post.type as ContentTypeKey)) {
      const tipo = post.type as ContentTypeKey
      const atual = engajamentoPorTipo.get(tipo) ?? { posts: 0, engajamento: 0 }
      engajamentoPorTipo.set(tipo, { posts: atual.posts + 1, engajamento: atual.engajamento + eng })
    }
    if (c.isBoosted) impulsionadas += 1
  }
  const mediaEngajamento = (posts: number, total: number): number => (posts > 0 ? total / posts : 0)
  const valorMedia = (media: number): string => (media > 0 ? formatEngagementValue(media) : '—')
  const temasComMedia = [...engajamentoPorTema].map(([tema, stats]) => ({
    tema,
    posts: stats.posts,
    media: mediaEngajamento(stats.posts, stats.engajamento),
  }))
  const maiorEngajamentoMedio = temasComMedia.reduce(
    (melhor, atual) => (atual.media > melhor ? atual.media : melhor),
    0,
  )
  const itensTema = [
    ...temasComMedia
      .sort((a, b) => b.media - a.media || b.posts - a.posts || a.tema.localeCompare(b.tema, 'pt-BR'))
      .map(({ tema, posts, media }) => {
        const destaque = maiorEngajamentoMedio > 0 && media === maiorEngajamentoMedio
        return {
          id: tema,
          label: tema,
          valor: posts,
          cor: destaque ? 'var(--tse-yellow)' : 'var(--tse-green)',
          extra: valorMedia(media),
          destaque,
        }
      }),
    ...(semTema > 0
      ? [
          {
            id: SEM_TEMA,
            label: 'Sem tema',
            valor: semTema,
            cor: 'var(--tse-zero)',
            extra: valorMedia(mediaEngajamento(semTema, engajamentoSemTema)),
          },
        ]
      : []),
  ]

  const tiposComMedia = CONTENT_TYPE_ORDER.map((tipo) => {
    const stats = engajamentoPorTipo.get(tipo) ?? { posts: 0, engajamento: 0 }
    return {
      tipo,
      posts: stats.posts,
      media: mediaEngajamento(stats.posts, stats.engajamento),
    }
  }).filter((item) => item.posts > 0)
  const maiorEngajamentoTipo = tiposComMedia.reduce(
    (melhor, atual) => (atual.media > melhor ? atual.media : melhor),
    0,
  )
  const itensTipo = tiposComMedia
    .sort((a, b) => b.media - a.media || b.posts - a.posts)
    .map(({ tipo, posts, media }) => {
      const destaque = maiorEngajamentoTipo > 0 && media === maiorEngajamentoTipo
      return {
        id: tipo,
        label: CONTENT_TYPE_LABELS[tipo],
        valor: posts,
        cor: destaque ? 'var(--tse-yellow)' : COR_TIPO[tipo],
        extra: valorMedia(media),
        destaque,
      }
    })

  const itensCampeao = CAMPEOES_INDICADORES.map((indicador) => {
    const post = maiorPorIndicador(postsPeriodo, indicador.valor)
    const valor = post ? indicador.valor(post) : 0
    return { ...indicador, post, valor }
  })
  const campeaoSelecionado = itensCampeao.find((item) => item.id === campeaoAtivo) ?? null

  const termo = normalizar(busca.trim())
  const postsCronologicos = [...postsPeriodo].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  )
  const posts = postsCronologicos.filter((post) => {
    const c = classificacaoDe(post)
    if (filtroTema === SEM_TEMA ? Boolean(c.theme) : filtroTema && c.theme !== filtroTema) return false
    if (filtroTipo && post.type !== filtroTipo) return false
    if (filtroImpulso === 'boosted' && !c.isBoosted) return false
    if (filtroImpulso === 'organic' && c.isBoosted) return false
    return !termo || normalizar(post.caption || '').includes(termo)
  })

  const engajamento = posts.reduce((s, p) => s + (p.metrics.engagement || 0), 0)
  const crescimento = metricsHistory?.summary?.growth
  const visitasPeriodo = metricsHistory?.summary?.totalProfileViews ?? 0
  const classificados = postsPeriodo.filter((p) => Boolean(classificacaoDe(p).theme)).length
  const pctClassificados = postsPeriodo.length ? (classificados / postsPeriodo.length) * 100 : 0
  const engajamentoMedio = postsPeriodo.length
    ? postsPeriodo.reduce((s, p) => s + (p.metrics.engagement || 0), 0) / postsPeriodo.length
    : 0
  const hasFiltros = Boolean(filtroTema || filtroTipo || filtroImpulso !== 'todas' || termo || campeaoAtivo)
  const escopo =
    campeaoSelecionado?.titulo ??
    (filtroTema === SEM_TEMA
      ? 'Sem tema'
      : (filtroTema ??
        (filtroTipo
          ? CONTENT_TYPE_LABELS[filtroTipo]
          : filtroImpulso === 'boosted'
            ? 'Impulsionadas'
            : filtroImpulso === 'organic'
              ? 'Orgânicas'
              : 'Todas')))

  const postCampeao = campeaoSelecionado?.post ?? null
  const anteriorCampeao = postCampeao
    ? (postsCronologicos[postsCronologicos.findIndex((p) => p.id === postCampeao.id) + 1] ?? null)
    : null

  const limparFiltros = () => {
    setFiltroTema(null)
    setFiltroTipo(null)
    setFiltroImpulso('todas')
    setCampeaoAtivo(null)
    setBusca('')
  }

  const escolherCampeao = (id: CampeaoIndicadorId) => {
    setCampeaoAtivo((atual) => (atual === id ? null : id))
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <section className={tseCardClass}>
          <h2 className="text-xl font-bold">Dados Gerais</h2>
          <p className="mt-2 text-[10px] font-semibold text-[var(--tse-muted)]">Instagram Insights · audiência</p>
          <TseDados>
            <TseDado rotulo="Seguidores" valor={fmt(metrics?.followers?.total ?? 0)} />
            {typeof crescimento === 'number' ? (
              <TseDado
                rotulo="Variação no período"
                valor={formatFollowersDelta(crescimento)}
                sufixo={`(${metricsHistory?.summary?.growthPercentage ?? 0}%)`}
              />
            ) : null}
            <TseDado rotulo="Visitas ao perfil" valor={fmt(metrics?.insights?.profileViews ?? 0)} />
            {visitasPeriodo > 0 ? <TseDado rotulo="Visitas no período" valor={fmt(visitasPeriodo)} /> : null}
            <TseDado rotulo="Engajamento médio" valor={formatEngagementValue(engajamentoMedio)} sufixo="/ post" />
            <TseDado rotulo="Classificados" valor={fmt(classificados)} sufixo={`/ ${fmt(postsPeriodo.length)}`} />
          </TseDados>
          <TseBarraRotulo pct={pctClassificados} rotulo={`${Math.round(pctClassificados)}%`} />
          <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Publicações com tema definido</p>
        </section>

        {itensTema.length > 0 ? (
          <TseListaFiltro
            titulo="Temas"
            itens={itensTema}
            ativo={filtroTema}
            onChange={setFiltroTema}
            colunas={{ label: 'Temas', valor: 'Posts', extra: 'Eng.Méd' }}
          />
        ) : null}

        {itensTipo.length > 0 ? (
          <TseListaFiltro
            titulo="Tipo de conteúdo"
            itens={itensTipo}
            ativo={filtroTipo}
            onChange={setFiltroTipo}
            colunas={{ label: 'Tipo', valor: 'Posts', extra: 'Eng.Méd' }}
          />
        ) : null}

        {postsPeriodo.length > 0 ? (
          <section className={tseCardClass}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold">Campeões por indicador</h2>
              {campeaoAtivo ? (
                <button type="button" onClick={() => setCampeaoAtivo(null)} className={tseLinkAcaoClass}>
                  Todos
                </button>
              ) : null}
            </div>
            <ul className="mt-3 space-y-1 text-[13px]">
              {itensCampeao.map((item) => {
                const sel = item.id === campeaoAtivo
                const disponivel = item.post != null && item.valor > 0
                const Icone = item.icone
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!disponivel}
                      onClick={() => escolherCampeao(item.id)}
                      aria-pressed={sel}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--tse-yellow-soft)] disabled:cursor-not-allowed disabled:opacity-50',
                        sel && 'bg-[var(--tse-yellow-soft)] font-bold',
                      )}
                    >
                      <Icone className="h-3.5 w-3.5 shrink-0 text-[var(--tse-gold-text)]" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{item.titulo}</span>
                      <strong className="shrink-0 tabular-nums text-[var(--tse-muted)]">
                        {disponivel ? fmt(item.valor) : '—'}
                      </strong>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        <TseListaFiltro<FiltroImpulso>
          titulo="Impulsionamento"
          itens={[
            { id: 'boosted', label: 'Impulsionadas', valor: impulsionadas, cor: 'var(--tse-gold-text)' },
            { id: 'organic', label: 'Orgânicas', valor: postsPeriodo.length - impulsionadas, cor: 'var(--tse-zero)' },
          ]}
          ativo={filtroImpulso === 'todas' ? null : filtroImpulso}
          onChange={(id) => setFiltroImpulso(id ?? 'todas')}
        />
      </aside>

      <main className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroTema ?? ''}
              onChange={(e) => setFiltroTema(e.target.value || null)}
              className={tseControleClass}
              aria-label="Filtrar por tema"
            >
              <option value="">Todos os temas</option>
              {redes.temasDisponiveis.map((tema) => (
                <option key={tema} value={tema}>
                  {tema}
                </option>
              ))}
              <option value={SEM_TEMA}>Sem tema</option>
            </select>
            <TseSegmentado<FiltroImpulso>
              opcoes={[
                { id: 'todas', label: 'Todas' },
                { id: 'boosted', label: 'Impulsionadas' },
                { id: 'organic', label: 'Orgânicas' },
              ]}
              valor={filtroImpulso}
              onChange={setFiltroImpulso}
            />
          </div>
          <TseBusca value={busca} onChange={setBusca} placeholder="Buscar na legenda" />
        </div>

        <section className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-white px-5 py-4 shadow-sm">
          <div className="min-w-[180px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-bold uppercase">
                {postCampeao ? 'Campeão por indicador' : 'Publicações por tema'}
              </p>
              <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold uppercase text-white">
                {escopo}
              </span>
            </div>
            <p className="text-[15px] text-[var(--tse-muted)]">
              {postCampeao
                ? `Publicação destaque · ${campeaoSelecionado?.titulo ?? ''} · últimos ${periodLabel}`
                : `Classifique tema e impulsionamento · comparação com o post anterior · últimos ${periodLabel}`}
            </p>
          </div>
          {postCampeao && campeaoSelecionado ? (
            <div className="text-right">
              <p className="text-3xl font-black">{fmt(campeaoSelecionado.valor)}</p>
              <p className="text-[13px] text-[var(--tse-muted)]">{campeaoSelecionado.titulo.toLowerCase()}</p>
            </div>
          ) : (
            <>
              <div className="text-right">
                <p className="text-3xl font-black">{fmt(posts.length)}</p>
                <p className="text-[13px] text-[var(--tse-muted)]">publicações</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">{fmt(engajamento)}</p>
                <p className="text-[13px] text-[var(--tse-muted)]">engajamento</p>
              </div>
            </>
          )}
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--tse-muted)]">
          <p>
            {postCampeao
              ? '1 publicação selecionada pelo indicador'
              : `${fmt(posts.length)} ${posts.length === 1 ? 'publicação' : 'publicações'}${hasFiltros ? ' com os filtros aplicados' : ''}`}
          </p>
          {hasFiltros ? (
            <button type="button" onClick={limparFiltros} className={tseLinkAcaoClass}>
              Limpar filtros
            </button>
          ) : null}
        </div>

        {postCampeao ? (
          <div className="mt-3 grid grid-cols-1 gap-3">
            <RedesPostCard
              post={postCampeao}
              anterior={anteriorCampeao}
              classificacao={classificacaoDe(postCampeao)}
              temas={redes.temasDisponiveis}
              obras={redes.obrasMapa}
              onClassificar={(tema, impulsionado, obraId) =>
                redes.classificar(postCampeao, tema, impulsionado, obraId)
              }
              onAdicionarTema={redes.adicionarTema}
            />
          </div>
        ) : posts.length === 0 ? (
          <div className="mt-3">
            <TseVazio>Nenhuma publicação encontrada para os filtros selecionados.</TseVazio>
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 gap-3">
              {posts.slice(0, limite).map((post, index) => (
                <RedesPostCard
                  key={post.id}
                  post={post}
                  anterior={posts[index + 1] ?? null}
                  classificacao={classificacaoDe(post)}
                  temas={redes.temasDisponiveis}
                  obras={redes.obrasMapa}
                  onClassificar={(tema, impulsionado, obraId) => redes.classificar(post, tema, impulsionado, obraId)}
                  onAdicionarTema={redes.adicionarTema}
                />
              ))}
            </div>
            <TseCarregarMais restantes={posts.length - limite} onClick={() => setLimite((n) => n + PAGE_SIZE)} />
          </>
        )}
      </main>
    </div>
  )
}
