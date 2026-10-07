'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'
import {
  TseBarraRotulo,
  TseBarraValor,
  TseBusca,
  TseCarregando,
  TseCard,
  TseDado,
  TseDados,
  TseErro,
  TseVazio,
  tseLinkAcaoClass,
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
  RadarResumo,
  RadarTabela,
  corDaSerie,
  fmtData,
  fmtDataHora,
  fmtInt,
  normalizar,
  ordenarLinhas,
  plural,
  rankPor,
  useLinhasAbertas,
  useOrdenacao,
  type RadarAbaProps,
  type RadarColuna,
} from '@/components/monitoramento/radar-ui'
import type { GoogleTrendsCompareRow, GoogleTrendsSearchContext } from '@/lib/google-trends-types'
import { DEFAULT_GOOGLE_TRENDS_TIMEFRAME, GOOGLE_TRENDS_WINDOW_LABEL } from '@/lib/google-trends-timeframe'
import {
  aguardarColetaTrends,
  fetchTrendsInteresse,
  fetchTrendsStatus,
  iniciarColetaTrends,
  type TrendsInteresse,
} from '@/lib/services/radar-eleitoral-client'
import { cn } from '@/lib/utils'

const GEO = 'BR-PI'
const TIMEFRAME = DEFAULT_GOOGLE_TRENDS_TIMEFRAME
type Coluna = 'nome' | 'atual' | 'crescimento' | 'pico' | 'quando' | 'tendencia'
const COLUNAS_TEXTO: readonly Coluna[] = ['nome', 'quando']

const VAZIO: TrendsInteresse = {
  series: [],
  compare: [],
  chartData: [],
  setupRequired: false,
  collectedAt: null,
  dateFrom: null,
  dateTo: null,
  seriesStale: false,
}

const chaveLinha = (l: GoogleTrendsCompareRow): string => l.slug ?? l.searchTerm
const fmtDiaCurto = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

