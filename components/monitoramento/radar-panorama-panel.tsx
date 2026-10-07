'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RefreshCw, Star } from 'lucide-react'
import {
  TseBarraRotulo,
  TseBarraValor,
  TseCard,
  TseCarregando,
  TseDado,
  TseDados,
  TseErro,
  TsePill,
  TseSegmentado,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseLinkAcaoClass,
  tseTabela,
} from '@/components/tse/tse-ui'
import {
  RADAR_CORES_SERIE,
  RadarAviso,
  RadarCandidatoNome,
  RadarCodigo,
  RadarColetar,
  RadarDadosGerais,
  RadarLayout,
  RadarLinhaContagem,
  RadarListaCandidatos,
  RadarProgresso,
  RadarResumo,
  RadarSubItem,
  RadarSubLista,
  RadarTabela,
  corDaSerie,
  fmtData,
  fmtDataHora,
  fmtInt,
  ordenarLinhas,
  plural,
  rankPor,
  useLinhasAbertas,
  useOrdenacao,
  type RadarAbaProps,
  type RadarColuna,
} from '@/components/monitoramento/radar-ui'
import { RadarNoticiasDiaModal, type RadarNoticiasDia } from '@/components/monitoramento/radar-noticias-dia-modal'
import type { usePanoramaPanel } from '@/components/monitoramento/use-panorama-panel'
import type { MonitoramentoCollectAllProgress, MonitoramentoCollectStepStatus } from '@/lib/monitoramento-collect-all'
import type { PanoramaCandidateColumn } from '@/lib/monitoramento-panorama'
import type { PanoramaPlatformChart, PanoramaPlatformId } from '@/lib/monitoramento-panorama-charts'
import type { PanoramaKpiBadge, PanoramaPlatformKpiCard } from '@/lib/monitoramento-panorama-kpis'
import { cn } from '@/lib/utils'

type Coluna = 'nome' | 'noticias' | 'videos' | 'views' | 'anuncios' | 'busca' | 'score'
const COLUNAS_TEXTO: readonly Coluna[] = ['nome']

const TOM_BADGE: Record<PanoramaKpiBadge, 'amarelo' | 'verde' | 'neutro'> = {
  leader: 'amarelo',
  growth: 'verde',
  outsider: 'neutro',
}

const ROTULO_STATUS: Record<MonitoramentoCollectStepStatus, string> = {
  pending: 'na fila',
  running: 'coletando',
  success: 'ok',
  skipped: 'pulado',
  error: 'erro',
}

const ROTULO_GRAFICO: Record<PanoramaPlatformId, string> = {
  youtube: 'YouTube',
  'google-news': 'Notícias',
  instagram: 'Instagram',
  'google-trends': 'Buscas',
  'meta-ads': 'Anúncios',
}

const fmtDiaCurto = (iso: string): string =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

const fmtCompacto = (n: number): string =>
  n.toLocaleString('pt-BR', { notation: n >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 })

function percentColeta(p: MonitoramentoCollectAllProgress): number {
  const feitas = p.steps.filter((s) => s.status !== 'pending' && s.status !== 'running').length
  return p.totalSteps > 0 ? (feitas / p.totalSteps) * 100 : 0
}

