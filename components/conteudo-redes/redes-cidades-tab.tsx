'use client'

import { useEffect, useMemo, useState } from 'react'
import { InstagramCityTrendChart } from '@/components/conteudo-redes/instagram-city-trend-chart'
import {
  TseBarraRotulo,
  TseBarraValor,
  TseBusca,
  TseCarregarMais,
  TseChevronCelula,
  TseDado,
  TseDados,
  TseListaFiltro,
  TseRank,
  TseSegmentado,
  TseStatus,
  TseThOrdenavel,
  TseVazio,
  tseCardClass,
  tseLinkAcaoClass,
  tseTabela,
} from '@/components/tse/tse-ui'
import type { InstagramRedes } from '@/hooks/use-instagram-redes'
import { aggregateInstagramMetricsByCaptionCity } from '@/lib/instagram-city-caption-stats'
import { fetchInstagramCityDemographicsHistory } from '@/lib/instagram-city-demographics-client'
import type { CityDemographicsSeriesPoint } from '@/lib/instagram-city-demographics-history'
import {
  cityTrendLabel,
  inferCityTrend,
  type CityTrendDirection,
  type CityTrendPoint,
} from '@/lib/instagram-city-trend'
import { cn } from '@/lib/utils'

type Modo = 'caption' | 'followers' | 'engaged'
type SortCol = 'cidade' | 'valor' | 'posts'

type LinhaCidade = {
  nome: string
  valor: number
  posts: number
  curtidas: number
  engMedio: number
  pct: number
  pontos: CityTrendPoint[]
  tendencia: CityTrendDirection
}

const PAGE_SIZE = 30
const TOTAL_MUNICIPIOS_PI = 224
const fmt = (n: number): string => n.toLocaleString('pt-BR')

const TENDENCIAS: Array<{ id: CityTrendDirection; cor: string }> = [
  { id: 'up', cor: 'var(--tse-olive)' },
  { id: 'stable', cor: 'var(--tse-yellow)' },
  { id: 'down', cor: '#B42318' },
  { id: 'insufficient', cor: 'var(--tse-zero)' },
]
const corTendencia = (t: CityTrendDirection): string => TENDENCIAS.find((x) => x.id === t)?.cor ?? 'var(--tse-zero)'

