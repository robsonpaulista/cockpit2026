'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  TseBarraRotulo,
  TseBarraValor,
  TseBusca,
  TseCarregando,
  TseDado,
  TseDados,
  TseErro,
  TseListaFiltro,
  TseStatus,
  TseVazio,
  tseControleClass,
  tseLinkAcaoClass,
} from '@/components/tse/tse-ui'
import {
  RadarAviso,
  RadarCandidatoNome,
  RadarChip,
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
  RadarTopItens,
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
import { useMetaAdsCollectPolling } from '@/hooks/use-meta-ads-collect-polling'
import {
  buildMetaAdsCompareRows,
  buildMetaAdsPeriodTotals,
  type MetaAdsCompareActorRow,
} from '@/lib/meta-ads-aggregate'
import { formatMetaAdsCollectElapsed, metaAdsCollectPhaseLabel } from '@/lib/meta-ads-collect-progress'
import { formatSpendBrl } from '@/lib/meta-ads-format'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import { coletarMetaAds, fetchMetaAdsMencoes } from '@/lib/services/radar-eleitoral-client'

const PERIODOS = [30, 60, 90] as const
type Coluna = 'nome' | 'anuncios' | 'ativos' | 'gasto' | 'paginas'
const COLUNAS_TEXTO: readonly Coluna[] = ['nome', 'paginas']

export function MetaAdsRadarPanel({ atores, candidato, onCandidatoChange }: RadarAbaProps) {
  const [dias, setDias] = useState<number>(30)
  const [anuncios, setAnuncios] = useState<MetaAdsMentionWithActor[]>([])
  const [setupRequired, setSetupRequired] = useState<boolean>(false)
  const [carregando, setCarregando] = useState<boolean>(true)
  const [coletando, setColetando] = useState<boolean>(false)
  const [acompanhar, setAcompanhar] = useState<boolean>(false)
  const [instavel, setInstavel] = useState<boolean>(false)
  const [erro, setErro] = useState<string>('')
  const [mensagem, setMensagem] = useState<string>('')
  const [avisos, setAvisos] = useState<string[]>([])
  const [busca, setBusca] = useState<string>('')
  const [pagina, setPagina] = useState<string | null>(null)
  const { ordem, asc, ordenar } = useOrdenacao<Coluna>('anuncios', COLUNAS_TEXTO)
  const { abertas, alternar, setAbertas } = useLinhasAbertas(candidato)
  const { progress, status, refresh } = useMetaAdsCollectPolling(coletando || acompanhar)

  useEffect(() => {
    if (status?.collectInProgress) setAcompanhar(true)
    else if (!coletando) setAcompanhar(false)
  }, [status?.collectInProgress, coletando])

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const [r, s] = await Promise.all([fetchMetaAdsMencoes(dias), refresh()])
      if (!r.instavel) setAnuncios(r.dados)
      setSetupRequired(r.setupRequired || Boolean(s?.setupRequired))
      setInstavel(r.instavel)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar anúncios.')
    } finally {
      setCarregando(false)
    }
  }, [dias, refresh])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (!instavel) return
    const id = window.setTimeout(() => void carregar(), 5000)
    return () => window.clearTimeout(id)
  }, [instavel, carregar])

  const coletar = async () => {
    setColetando(true)
    setMensagem('')
    setAvisos([])
    setErro('')
    try {
      const r = await coletarMetaAds()
      setMensagem(r.mensagem)
      setAvisos(r.avisos)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setColetando(false)
      await refresh()
    }
  }

  const anunciosDaPagina = useMemo(
    () => (pagina ? anuncios.filter((a) => (a.page_name ?? '—') === pagina) : anuncios),
    [anuncios, pagina],
  )
  const linhas = useMemo(() => buildMetaAdsCompareRows(atores, anunciosDaPagina), [atores, anunciosDaPagina])
  const ranking = useMemo(
    () => rankPor(linhas, (l) => l.actor.slug, (l) => l.adCount * 1e6 + l.activeCount),
    [linhas],
  )

  const paginas = useMemo(() => {
    const cont = new Map<string, number>()
    for (const l of buildMetaAdsCompareRows(atores, anuncios)) {
      if (candidato && l.actor.slug !== candidato) continue
      for (const a of l.ads) cont.set(a.page_name ?? '—', (cont.get(a.page_name ?? '—') ?? 0) + 1)
    }
    return [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [atores, anuncios, candidato])

  const termo = normalizar(busca.trim())
  const filtradas = linhas.filter(
    (l) =>
      (!candidato || l.actor.slug === candidato) &&
      (!termo ||
        normalizar(l.actor.name).includes(termo) ||
        l.ads.some((a) => normalizar(a.page_name).includes(termo) || normalizar(a.ad_body).includes(termo))),
  )
  const visiveis = ordenarLinhas<MetaAdsCompareActorRow, Coluna>(
    filtradas,
    (l, c) =>
      c === 'nome'
        ? l.actor.name
        : c === 'ativos'
          ? l.activeCount
          : c === 'gasto'
            ? l.spendMaxBrl
            : c === 'paginas'
              ? (l.topPages[0]?.page_name ?? '')
              : l.adCount,
    ordem,
    asc,
  )

  const totais = buildMetaAdsPeriodTotals(filtradas.flatMap((l) => l.ads))
  const totalAtivos = filtradas.reduce((s, l) => s + l.activeCount, 0)
  const todos = linhas.reduce((s, l) => s + l.adCount, 0)
  const foco = linhas.find((l) => l.actor.slug === candidato) ?? linhas.find((l) => l.actor.actor_type === 'own_candidate')
  const pctFoco = todos > 0 && foco ? (foco.adCount / todos) * 100 : 0
  const maxAnuncios = Math.max(1, ...linhas.map((l) => l.adCount))
  const nomeCandidato = linhas.find((l) => l.actor.slug === candidato)?.actor.name
  const temFiltros = Boolean(termo || pagina)
  const todosAbertos = visiveis.length > 0 && visiveis.every((l) => abertas.has(l.actor.slug))

  const runnerDisponivel = status?.runnerAvailable !== false
  const limiteDiario = status?.dailyLimitEnabled ?? true
  const podeColetar = status?.canCollect ?? true
  const emColeta = coletando || Boolean(status?.collectInProgress)
  const coletaBloqueada = setupRequired || !runnerDisponivel || (limiteDiario && !podeColetar && !coletando)

  const colunas: RadarColuna<MetaAdsCompareActorRow, Coluna>[] = [
    {
      id: 'nome',
      rotulo: 'Candidato',
      celula: (l) => <RadarCandidatoNome nome={l.actor.name} tipo={l.actor.actor_type} />,
    },
    {
      id: 'anuncios',
      rotulo: 'Anúncios',
      alinhar: 'right',
      celula: (l) => <TseBarraValor valor={l.adCount} max={maxAnuncios} formatado={fmtInt(l.adCount)} />,
    },
    {
      id: 'ativos',
      rotulo: 'Ativos',
      alinhar: 'right',
      className: 'hidden sm:table-cell',
      celula: (l) => <span className="font-bold tabular-nums">{fmtInt(l.activeCount)}</span>,
    },
    {
      id: 'gasto',
      rotulo: 'Gasto est.',
      alinhar: 'right',
      className: 'hidden md:table-cell',
      celula: (l) => <span className="whitespace-nowrap text-[12px] tabular-nums">{l.spendLabel}</span>,
    },
    {
      id: 'paginas',
      rotulo: 'Principais páginas',
      className: 'hidden max-w-[300px] xl:table-cell',
      celula: (l) => <RadarTopItens itens={l.topPages.map((p) => ({ nome: p.page_name, qtd: p.count }))} />,
    },
  ]

  if (carregando && anuncios.length === 0) return <TseCarregando texto="Carregando anúncios da Meta…" />

  return (
    <RadarLayout
      aside={
        <>
          <RadarDadosGerais fonte={`Biblioteca de Anúncios da Meta · últimos ${dias} dias`}>
            <TseDados>
              <TseDado rotulo="Anúncios" valor={fmtInt(totais.adCount)} />
              <TseDado rotulo="Ativos agora" valor={fmtInt(totalAtivos)} />
              <TseDado rotulo="Investimento" valor={totais.spendLabel} />
              {totais.impressionsLabel ? <TseDado rotulo="Impressões" valor={totais.impressionsLabel} /> : null}
            </TseDados>
            {foco ? (
              <>
                <TseBarraRotulo pct={pctFoco} rotulo={`${pctFoco.toFixed(1).replace('.', ',')}%`} />
                <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Fatia dos anúncios de {foco.actor.name}</p>
              </>
            ) : null}
          </RadarDadosGerais>
          <RadarListaCandidatos
            itens={linhas.map((l) => ({ slug: l.actor.slug, nome: l.actor.name, tipo: l.actor.actor_type, valor: l.adCount }))}
            candidato={candidato}
            onCandidatoChange={onCandidatoChange}
          />
          {paginas.length > 0 ? (
            <TseListaFiltro
              titulo="Páginas patrocinadoras"
              itens={paginas.map(([nome, qtd]) => ({ id: nome, label: nome, valor: qtd, cor: 'var(--tse-zero)' }))}
              ativo={pagina}
              onChange={setPagina}
            />
          ) : null}
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className={tseControleClass}
            aria-label="Período"
          >
            {PERIODOS.map((d) => (
              <option key={d} value={d}>
                Últimos {d} dias
              </option>
            ))}
          </select>
          {pagina ? <RadarChip onRemover={() => setPagina(null)}>Página: {pagina}</RadarChip> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TseBusca value={busca} onChange={setBusca} placeholder="Buscar candidato, página ou texto" className="w-64" />
          <RadarColetar
            onClick={() => void coletar()}
            ocupado={emColeta}
            disabled={coletaBloqueada}
            title={
              limiteDiario && !podeColetar && status?.nextCollectAt
                ? `Próxima coleta: ${fmtDataHora(status.nextCollectAt)}`
                : undefined
            }
          />
        </div>
      </div>

      {setupRequired ? (
        <RadarAviso titulo="Tabelas do radar ausentes">
          Execute <RadarCodigo>database/create-meta-ads-radar-tables.sql</RadarCodigo> no Supabase. Se a tabela já
          existia, rode também <RadarCodigo>database/alter-meta-ads-mentions-spend.sql</RadarCodigo> (gasto e impressões)
          e, opcionalmente, <RadarCodigo>database/alter-meta-ads-collect-log-progress.sql</RadarCodigo> (progresso).
        </RadarAviso>
      ) : null}
      {!runnerDisponivel ? (
        <RadarAviso titulo="Coleta indisponível neste servidor">
          {status?.runnerMessage || 'O coletor da Biblioteca de Anúncios não está disponível.'}
        </RadarAviso>
      ) : null}
      {runnerDisponivel && limiteDiario && status && !podeColetar && status.nextCollectAt && !emColeta ? (
        <RadarAviso titulo="Limite de 1 coleta a cada 24 horas">
          Próxima coleta disponível em {fmtDataHora(status.nextCollectAt)}
          {status.hoursUntilNextCollect !== null && status.hoursUntilNextCollect > 0
            ? ` (≈ ${status.hoursUntilNextCollect}h)`
            : ''}
          .
        </RadarAviso>
      ) : null}
      {emColeta ? (
        <RadarProgresso
          titulo={progress?.message ?? 'Coleta Meta Ads em andamento…'}
          percent={progress?.percent ?? 8}
          detalhe={[
            `Etapa: ${progress ? metaAdsCollectPhaseLabel(progress.phase) : 'Iniciando'}`,
            progress?.actorName && progress.actorTotal
              ? `Candidato ${progress.actorIndex ?? '?'}/${progress.actorTotal}: ${progress.actorName}`
              : null,
            progress?.adsFound != null ? `${progress.adsFound} anúncio(s) na listagem` : null,
            formatMetaAdsCollectElapsed(progress?.startedAt)
              ? `${formatMetaAdsCollectElapsed(progress?.startedAt)} decorridos`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          rodape="Consulta automatizada da biblioteca. Costuma levar 1–3 minutos por candidato monitorado."
        />
      ) : null}
      {instavel && !erro ? <RadarAviso carregando>Conexão com o Supabase instável. Tentando novamente…</RadarAviso> : null}
      {mensagem ? <RadarAviso tom="ok" titulo="Coleta concluída">{mensagem}</RadarAviso> : null}
      {avisos.length > 0 ? (
        <RadarAviso titulo="Avisos da coleta">
          <ul className="list-disc pl-4">
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </RadarAviso>
      ) : null}
      {erro ? (
        <div className="mt-4">
          <TseErro>{erro}</TseErro>
        </div>
      ) : null}

      <RadarResumo
        titulo="Anúncios"
        escopo={nomeCandidato ?? 'Todos os candidatos'}
        descricao={`Anúncios políticos · gasto, impressões e páginas · últimos ${dias} dias`}
        numeros={[
          { rotulo: 'anúncios', valor: fmtInt(totais.adCount) },
          { rotulo: 'ativos', valor: fmtInt(totalAtivos) },
          { rotulo: 'investimento', valor: <span className="text-xl">{totais.spendLabel}</span> },
        ]}
      />

      <RadarLinhaContagem
        acoes={
          <>
            {temFiltros ? (
              <button
                type="button"
                onClick={() => {
                  setBusca('')
                  setPagina(null)
                }}
                className={tseLinkAcaoClass}
              >
                Limpar filtros
              </button>
            ) : null}
            {visiveis.length > 0 ? (
              <button
                type="button"
                onClick={() => setAbertas(todosAbertos ? new Set() : new Set(visiveis.map((l) => l.actor.slug)))}
                className={tseLinkAcaoClass}
              >
                {todosAbertos ? 'Recolher todos' : 'Expandir todos'}
              </button>
            ) : null}
          </>
        }
      >
        {plural(visiveis.length, 'candidato', 'candidatos')}
        {temFiltros ? ' com os filtros aplicados' : ''} · clique na linha para ver os anúncios
      </RadarLinhaContagem>

      <div className="mt-3">
        {visiveis.length === 0 ? (
          <TseVazio>
            {linhas.length === 0
              ? 'Nenhum candidato ativo. Cadastre candidatos em “Candidatos” e rode a coleta.'
              : 'Nenhum candidato encontrado para os filtros selecionados.'}
          </TseVazio>
        ) : (
          <RadarTabela
            linhas={visiveis}
            chave={(l) => l.actor.slug}
            rank={(l) => ranking.get(l.actor.slug) ?? 0}
            colunas={colunas}
            ordem={ordem}
            asc={asc}
            onOrdenar={ordenar}
            abertas={abertas}
            onAlternar={alternar}
            detalhe={(l) => (
              <RadarSubLista vazio="Nenhum anúncio nesta janela. Rode a coleta na Biblioteca de Anúncios da Meta.">
                {l.ads.length > 0
                  ? l.ads.map((a) => (
                      <RadarSubItem
                        key={a.id}
                        titulo={
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {a.page_name ?? 'Página desconhecida'}
                            {a.is_active === true ? <TseStatus cor="var(--tse-green)">Ativo</TseStatus> : null}
                            {a.is_active === false ? <TseStatus cor="var(--tse-zero)">Inativo</TseStatus> : null}
                          </span>
                        }
                        href={a.library_url}
                        extra={
                          a.ad_body ? (
                            <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--tse-muted)]">{a.ad_body}</p>
                          ) : null
                        }
                        meta={[
                          `${fmtData(a.started_running_at)}${a.ended_running_at ? ` → ${fmtData(a.ended_running_at)}` : ''}`,
                          `Gasto: ${formatSpendBrl(a.spend_min_brl, a.spend_max_brl, a.spend_text)}`,
                          a.impressions_text ? `Imp.: ${a.impressions_text}` : null,
                          a.payer_name ? `Pago por ${a.payer_name}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      />
                    ))
                  : null}
              </RadarSubLista>
            )}
          />
        )}
      </div>
    </RadarLayout>
  )
}
