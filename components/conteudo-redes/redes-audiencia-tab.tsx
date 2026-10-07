'use client'

import { useEffect, useState } from 'react'
import { RedesPostCard } from '@/components/conteudo-redes/redes-post-card'
import {
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
import { formatFollowersDelta } from '@/lib/instagram-followers-history-chart'

type FiltroImpulso = 'todas' | 'boosted' | 'organic'

const PAGE_SIZE = 30
const SEM_TEMA = '__sem_tema__'
const fmt = (n: number): string => n.toLocaleString('pt-BR')

const normalizar = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export function RedesAudienciaTab({ redes }: { redes: InstagramRedes }) {
  const { postsPeriodo, classificacoes, metrics, metricsHistory, periodLabel } = redes
  const [filtroTema, setFiltroTema] = useState<string | null>(null)
  const [filtroImpulso, setFiltroImpulso] = useState<FiltroImpulso>('todas')
  const [busca, setBusca] = useState<string>('')
  const [limite, setLimite] = useState<number>(PAGE_SIZE)

  useEffect(() => {
    setLimite(PAGE_SIZE)
  }, [filtroTema, filtroImpulso, busca, postsPeriodo])

  const classificacaoDe = (post: InstagramPost) => classificacoes[idPostInstagram(post)] ?? {}

  const contagemTemas = new Map<string, number>()
  let semTema = 0
  let impulsionadas = 0
  for (const post of postsPeriodo) {
    const c = classificacaoDe(post)
    if (c.theme) contagemTemas.set(c.theme, (contagemTemas.get(c.theme) ?? 0) + 1)
    else semTema += 1
    if (c.isBoosted) impulsionadas += 1
  }
  const itensTema = [
    ...[...contagemTemas]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .map(([tema, valor]) => ({ id: tema, label: tema, valor, cor: 'var(--tse-green)' })),
    ...(semTema > 0 ? [{ id: SEM_TEMA, label: 'Sem tema', valor: semTema, cor: 'var(--tse-zero)' }] : []),
  ]

  const termo = normalizar(busca.trim())
  const posts = postsPeriodo
    .filter((post) => {
      const c = classificacaoDe(post)
      if (filtroTema === SEM_TEMA ? Boolean(c.theme) : filtroTema && c.theme !== filtroTema) return false
      if (filtroImpulso === 'boosted' && !c.isBoosted) return false
      if (filtroImpulso === 'organic' && c.isBoosted) return false
      return !termo || normalizar(post.caption || '').includes(termo)
    })
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())

  const engajamento = posts.reduce((s, p) => s + (p.metrics.engagement || 0), 0)
  const alcance = metrics?.insights?.reach ?? 0
  const crescimento = metricsHistory?.summary?.growth
  const visitasPeriodo = metricsHistory?.summary?.totalProfileViews ?? 0
  const hasFiltros = Boolean(filtroTema || filtroImpulso !== 'todas' || termo)
  const escopo =
    filtroTema === SEM_TEMA
      ? 'Sem tema'
      : (filtroTema ??
        (filtroImpulso === 'boosted' ? 'Impulsionadas' : filtroImpulso === 'organic' ? 'Orgânicas' : 'Todas'))

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[270px_1fr]">
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
            <TseDado rotulo="Alcance" valor={fmt(alcance)} sufixo="contas" />
            <TseDado rotulo="Cliques no link" valor={fmt(metrics?.insights?.websiteClicks ?? 0)} />
          </TseDados>
        </section>

        {itensTema.length > 0 ? (
          <TseListaFiltro titulo="Temas" itens={itensTema} ativo={filtroTema} onChange={setFiltroTema} />
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
              <p className="text-xl font-bold uppercase">Publicações por tema</p>
              <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold uppercase text-white">
                {escopo}
              </span>
            </div>
            <p className="text-[15px] text-[var(--tse-muted)]">
              Classifique tema e impulsionamento · comparação com o post anterior · últimos {periodLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black">{fmt(posts.length)}</p>
            <p className="text-[13px] text-[var(--tse-muted)]">publicações</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black">{fmt(engajamento)}</p>
            <p className="text-[13px] text-[var(--tse-muted)]">engajamento</p>
          </div>
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--tse-muted)]">
          <p>
            {fmt(posts.length)} {posts.length === 1 ? 'publicação' : 'publicações'}
            {hasFiltros ? ' com os filtros aplicados' : ''}
          </p>
          {hasFiltros ? (
            <button
              type="button"
              onClick={() => {
                setFiltroTema(null)
                setFiltroImpulso('todas')
                setBusca('')
              }}
              className={tseLinkAcaoClass}
            >
              Limpar filtros
            </button>
          ) : null}
        </div>

        {posts.length === 0 ? (
          <div className="mt-3">
            <TseVazio>Nenhuma publicação encontrada para os filtros selecionados.</TseVazio>
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 gap-3 min-[1600px]:grid-cols-2">
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