const normalizar = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export function RedesCidadesTab({ redes }: { redes: InstagramRedes }) {
  const { postsPeriodo, metrics, periodLabel } = redes
  const [modo, setModo] = useState<Modo>('caption')
  const [busca, setBusca] = useState<string>('')
  const [filtroTendencia, setFiltroTendencia] = useState<CityTrendDirection | null>(null)
  const [sortCol, setSortCol] = useState<SortCol>('valor')
  const [sortAsc, setSortAsc] = useState<boolean>(false)
  const [limite, setLimite] = useState<number>(PAGE_SIZE)
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())
  const [seriesApi, setSeriesApi] = useState<Record<string, CityDemographicsSeriesPoint[]> | null>(null)

  const usaApi = modo !== 'caption'

  useEffect(() => {
    if (!usaApi || seriesApi) return
    let cancelado = false
    void fetchInstagramCityDemographicsHistory(90).then((res) => {
      if (!cancelado) setSeriesApi(res.seriesByCity)
    })
    return () => {
      cancelado = true
    }
  }, [usaApi, seriesApi])

  useEffect(() => {
    setLimite(PAGE_SIZE)
    setExpandidas(new Set())
    setFiltroTendencia(null)
    if (modo !== 'caption') setSortCol((col) => (col === 'posts' ? 'valor' : col))
  }, [modo])

  const legenda = useMemo(() => aggregateInstagramMetricsByCaptionCity(postsPeriodo), [postsPeriodo])

  const locationMap = modo === 'engaged' ? metrics?.demographics?.engagedTopLocations : metrics?.demographics?.topLocations
  const totalSeguidores = metrics?.followers?.total ?? 0

  const linhas = useMemo<LinhaCidade[]>(() => {
    if (modo === 'caption') {
      return legenda.cities.map((c) => {
        const pontos = c.series.map((p) => ({
          date: p.postedAt,
          value: p.engagement,
          postsCount: p.postsInDay ?? 1,
          label: new Date(p.postedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
        }))
        return {
          nome: c.municipio,
          valor: c.engagement,
          posts: c.posts,
          curtidas: c.likes,
          engMedio: c.avgEngagement,
          pct: 0,
          pontos,
          tendencia: inferCityTrend(pontos),
        }
      })
    }
    const entradas = Object.entries(locationMap ?? {})
    const mapeado = entradas.reduce((s, [, n]) => s + n, 0)
    const base = modo === 'engaged' ? mapeado : totalSeguidores
    return entradas.map(([nome, valor]) => {
      const pontos = (seriesApi?.[nome] ?? []).map((row) => ({
        date: row.date,
        value: modo === 'engaged' ? row.engaged : row.followers,
      }))
      return {
        nome,
        valor,
        posts: 0,
        curtidas: 0,
        engMedio: 0,
        pct: base > 0 ? (valor / base) * 100 : 0,
        pontos,
        tendencia: inferCityTrend(pontos),
      }
    })
  }, [modo, legenda, locationMap, totalSeguidores, seriesApi])

  const rank = new Map(
    [...linhas].sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR')).map((l, i) => [l.nome, i + 1]),
  )
  const contagemTendencia = TENDENCIAS.map((t) => ({
    ...t,
    label: cityTrendLabel(t.id),
    valor: linhas.filter((l) => l.tendencia === t.id).length,
  })).filter((t) => t.valor > 0)

  const termo = normalizar(busca.trim())
  const visiveis = linhas
    .filter((l) => (!filtroTendencia || l.tendencia === filtroTendencia) && (!termo || normalizar(l.nome).includes(termo)))
    .sort((a, b) => {
      const porNome = a.nome.localeCompare(b.nome, 'pt-BR')
      if (sortCol === 'cidade') return sortAsc ? porNome : -porNome
      const diff = sortCol === 'posts' ? a.posts - b.posts : a.valor - b.valor
      return (sortAsc ? diff : -diff) || porNome
    })
  const pagina = visiveis.slice(0, limite)
  const maxValor = linhas.reduce((m, l) => Math.max(m, l.valor), 0)
  const todasAbertas = pagina.length > 0 && pagina.every((l) => expandidas.has(l.nome))

  const totalValor = linhas.reduce((s, l) => s + l.valor, 0)
  const rotuloValor = modo === 'caption' ? 'Engajamento' : modo === 'engaged' ? 'Engajados' : 'Seguidores'
  const coberturaPosts = legenda.postsTotal ? (legenda.postsWithCity / legenda.postsTotal) * 100 : 0
  const hasFiltros = Boolean(termo || filtroTendencia)
  const colunas = modo === 'caption' ? 8 : 6

  const alternarSort = (col: SortCol) => {
    if (col === sortCol) setSortAsc((v) => !v)
    else {
      setSortCol(col)
      setSortAsc(col === 'cidade')
    }
  }

  const alternar = (nome: string) =>
    setExpandidas((atual) => {
      const prox = new Set(atual)
      if (prox.has(nome)) prox.delete(nome)
      else prox.add(nome)
      return prox
    })

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[270px_1fr]">
      <aside className="space-y-4">
        <section className={tseCardClass}>
          <h2 className="text-xl font-bold">Dados Gerais</h2>
          {modo === 'caption' ? (
            <>
              <p className="mt-2 text-[10px] font-semibold text-[var(--tse-muted)]">
                Município citado na legenda · últimos {periodLabel}
              </p>
              <TseDados>
                <TseDado rotulo="Cidades citadas" valor={fmt(linhas.length)} sufixo={`/ ${TOTAL_MUNICIPIOS_PI}`} />
                <TseDado rotulo="Posts com cidade" valor={fmt(legenda.postsWithCity)} sufixo={`/ ${fmt(legenda.postsTotal)}`} />
                <TseDado rotulo="Sem match" valor={fmt(legenda.postsWithoutCity)} />
                <TseDado rotulo="Curtidas" valor={fmt(linhas.reduce((s, l) => s + l.curtidas, 0))} />
                <TseDado rotulo="Engajamento" valor={fmt(totalValor)} />
              </TseDados>
              <TseBarraRotulo pct={coberturaPosts} rotulo={`${Math.round(coberturaPosts)}%`} />
              <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Publicações com município identificado</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-[10px] font-semibold text-[var(--tse-muted)]">
                {modo === 'engaged'
                  ? 'Quem interagiu no mês (engaged_audience_demographics)'
                  : 'Base de seguidores (follower_demographics · 30 dias)'}
              </p>
              <TseDados>
                <TseDado rotulo="Cidades no top" valor={fmt(linhas.length)} />
                <TseDado rotulo={modo === 'engaged' ? 'Engajados mapeados' : 'Seguidores mapeados'} valor={fmt(totalValor)} />
                {modo === 'followers' ? <TseDado rotulo="Seguidores totais" valor={fmt(totalSeguidores)} /> : null}
              </TseDados>
              {modo === 'followers' && totalSeguidores > 0 ? (
                <>
                  <TseBarraRotulo
                    pct={(totalValor / totalSeguidores) * 100}
                    rotulo={`${Math.round((totalValor / totalSeguidores) * 100)}%`}
                  />
                  <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Seguidores com cidade no top da Meta</p>
                </>
              ) : null}
            </>
          )}
        </section>

        {contagemTendencia.length > 0 ? (
          <TseListaFiltro
            titulo="Tendência"
            itens={contagemTendencia}
            ativo={filtroTendencia}
            onChange={setFiltroTendencia}
          />
        ) : null}
      </aside>

      <main className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TseSegmentado<Modo>
            opcoes={[
              { id: 'caption', label: 'Posts (legenda)' },
              { id: 'followers', label: 'Seguidores (API)' },
              { id: 'engaged', label: 'Engajados (API)' },
            ]}
            valor={modo}
            onChange={setModo}
          />
          <TseBusca value={busca} onChange={setBusca} placeholder="Buscar cidade" />
        </div>

        <section className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-white px-5 py-4 shadow-sm">
          <div className="min-w-[180px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-bold uppercase">Distribuição por cidade</p>
              <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold text-white">
                {modo === 'caption' ? 'Legendas' : modo === 'engaged' ? 'Engajados' : 'Seguidores'}
              </span>
            </div>
            <p className="text-[15px] text-[var(--tse-muted)]">
              {modo === 'caption'
                ? 'Engajamento das publicações por município citado na legenda (224 municípios do PI)'
                : 'Top cidades devolvido pela Meta · linha do tempo com snapshots diários'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black">{fmt(linhas.length)}</p>
            <p className="text-[13px] text-[var(--tse-muted)]">cidades</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black">{fmt(totalValor)}</p>
            <p className="text-[13px] text-[var(--tse-muted)]">{rotuloValor.toLowerCase()}</p>
          </div>
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--tse-muted)]">
          <p>
            {fmt(visiveis.length)} {visiveis.length === 1 ? 'cidade' : 'cidades'}
            {hasFiltros ? ' com os filtros aplicados' : ''}
          </p>
          <div className="flex items-center gap-4">
            {hasFiltros ? (
              <button
                type="button"
                onClick={() => {
                  setBusca('')
                  setFiltroTendencia(null)
                }}
                className={tseLinkAcaoClass}
              >
                Limpar filtros
              </button>
            ) : null}
            {pagina.length > 0 ? (
              <button
                type="button"
                onClick={() => setExpandidas(todasAbertas ? new Set() : new Set(pagina.map((l) => l.nome)))}
                className={tseLinkAcaoClass}
              >
                {todasAbertas ? 'Recolher todas' : 'Expandir todas'}
              </button>
            ) : null}
          </div>
        </div>

        {linhas.length === 0 ? (
          <div className="mt-3">
            <TseVazio>
              {modo === 'caption'
                ? legenda.postsTotal === 0
                  ? `Nenhuma publicação nos últimos ${periodLabel}.`
                  : `Nenhum município do Piauí identificado nas ${fmt(legenda.postsTotal)} legendas. Coloque o nome da cidade na primeira linha da legenda para melhorar a cobertura.`
                : modo === 'engaged'
                  ? 'Engajamento por cidade indisponível: a Meta exige ao menos 100 engajamentos no mês e pode atrasar até 48h. Use Atualizar para forçar nova coleta.'
                  : 'Localização dos seguidores indisponível: a Meta exige conta profissional com 100+ seguidores e pode atrasar até 48h. Use Atualizar para forçar nova coleta.'}
            </TseVazio>
          </div>
        ) : visiveis.length === 0 ? (
          <div className="mt-3">
            <TseVazio>Nenhuma cidade encontrada com os filtros aplicados.</TseVazio>
          </div>
        ) : (
          <>
            <div className={cn('mt-3', tseTabela.container)}>
              <table className={tseTabela.table} data-tse-tabela>
                <thead className={tseTabela.thead}>
                  <tr>
                    <th className="w-14 px-3 py-2.5 text-center">Pos.</th>
                    <TseThOrdenavel col="cidade" sortCol={sortCol} sortAsc={sortAsc} onSort={alternarSort}>
                      {modo === 'caption' ? 'Município' : 'Cidade'}
                    </TseThOrdenavel>
                    {modo === 'caption' ? (
                      <>
                        <TseThOrdenavel col="posts" alinhar="right" sortCol={sortCol} sortAsc={sortAsc} onSort={alternarSort}>
                          Posts
                        </TseThOrdenavel>
                        <th className="px-3 py-2.5 text-right">Curtidas</th>
                        <th className="px-3 py-2.5 text-right">Eng. médio</th>
                      </>
                    ) : null}
                    <TseThOrdenavel
                      col="valor"
                      alinhar="right"
                      className="w-[220px]"
                      sortCol={sortCol}
                      sortAsc={sortAsc}
                      onSort={alternarSort}
                    >
                      {rotuloValor}
                    </TseThOrdenavel>
                    {modo !== 'caption' ? <th className="px-3 py-2.5 text-right">%</th> : null}
                    <th className="px-3 py-2.5">Tendência</th>
                    <th className="w-10 px-2 py-2.5" aria-label="Expandir" />
                  </tr>
                </thead>
                <tbody>
                  {pagina.map((linha) => {
                    const aberta = expandidas.has(linha.nome)
                    return (
                      <LinhaTabela
                        key={`${modo}-${linha.nome}`}
                        linha={linha}
                        modo={modo}
                        aberta={aberta}
                        posicao={rank.get(linha.nome) ?? 0}
                        maxValor={maxValor}
                        colunas={colunas}
                        rotuloValor={rotuloValor}
                        onToggle={() => alternar(linha.nome)}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
            <TseCarregarMais restantes={visiveis.length - limite} onClick={() => setLimite((n) => n + PAGE_SIZE)} />
          </>
        )}
      </main>
    </div>
  )
}

function LinhaTabela({
  linha,
  modo,
  aberta,
  posicao,
  maxValor,
  colunas,
  rotuloValor,
  onToggle,
}: {
  linha: LinhaCidade
  modo: Modo
  aberta: boolean
  posicao: number
  maxValor: number
  colunas: number
  rotuloValor: string
  onToggle: () => void
}) {
  return (
    <>
      <tr onClick={onToggle} aria-expanded={aberta} className={cn(tseTabela.trClicavel, aberta && 'bg-[var(--tse-yellow-soft)]')}>
        <td className="px-3 py-2 text-center">
          <TseRank posicao={posicao} />
        </td>
        <td className="px-3 py-2 font-bold uppercase">{linha.nome}</td>
        {modo === 'caption' ? (
          <>
            <td className="px-3 py-2 text-right tabular-nums">{fmt(linha.posts)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmt(linha.curtidas)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-[var(--tse-muted)]">{fmt(linha.engMedio)}</td>
          </>
        ) : null}
        <td className="px-3 py-2">
          <TseBarraValor valor={linha.valor} max={maxValor} formatado={fmt(linha.valor)} larguraNumero="w-16" />
        </td>
        {modo !== 'caption' ? (
          <td className="px-3 py-2 text-right tabular-nums text-[var(--tse-muted)]">
            {linha.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </td>
        ) : null}
        <td className="px-3 py-2">
          <TseStatus cor={corTendencia(linha.tendencia)}>{cityTrendLabel(linha.tendencia)}</TseStatus>
        </td>
        <TseChevronCelula aberta={aberta} />
      </tr>
      {aberta ? (
        <tr className="bg-[var(--tse-bar)]">
          <td colSpan={colunas} className="px-3 pb-3 pt-1">
            <div className="rounded-lg bg-white px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                Linha do tempo · {rotuloValor.toLowerCase()}
              </p>
              <InstagramCityTrendChart
                points={linha.pontos}
                valueLabel={rotuloValor}
                emptyHint={
                  modo === 'caption'
                    ? linha.posts <= 1
                      ? 'Só 1 publicação nesta cidade no período — são necessárias mais para ver a tendência.'
                      : 'Sem data nas publicações para montar a linha do tempo.'
                    : 'Ainda sem histórico diário. Atualize em dias diferentes para formar a linha do tempo.'
                }
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}