function Estrelas({ n }: { n: number }) {
  return (
    <span className="inline-flex" aria-label={`${n} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < n ? 'fill-[var(--tse-yellow)] text-[var(--tse-yellow)]' : 'text-[var(--tse-zero)]',
          )}
          aria-hidden
        />
      ))}
    </span>
  )
}

function LeituraPlataforma({ card }: { card: PanoramaPlatformKpiCard }) {
  return (
    <TseCard titulo={card.platformLabel} subtitulo={card.metricLabel}>
      {card.empty || card.insights.length === 0 ? (
        <p className="mt-3 text-[12px] text-[var(--tse-muted)]">Sem dados suficientes no período.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {card.insights.map((i) => (
            <li key={`${i.badge}-${i.name}`} className="text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <TsePill tom={TOM_BADGE[i.badge]} className="text-[10px] uppercase tracking-wide">
                  {i.badgeLabel}
                </TsePill>
                <span className="font-bold">{i.name}</span>
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">{i.text}</p>
            </li>
          ))}
        </ul>
      )}
    </TseCard>
  )
}

function DetalheCandidato({ c }: { c: PanoramaCandidateColumn }) {
  const noticias = c.googleNews?.previews ?? []
  const videos = c.youtube?.previews ?? []
  const anuncios = c.metaAds?.previews ?? []
  return (
    <div className="bg-[var(--tse-bar)]">
      {c.headline ? <p className="px-4 pt-3 text-[13px] font-semibold">{c.headline}</p> : null}
      <div className="grid gap-3 lg:grid-cols-3 [&>div]:px-4 [&>div]:py-3">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">Notícias</p>
          <RadarSubLista vazio="Sem notícias no período.">
            {noticias.length
              ? noticias.map((n) => (
                  <RadarSubItem
                    key={n.url}
                    titulo={n.title}
                    href={n.url}
                    meta={[n.source, fmtData(n.publishedAt)].filter(Boolean).join(' · ')}
                  />
                ))
              : null}
          </RadarSubLista>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">Vídeos</p>
          <RadarSubLista vazio="Sem vídeos no período.">
            {videos.length
              ? videos.map((v) => (
                  <RadarSubItem
                    key={v.url}
                    titulo={v.title}
                    href={v.url}
                    meta={[v.channel, fmtData(v.publishedAt)].filter(Boolean).join(' · ')}
                    valor={fmtCompacto(v.views)}
                  />
                ))
              : null}
          </RadarSubLista>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">Anúncios</p>
          <RadarSubLista vazio="Sem anúncios no período.">
            {anuncios.length
              ? anuncios.map((a) => (
                  <RadarSubItem
                    key={a.url}
                    titulo={a.body || a.pageName || 'Anúncio sem texto'}
                    href={a.url}
                    meta={[a.pageName, a.isActive ? 'ativo' : 'inativo', a.spendLabel].filter(Boolean).join(' · ')}
                  />
                ))
              : null}
          </RadarSubLista>
        </div>
      </div>
    </div>
  )
}

function GraficoLinha({
  chart,
  cores,
  foco,
}: {
  chart: PanoramaPlatformChart
  cores: Map<string, string>
  foco: string | null
}) {
  return (
    <>
      <div className="mt-3 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart.chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={RADAR_CORES_SERIE.grade} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => fmtDiaCurto(v)}
              tick={{ fontSize: 11, fill: RADAR_CORES_SERIE.texto }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => fmtCompacto(v)}
              tick={{ fontSize: 11, fill: RADAR_CORES_SERIE.texto }}
              width={44}
            />
            <Tooltip
              labelFormatter={(v) => fmtDiaCurto(String(v))}
              formatter={(v: number, nome: string) => [fmtInt(v), chart.lines.find((l) => l.slug === nome)?.name ?? nome]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            {chart.lines.map((l) => (
              <Line
                key={l.slug}
                type="monotone"
                dataKey={l.slug}
                stroke={cores.get(l.slug) ?? RADAR_CORES_SERIE.outros[0]}
                strokeWidth={foco === l.slug ? 3 : 2}
                strokeOpacity={foco && foco !== l.slug ? 0.25 : 1}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legenda itens={chart.lines.map((l) => ({ slug: l.slug, nome: l.name }))} cores={cores} />
    </>
  )
}

function Legenda({ itens, cores }: { itens: { slug: string; nome: string }[]; cores: Map<string, string> }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
      {itens.map((i) => (
        <li key={i.slug} className="flex items-center gap-1.5">
          <span className="h-3 w-3" style={{ backgroundColor: cores.get(i.slug) }} aria-hidden />
          {i.nome}
        </li>
      ))}
    </ul>
  )
}

function MapaCalor({ chart, foco }: { chart: PanoramaPlatformChart; foco: string | null }) {
  const datas = chart.heatmapDates ?? []
  const linhas = chart.heatmapRows ?? []
  const max = Math.max(1, ...linhas.flatMap((l) => l.values))
  const [selecao, setSelecao] = useState<RadarNoticiasDia | null>(null)
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="border-separate border-spacing-[3px] text-[12px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white" />
            {datas.map((d, i) => (
              <th key={d} className="w-6 text-[10px] font-semibold text-[var(--tse-muted)]">
                {i % 3 === 0 || i === datas.length - 1 ? fmtDiaCurto(d).split(' ')[0] : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.slug} className={cn(foco && foco !== l.slug && 'opacity-40')}>
              <td className="sticky left-0 whitespace-nowrap bg-white pr-3 font-semibold">{l.name}</td>
              {l.values.map((v, i) => {
                const data = datas[i]
                const rotulo = `${l.name} · ${data ? fmtDiaCurto(data) : ''}: ${plural(v, 'notícia', 'notícias')}`
                const estilo = {
                  backgroundColor: v > 0 ? 'var(--tse-yellow)' : 'var(--tse-bar)',
                  opacity: v > 0 ? 0.25 + (v / max) * 0.75 : 1,
                }
                return (
                  <td key={data ?? i} className="h-6 w-6 p-0">
                    {v > 0 && data ? (
                      <button
                        type="button"
                        title={`${rotulo} · clique para ver`}
                        aria-label={`Ver ${rotulo}`}
                        onClick={() => setSelecao({ slug: l.slug, nome: l.name, data, qtd: v })}
                        className="block h-full w-full rounded-sm outline-none ring-[var(--tse-olive)] hover:ring-2 focus-visible:ring-2"
                        style={estilo}
                      />
                    ) : (
                      <span title={rotulo} className="block h-full w-full rounded-sm" style={estilo} />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-[var(--tse-muted)]">
        Quanto mais forte o amarelo, mais notícias no dia. Clique num dia para ver as matérias.
      </p>
      {selecao ? <RadarNoticiasDiaModal selecao={selecao} onClose={() => setSelecao(null)} /> : null}
    </div>
  )
}

function TabelaInstagram({ chart, foco }: { chart: PanoramaPlatformChart; foco: string | null }) {
  const linhas = chart.instagramTable ?? []
  const maxEng = Math.max(1, ...linhas.map((l) => l.avgEngagement))
  return (
    <div className={cn(tseTabela.container, 'mt-3')}>
      <table className={tseTabela.table} data-tse-tabela>
        <thead className={tseTabela.thead}>
          <tr>
            <th className={tseTabela.th}>Perfil</th>
            <th className={cn(tseTabela.th, 'text-right')}>Posts</th>
            <th className={cn(tseTabela.th, 'hidden text-right sm:table-cell')}>Por semana</th>
            <th className={cn(tseTabela.th, 'text-right')}>Eng. médio</th>
            <th className={cn(tseTabela.th, 'hidden text-right md:table-cell')}>Eng. total</th>
            <th className={cn(tseTabela.th, 'hidden lg:table-cell')}>Melhor post</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.slug} className={cn(tseTabela.tr, foco === l.slug && 'bg-[var(--tse-yellow-soft)]')}>
              <td className={tseTabela.td}>
                <p className="font-bold">{l.name}</p>
                {l.instagramUsername ? (
                  <p className="text-[11px] text-[var(--tse-muted)]">@{l.instagramUsername}</p>
                ) : null}
              </td>
              <td className={cn(tseTabela.td, 'text-right font-bold tabular-nums')}>{fmtInt(l.postCount)}</td>
              <td className={cn(tseTabela.td, 'hidden text-right tabular-nums sm:table-cell')}>
                {l.postsPerWeek.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
              </td>
              <td className={tseTabela.td}>
                <TseBarraValor valor={l.avgEngagement} max={maxEng} formatado={fmtCompacto(Math.round(l.avgEngagement))} />
              </td>
              <td className={cn(tseTabela.td, 'hidden text-right tabular-nums md:table-cell')}>
                {fmtCompacto(l.totalEngagement)}
              </td>
              <td className={cn(tseTabela.td, 'hidden max-w-[260px] lg:table-cell')}>
                {l.topPost?.postUrl ? (
                  <a
                    href={l.topPost.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-[12px] hover:text-[var(--tse-olive)] hover:underline"
                  >
                    {l.topPost.caption || 'Ver post'} · {fmtCompacto(l.topPost.engagement)}
                  </a>
                ) : (
                  <span className="text-[var(--tse-muted)]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type PanoramaState = ReturnType<typeof usePanoramaPanel>

export function RadarPanoramaPanel({ candidato, onCandidatoChange, state }: RadarAbaProps & { state: PanoramaState }) {
  const { panorama, loading, refreshing, collectingAll, collectProgress, metaAdsProgress, error, busy } = state
  const colunasModelo = panorama.columns
  const { ordem, asc, ordenar } = useOrdenacao<Coluna>('noticias', COLUNAS_TEXTO)
  const { abertas, alternar, setAbertas } = useLinhasAbertas(candidato)
  const graficos = panorama.charts.filter((c) => !c.empty)
  const [graficoId, setGraficoId] = useState<PanoramaPlatformId | null>(null)
  const grafico = graficos.find((c) => c.id === graficoId) ?? graficos[0]

  const cores = useMemo(() => {
    const mapa = new Map<string, string>()
    let outro = 0
    for (const c of colunasModelo) {
      mapa.set(c.slug, corDaSerie(c.actorType, c.actorType === 'own_candidate' ? 0 : outro++))
    }
    return mapa
  }, [colunasModelo])

  const ranking = useMemo(
    () => rankPor(colunasModelo, (c) => c.slug, (c) => c.googleNews?.mentions7d ?? 0),
    [colunasModelo],
  )

  const filtradas = candidato ? colunasModelo.filter((c) => c.slug === candidato) : colunasModelo
  const visiveis = ordenarLinhas<PanoramaCandidateColumn, Coluna>(
    filtradas,
    (c, col) => {
      switch (col) {
        case 'nome':
          return c.name
        case 'videos':
          return c.youtube?.videos7d ?? 0
        case 'views':
          return c.youtube?.views7d ?? 0
        case 'anuncios':
          return c.metaAds?.activeAds ?? 0
        case 'busca':
          return c.trends?.currentIndex ?? 0
        case 'score':
          return c.digitalScore.stars
        default:
          return c.googleNews?.mentions7d ?? 0
      }
    },
    ordem,
    asc,
  )

  const soma = (f: (c: PanoramaCandidateColumn) => number): number => filtradas.reduce((s, c) => s + f(c), 0)
  const totalNoticias = soma((c) => c.googleNews?.mentions7d ?? 0)
  const totalVideos = soma((c) => c.youtube?.videos7d ?? 0)
  const totalAnuncios = soma((c) => c.metaAds?.activeAds ?? 0)
  const maxNoticias = Math.max(1, ...colunasModelo.map((c) => c.googleNews?.mentions7d ?? 0))
  const maxViews = Math.max(1, ...colunasModelo.map((c) => c.youtube?.views7d ?? 0))
  const foco = colunasModelo.find((c) => c.slug === candidato) ?? colunasModelo.find((c) => c.actorType === 'own_candidate')
  const nomeCandidato = colunasModelo.find((c) => c.slug === candidato)?.name
  const todosAbertos = visiveis.length > 0 && visiveis.every((c) => abertas.has(c.slug))
  const etapaAtual = collectProgress?.steps.find((s) => s.id === collectProgress.currentStepId)
  const coletaTerminada = !collectingAll && collectProgress && !collectProgress.running

  const colunas: RadarColuna<PanoramaCandidateColumn, Coluna>[] = [
    {
      id: 'nome',
      rotulo: 'Candidato',
      celula: (c) => <RadarCandidatoNome nome={c.name} tipo={c.actorType} />,
    },
    {
      id: 'noticias',
      rotulo: 'Notícias',
      alinhar: 'right',
      celula: (c) => {
        const n = c.googleNews?.mentions7d ?? 0
        return <TseBarraValor valor={n} max={maxNoticias} formatado={fmtInt(n)} larguraNumero="w-10" />
      },
    },
    {
      id: 'videos',
      rotulo: 'Vídeos',
      alinhar: 'right',
      className: 'hidden sm:table-cell',
      celula: (c) => <span className="font-bold tabular-nums">{fmtInt(c.youtube?.videos7d ?? 0)}</span>,
    },
    {
      id: 'views',
      rotulo: 'Views',
      alinhar: 'right',
      className: 'hidden md:table-cell',
      celula: (c) => {
        const n = c.youtube?.views7d ?? 0
        return <TseBarraValor valor={n} max={maxViews} formatado={fmtCompacto(n)} cor="amarelo" />
      },
    },
    {
      id: 'anuncios',
      rotulo: 'Anúncios ativos',
      alinhar: 'right',
      className: 'hidden md:table-cell',
      celula: (c) => <span className="font-bold tabular-nums">{fmtInt(c.metaAds?.activeAds ?? 0)}</span>,
    },
    {
      id: 'busca',
      rotulo: 'Busca',
      alinhar: 'right',
      className: 'hidden lg:table-cell',
      celula: (c) =>
        c.trends ? (
          <div className="text-right">
            <p className="font-bold tabular-nums">{fmtInt(c.trends.currentIndex)}</p>
            <p className="text-[11px] text-[var(--tse-muted)]">{c.trends.trendLabel}</p>
          </div>
        ) : (
          <span className="text-[var(--tse-muted)]">—</span>
        ),
    },
    {
      id: 'score',
      rotulo: 'Score digital',
      className: 'hidden xl:table-cell',
      celula: (c) => (
        <div title={c.digitalScore.label}>
          <Estrelas n={c.digitalScore.stars} />
        </div>
      ),
    },
  ]

  if (loading && colunasModelo.length === 0) return <TseCarregando texto="Carregando panorama…" />

  return (
    <RadarLayout
      aside={
        <>
          <RadarDadosGerais fonte={`Painel consolidado · ${panorama.windowLabel}`}>
            <TseDados>
              <TseDado rotulo="Candidatos" valor={fmtInt(colunasModelo.length)} />
              <TseDado rotulo="Plataformas com dados" valor={fmtInt(graficos.length)} />
              <TseDado rotulo="Última atualização" valor={fmtDataHora(panorama.lastUpdated)} />
            </TseDados>
            {foco ? (
              <>
                <TseBarraRotulo pct={(foco.digitalScore.stars / 5) * 100} rotulo={`${foco.digitalScore.stars}/5`} />
                <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Score digital de {foco.name}</p>
              </>
            ) : null}
          </RadarDadosGerais>
          <RadarListaCandidatos
            titulo="Notícias (7 dias)"
            itens={colunasModelo.map((c) => ({
              slug: c.slug,
              nome: c.name,
              tipo: c.actorType,
              valor: c.googleNews?.mentions7d ?? 0,
            }))}
            candidato={candidato}
            onCandidatoChange={onCandidatoChange}
          />
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--tse-muted)]">
          {panorama.windowLabel}
          {panorama.lastUpdated ? ` · atualizado em ${fmtDataHora(panorama.lastUpdated)}` : ''}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void state.carregar(true)} disabled={busy} className={tseBotaoCinzaClass}>
            <RefreshCw className={cn(tseBotaoIconeClass, refreshing && 'animate-spin')} />
            Recarregar
          </button>
          <RadarColetar onClick={() => void state.coletarTodas()} ocupado={collectingAll} disabled={busy}>
            Coletar todas
          </RadarColetar>
        </div>
      </div>

      {panorama.setupRequired ? (
        <RadarAviso titulo="Tabelas do radar ausentes">
          Execute os scripts em <RadarCodigo>database/</RadarCodigo> do YouTube, Notícias, Trends e Meta Ads no Supabase
          antes da primeira coleta.
        </RadarAviso>
      ) : null}
      {collectingAll && collectProgress ? (
        <RadarProgresso
          titulo={`Atualizando fontes · ${collectProgress.stepIndex + 1} de ${collectProgress.totalSteps}`}
          detalhe={
            collectProgress.currentStepId === 'meta-ads' && metaAdsProgress
              ? `Anúncios: ${metaAdsProgress.message}`
              : etapaAtual
                ? `${etapaAtual.label}: ${etapaAtual.message || 'coletando…'}`
                : undefined
          }
          percent={percentColeta(collectProgress)}
          rodape={collectProgress.steps.map((s) => `${s.label} ${ROTULO_STATUS[s.status]}`).join(' · ')}
        />
      ) : null}
      {coletaTerminada ? (
        <RadarAviso tom={collectProgress.steps.some((s) => s.status === 'error') ? 'atencao' : 'ok'} titulo="Coleta concluída">
          {collectProgress.steps.map((s) => `${s.label}: ${s.message || ROTULO_STATUS[s.status]}`).join(' · ')}
        </RadarAviso>
      ) : null}
      {error ? (
        <div className="mt-4">
          <TseErro>{error}</TseErro>
        </div>
      ) : null}

      {panorama.platformKpis.length > 0 ? (
        <div className="mt-4">
          <h2 className="text-[15px] font-bold">Leitura rápida por plataforma</h2>
          <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {panorama.platformKpis.map((card) => (
              <LeituraPlataforma key={card.platformId} card={card} />
            ))}
          </div>
        </div>
      ) : null}

      <RadarResumo
        titulo="Panorama"
        escopo={nomeCandidato ?? 'Todos os candidatos'}
        descricao="Comparativo dos candidatos nas plataformas monitoradas · últimos 7 dias"
        numeros={[
          { rotulo: 'notícias', valor: fmtInt(totalNoticias) },
          { rotulo: 'vídeos', valor: fmtInt(totalVideos) },
          { rotulo: 'anúncios ativos', valor: fmtInt(totalAnuncios) },
        ]}
      />

      <RadarLinhaContagem
        acoes={
          visiveis.length > 0 ? (
            <button
              type="button"
              onClick={() => setAbertas(todosAbertos ? new Set() : new Set(visiveis.map((c) => c.slug)))}
              className={tseLinkAcaoClass}
            >
              {todosAbertos ? 'Recolher todos' : 'Expandir todos'}
            </button>
          ) : undefined
        }
      >
        {plural(visiveis.length, 'candidato', 'candidatos')} · posição por notícias · clique na linha para ver notícias,
        vídeos e anúncios
      </RadarLinhaContagem>

      <div className="mt-3">
        {visiveis.length === 0 ? (
          <TseVazio>
            Nenhum candidato no panorama. Cadastre candidatos em <strong>Candidatos</strong> e clique em{' '}
            <strong>Coletar todas</strong>.
          </TseVazio>
        ) : (
          <RadarTabela
            linhas={visiveis}
            chave={(c) => c.slug}
            rank={(c) => ranking.get(c.slug) ?? 0}
            colunas={colunas}
            ordem={ordem}
            asc={asc}
            onOrdenar={ordenar}
            abertas={abertas}
            onAlternar={alternar}
            detalhe={(c) => <DetalheCandidato c={c} />}
          />
        )}
      </div>

      {grafico ? (
        <TseCard
          className="mt-4"
          titulo={grafico.title}
          subtitulo={grafico.subtitle}
          acao={
            graficos.length > 1 ? (
              <TseSegmentado
                opcoes={graficos.map((g) => ({ id: g.id, label: ROTULO_GRAFICO[g.id] }))}
                valor={grafico.id}
                onChange={setGraficoId}
              />
            ) : undefined
          }
        >
          {grafico.chartType === 'heatmap' ? (
            <MapaCalor chart={grafico} foco={candidato} />
          ) : grafico.chartType === 'table' ? (
            <TabelaInstagram chart={grafico} foco={candidato} />
          ) : (
            <GraficoLinha chart={grafico} cores={cores} foco={candidato} />
          )}
        </TseCard>
      ) : null}
    </RadarLayout>
  )
}