function Crescimento({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[var(--tse-muted)]">—</span>
  const sobe = pct > 0
  const desce = pct < 0
  return (
    <span
      className={cn(
        'inline-flex items-center justify-end gap-0.5 font-bold tabular-nums',
        sobe && 'text-[var(--tse-olive)]',
        desce && 'text-red-700',
        !sobe && !desce && 'text-[var(--tse-muted)]',
      )}
    >
      {sobe ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : null}
      {desce ? <TrendingDown className="h-3.5 w-3.5" aria-hidden /> : null}
      {sobe ? '+' : ''}
      {pct}%
    </span>
  )
}

function Sparkline({ pontos, cor }: { pontos: GoogleTrendsCompareRow['points']; cor: string }) {
  if (pontos.length < 2) return <span className="text-[var(--tse-muted)]">—</span>
  const w = 110
  const h = 26
  const notas = pontos.map((p) => p.score)
  const max = Math.max(...notas, 1)
  const min = Math.min(...notas, 0)
  const faixa = Math.max(max - min, 1)
  const coords = pontos
    .map((p, i) => `${(i / (pontos.length - 1)) * w},${h - ((p.score - min) / faixa) * (h - 4) - 2}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[26px] w-[110px]" aria-hidden>
      <polyline fill="none" stroke={cor} strokeWidth="1.75" strokeLinejoin="round" points={coords} />
    </svg>
  )
}

function ListaRelacionada({ titulo, itens }: { titulo: string; itens: GoogleTrendsSearchContext['queriesTop'] }) {
  if (itens.length === 0) return null
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">{titulo}</p>
      <ul className="mt-1 space-y-0.5 text-[12px]">
        {itens.map((i) => (
          <li key={`${i.kind}-${i.bucket}-${i.rank}-${i.label}`}>
            <span className="font-semibold">{i.label}</span>
            {i.formattedValue ? <span className="text-[var(--tse-muted)]"> · {i.formattedValue}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DetalheBusca({ linha }: { linha: GoogleTrendsCompareRow }) {
  const ctx = linha.searchContext
  const ultimos = linha.points.slice(-14).reverse()
  return (
    <div className="grid gap-4 bg-[var(--tse-bar)] px-4 py-3 md:grid-cols-[1fr_220px]">
      <div className="rounded-lg bg-white p-3">
        <p className="text-[13px] font-bold">Contexto de busca</p>
        <p className="text-[11px] text-[var(--tse-muted)]">
          Consultas e tópicos que o Google associa a este nome no período — não indica a causa dos picos.
        </p>
        {ctx?.hasData ? (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <ListaRelacionada titulo="Consultas frequentes" itens={ctx.queriesTop} />
            <ListaRelacionada titulo="Consultas em alta" itens={ctx.queriesRising} />
            <ListaRelacionada titulo="Tópicos frequentes" itens={ctx.topicsTop} />
            <ListaRelacionada titulo="Tópicos em alta" itens={ctx.topicsRising} />
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-[var(--tse-muted)]">
            Sem consultas ou tópicos relacionados — volume de busca baixo para o Google Trends.
          </p>
        )}
      </div>
      <div className="rounded-lg bg-white p-3">
        <p className="text-[13px] font-bold">Últimos 14 dias</p>
        {ultimos.length === 0 ? (
          <p className="mt-2 text-[12px] text-[var(--tse-muted)]">Sem pontos na série.</p>
        ) : (
          <ul className="mt-1 divide-y divide-[#EEEEEE] text-[12px]">
            {ultimos.map((p) => (
              <li key={p.date} className="flex justify-between py-1">
                <span className="text-[var(--tse-muted)]">{fmtDiaCurto(p.date)}</span>
                <span className="font-bold tabular-nums">{p.score}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function TrendsRadarPanel({ candidato, onCandidatoChange }: RadarAbaProps) {
  const [dados, setDados] = useState<TrendsInteresse>(VAZIO)
  const [carregando, setCarregando] = useState<boolean>(true)
  const [coletando, setColetando] = useState<boolean>(false)
  const [erro, setErro] = useState<string>('')
  const [mensagem, setMensagem] = useState<string>('')
  const [runnerDisponivel, setRunnerDisponivel] = useState<boolean>(true)
  const [runnerMensagem, setRunnerMensagem] = useState<string | null>(null)
  const [setupStatus, setSetupStatus] = useState<boolean>(false)
  const [busca, setBusca] = useState<string>('')
  const { ordem, asc, ordenar } = useOrdenacao<Coluna>('atual', COLUNAS_TEXTO)
  const { abertas, alternar, setAbertas } = useLinhasAbertas(candidato)

  const carregar = useCallback(async () => {
    setErro('')
    try {
      setDados(await fetchTrendsInteresse(GEO, TIMEFRAME))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar buscas.')
    } finally {
      setCarregando(false)
    }
  }, [])

  const acompanharColeta = useCallback(async () => {
    const resumo = await aguardarColetaTrends()
    if (resumo) setMensagem(resumo)
    await carregar()
  }, [carregar])

  useEffect(() => {
    void carregar()
    void (async () => {
      try {
        const s = await fetchTrendsStatus()
        if (!s) return
        setRunnerDisponivel(s.runnerAvailable !== false)
        setRunnerMensagem(s.runnerMessage ?? null)
        if (s.setupRequired) setSetupStatus(true)
        if (s.collectInProgress) {
          setColetando(true)
          try {
            await acompanharColeta()
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'Erro na coleta.')
          } finally {
            setColetando(false)
          }
        }
      } catch {
        /* status é opcional: a aba segue com os dados em cache */
      }
    })()
  }, [carregar, acompanharColeta])

  const coletar = async () => {
    setColetando(true)
    setMensagem('')
    setErro('')
    try {
      await iniciarColetaTrends(GEO, TIMEFRAME)
      await acompanharColeta()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setColetando(false)
    }
  }

  const setupRequired = dados.setupRequired || setupStatus
  const linhas = dados.compare
  const ranking = useMemo(() => rankPor(linhas, chaveLinha, (l) => l.latestScore), [linhas])

  const coresPorNome = useMemo(() => {
    const mapa = new Map<string, string>()
    let outro = 0
    for (const s of dados.series) {
      mapa.set(s.name, corDaSerie(s.actorType, s.actorType === 'own_candidate' ? 0 : outro++))
    }
    return mapa
  }, [dados.series])

  const termo = normalizar(busca.trim())
  const filtradas = linhas.filter(
    (l) => (!candidato || l.slug === candidato) && (!termo || normalizar(l.name).includes(termo) || normalizar(l.searchTerm).includes(termo)),
  )
  const visiveis = ordenarLinhas<GoogleTrendsCompareRow, Coluna>(
    filtradas,
    (l, c) =>
      c === 'nome'
        ? l.name
        : c === 'crescimento'
          ? (l.growthPct ?? -Infinity)
          : c === 'pico'
            ? l.peakScore
            : c === 'quando'
              ? (l.peakDate ?? '')
              : l.latestScore,
    ordem,
    asc,
  )

  const emAlta = filtradas.filter((l) => (l.growthPct ?? 0) > 0).length
  const picos = filtradas.filter((l) => l.trendAlert).length
  const mediaAtual = filtradas.length ? filtradas.reduce((s, l) => s + l.latestScore, 0) / filtradas.length : 0
  const lider = [...linhas].sort((a, b) => b.latestScore - a.latestScore)[0]
  const foco = linhas.find((l) => l.slug === candidato) ?? linhas.find((l) => l.actorType === 'own_candidate')
  const nomeCandidato = linhas.find((l) => l.slug === candidato)?.name
  const todosAbertos = visiveis.length > 0 && visiveis.every((l) => abertas.has(chaveLinha(l)))
  const nomeFoco = candidato ? dados.series.find((s) => s.slug === candidato)?.name : undefined

  const colunas: RadarColuna<GoogleTrendsCompareRow, Coluna>[] = [
    {
      id: 'nome',
      rotulo: 'Nome',
      celula: (l) => (
        <RadarCandidatoNome
          nome={l.name}
          tipo={l.actorType}
          extra={
            l.trendAlert ? (
              <span className="rounded-full bg-[var(--tse-yellow)] px-2 py-px text-[10px] font-bold text-white">
                Pico recente
              </span>
            ) : null
          }
        />
      ),
    },
    {
      id: 'atual',
      rotulo: 'Atual',
      alinhar: 'right',
      celula: (l) => <TseBarraValor valor={l.latestScore} max={100} formatado={fmtInt(l.latestScore)} larguraNumero="w-10" />,
    },
    {
      id: 'crescimento',
      rotulo: 'Cresc.',
      alinhar: 'right',
      celula: (l) => <Crescimento pct={l.growthPct} />,
    },
    {
      id: 'pico',
      rotulo: 'Pico',
      alinhar: 'right',
      className: 'hidden sm:table-cell',
      celula: (l) => <span className="font-bold tabular-nums">{fmtInt(l.peakScore)}</span>,
    },
    {
      id: 'quando',
      rotulo: 'Quando',
      className: 'hidden md:table-cell',
      celula: (l) => <span className="whitespace-nowrap text-[12px]">{fmtData(l.peakDate)}</span>,
    },
    {
      id: 'tendencia',
      rotulo: 'Tendência',
      ordenavel: false,
      className: 'hidden lg:table-cell',
      celula: (l) => <Sparkline pontos={l.points} cor={coresPorNome.get(l.name) ?? RADAR_CORES_SERIE.outros[0]} />,
    },
  ]

  if (carregando && linhas.length === 0) return <TseCarregando texto="Carregando buscas do Google Trends…" />

  return (
    <RadarLayout
      aside={
        <>
          <RadarDadosGerais fonte={`Google Trends · Piauí · ${GOOGLE_TRENDS_WINDOW_LABEL}`}>
            <TseDados>
              <TseDado rotulo="Nomes monitorados" valor={fmtInt(filtradas.length)} />
              <TseDado rotulo="Em alta" valor={fmtInt(emAlta)} />
              <TseDado rotulo="Picos recentes" valor={fmtInt(picos)} />
              {lider ? <TseDado rotulo="Maior interesse" valor={lider.name} /> : null}
            </TseDados>
            {foco ? (
              <>
                <TseBarraRotulo pct={foco.latestScore} rotulo={fmtInt(foco.latestScore)} />
                <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Interesse atual em {foco.name} (0–100)</p>
              </>
            ) : null}
          </RadarDadosGerais>
          <RadarListaCandidatos
            titulo="Interesse atual"
            itens={linhas
              .filter((l): l is GoogleTrendsCompareRow & { slug: string } => Boolean(l.slug))
              .map((l) => ({ slug: l.slug, nome: l.name, tipo: l.actorType, valor: l.latestScore }))}
            candidato={candidato}
            onCandidatoChange={onCandidatoChange}
          />
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--tse-muted)]">
          {GOOGLE_TRENDS_WINDOW_LABEL} · Piauí ({GEO})
          {dados.collectedAt ? ` · última coleta ${fmtDataHora(dados.collectedAt)}` : ''}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <TseBusca value={busca} onChange={setBusca} placeholder="Buscar nome" className="w-56" />
          <RadarColetar onClick={() => void coletar()} ocupado={coletando} disabled={setupRequired || !runnerDisponivel} />
        </div>
      </div>

      {setupRequired ? (
        <RadarAviso titulo="Tabelas do radar ausentes">
          Execute <RadarCodigo>database/create-google-trends-tables.sql</RadarCodigo> e{' '}
          <RadarCodigo>database/create-google-trends-related.sql</RadarCodigo> no Supabase antes da primeira coleta.
        </RadarAviso>
      ) : null}
      {!runnerDisponivel && runnerMensagem ? (
        <RadarAviso titulo="Coleta indisponível neste servidor">{runnerMensagem}</RadarAviso>
      ) : null}
      {coletando ? (
        <RadarAviso carregando titulo="Coletando buscas">
          Comparando o interesse de busca dos candidatos (~1 min). Se houver limite de requisições, o servidor aguarda e
          tenta de novo.
        </RadarAviso>
      ) : null}
      {dados.seriesStale && !coletando ? (
        <RadarAviso titulo="Série desatualizada">
          O gráfico não chega aos últimos dias. Clique em <strong>Coletar agora</strong> para buscar os 30 dias mais
          recentes.
        </RadarAviso>
      ) : null}
      {mensagem ? <RadarAviso tom="ok" titulo="Coleta concluída">{mensagem}</RadarAviso> : null}
      {erro ? (
        <div className="mt-4">
          <TseErro>{erro}</TseErro>
        </div>
      ) : null}

      <RadarResumo
        titulo="Buscas"
        escopo={nomeCandidato ?? 'Todos os candidatos'}
        descricao={
          dados.dateFrom && dados.dateTo
            ? `Interesse relativo 0–100 · ${fmtDiaCurto(dados.dateFrom)} a ${fmtDiaCurto(dados.dateTo)}`
            : 'Interesse relativo 0–100 no Google'
        }
        numeros={[
          { rotulo: 'interesse médio', valor: fmtInt(Math.round(mediaAtual)) },
          { rotulo: 'em alta', valor: fmtInt(emAlta) },
          { rotulo: 'picos recentes', valor: fmtInt(picos) },
        ]}
      />

      {dados.series.length > 0 && dados.chartData.length > 0 ? (
        <TseCard
          className="mt-4"
          titulo="Interesse de busca ao longo do tempo"
          subtitulo="Índice relativo 0–100 · o candidato filtrado fica em destaque"
        >
          <div className="mt-3 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={RADAR_CORES_SERIE.grade} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => fmtDiaCurto(v)}
                  tick={{ fontSize: 11, fill: RADAR_CORES_SERIE.texto }}
                  minTickGap={24}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: RADAR_CORES_SERIE.texto }} width={28} />
                <Tooltip labelFormatter={(v) => fmtDiaCurto(String(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                {dados.series.map((s) => (
                  <Line
                    key={s.searchTerm}
                    type="monotone"
                    dataKey={s.name}
                    stroke={coresPorNome.get(s.name)}
                    strokeWidth={nomeFoco === s.name ? 3 : 2}
                    strokeOpacity={nomeFoco && nomeFoco !== s.name ? 0.25 : 1}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            {dados.series.map((s) => (
              <li key={s.searchTerm} className="flex items-center gap-1.5">
                <span className="h-3 w-3" style={{ backgroundColor: coresPorNome.get(s.name) }} aria-hidden />
                {s.name}
              </li>
            ))}
          </ul>
        </TseCard>
      ) : null}

      <RadarLinhaContagem
        acoes={
          <>
            {termo ? (
              <button type="button" onClick={() => setBusca('')} className={tseLinkAcaoClass}>
                Limpar busca
              </button>
            ) : null}
            {visiveis.length > 0 ? (
              <button
                type="button"
                onClick={() => setAbertas(todosAbertos ? new Set() : new Set(visiveis.map(chaveLinha)))}
                className={tseLinkAcaoClass}
              >
                {todosAbertos ? 'Recolher todos' : 'Expandir todos'}
              </button>
            ) : null}
          </>
        }
      >
        {plural(visiveis.length, 'nome', 'nomes')}
        {termo ? ' com a busca aplicada' : ''} · clique na linha para ver o contexto de busca
      </RadarLinhaContagem>

      <div className="mt-3">
        {visiveis.length === 0 ? (
          <TseVazio>
            {linhas.length === 0
              ? 'Sem dados de interesse ainda. Cadastre candidatos e rode a coleta do Google Trends.'
              : 'Nenhum nome encontrado para os filtros selecionados.'}
          </TseVazio>
        ) : (
          <RadarTabela
            linhas={visiveis}
            chave={chaveLinha}
            rank={(l) => ranking.get(chaveLinha(l)) ?? 0}
            colunas={colunas}
            ordem={ordem}
            asc={asc}
            onOrdenar={ordenar}
            abertas={abertas}
            onAlternar={alternar}
            detalhe={(l) => <DetalheBusca linha={l} />}
          />
        )}
      </div>
    </RadarLayout>
  )
}
