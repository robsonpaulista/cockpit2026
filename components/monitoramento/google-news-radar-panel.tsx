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
  TseVazio,
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
  RadarResumo,
  RadarSubItem,
  RadarSubLista,
  RadarTabela,
  RadarTopItens,
  fmtData,
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
import { buildGoogleNewsCompareRows, type GoogleNewsCompareActorRow } from '@/lib/google-news-aggregate'
import { labelGoogleNewsCollectChannel, labelGoogleNewsPlatform } from '@/lib/google-news-platform'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import {
  coletarNoticias,
  fetchNoticiasBuscaWebAtiva,
  fetchNoticiasMencoes,
} from '@/lib/services/radar-eleitoral-client'

const DIAS = 30
const MAX_DETALHE = 30
type Coluna = 'nome' | 'noticias' | 'fontes'
const COLUNAS_TEXTO: readonly Coluna[] = ['nome', 'fontes']

function ehNoticia(m: GoogleNewsMentionWithActor): boolean {
  const canal = m.collect_channel ?? 'google_news_rss'
  return canal === 'google_news_rss' || canal === 'google_web'
}

export function GoogleNewsRadarPanel({ atores, candidato, onCandidatoChange }: RadarAbaProps) {
  const [mencoes, setMencoes] = useState<GoogleNewsMentionWithActor[]>([])
  const [setupRequired, setSetupRequired] = useState<boolean>(false)
  const [buscaWebAtiva, setBuscaWebAtiva] = useState<boolean | null>(null)
  const [carregando, setCarregando] = useState<boolean>(true)
  const [coletando, setColetando] = useState<boolean>(false)
  const [instavel, setInstavel] = useState<boolean>(false)
  const [erro, setErro] = useState<string>('')
  const [mensagem, setMensagem] = useState<string>('')
  const [busca, setBusca] = useState<string>('')
  const [fonte, setFonte] = useState<string | null>(null)
  const { ordem, asc, ordenar } = useOrdenacao<Coluna>('noticias', COLUNAS_TEXTO)
  const { abertas, alternar, setAbertas } = useLinhasAbertas(candidato)

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const r = await fetchNoticiasMencoes(DIAS)
      if (!r.instavel) setMencoes(r.dados.filter(ehNoticia))
      setSetupRequired(r.setupRequired)
      setInstavel(r.instavel)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar notícias.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
    void fetchNoticiasBuscaWebAtiva().then(setBuscaWebAtiva)
    void coletarNoticias()
      .then(() => carregar())
      .catch(() => undefined)
  }, [carregar])

  useEffect(() => {
    if (!instavel) return
    const id = window.setTimeout(() => void carregar(), 5000)
    return () => window.clearTimeout(id)
  }, [instavel, carregar])

  const coletar = async () => {
    setColetando(true)
    setMensagem('')
    setErro('')
    try {
      setMensagem(await coletarNoticias())
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setColetando(false)
    }
  }

  const mencoesDaFonte = useMemo(
    () => (fonte ? mencoes.filter((m) => (m.source_name ?? '—') === fonte) : mencoes),
    [mencoes, fonte],
  )
  const linhas = useMemo(() => buildGoogleNewsCompareRows(atores, mencoesDaFonte), [atores, mencoesDaFonte])
  const ranking = useMemo(() => rankPor(linhas, (l) => l.actor.slug, (l) => l.articleCount), [linhas])

  const fontes = useMemo(() => {
    const cont = new Map<string, number>()
    for (const l of buildGoogleNewsCompareRows(atores, mencoes)) {
      if (candidato && l.actor.slug !== candidato) continue
      for (const m of l.mentions) cont.set(m.source_name ?? '—', (cont.get(m.source_name ?? '—') ?? 0) + 1)
    }
    return [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [atores, mencoes, candidato])

  const termo = normalizar(busca.trim())
  const filtradas = linhas.filter(
    (l) =>
      (!candidato || l.actor.slug === candidato) &&
      (!termo ||
        normalizar(l.actor.name).includes(termo) ||
        l.mentions.some((m) => normalizar(m.title).includes(termo) || normalizar(m.source_name).includes(termo))),
  )
  const visiveis = ordenarLinhas<GoogleNewsCompareActorRow, Coluna>(
    filtradas,
    (l, c) => (c === 'nome' ? l.actor.name : c === 'fontes' ? (l.topSources[0]?.source_name ?? '') : l.articleCount),
    ordem,
    asc,
  )

  const totalNoticias = filtradas.reduce((s, l) => s + l.articleCount, 0)
  const fontesDistintas = new Set(filtradas.flatMap((l) => l.mentions.map((m) => m.source_name ?? '—'))).size
  const citados = filtradas.filter((l) => l.articleCount > 0).length
  const todas = linhas.reduce((s, l) => s + l.articleCount, 0)
  const foco = linhas.find((l) => l.actor.slug === candidato) ?? linhas.find((l) => l.actor.actor_type === 'own_candidate')
  const pctFoco = todas > 0 && foco ? (foco.articleCount / todas) * 100 : 0
  const maxNoticias = Math.max(1, ...linhas.map((l) => l.articleCount))
  const nomeCandidato = linhas.find((l) => l.actor.slug === candidato)?.actor.name
  const temFiltros = Boolean(termo || fonte)
  const todosAbertos = visiveis.length > 0 && visiveis.every((l) => abertas.has(l.actor.slug))

  const colunas: RadarColuna<GoogleNewsCompareActorRow, Coluna>[] = [
    {
      id: 'nome',
      rotulo: 'Candidato',
      celula: (l) => <RadarCandidatoNome nome={l.actor.name} tipo={l.actor.actor_type} />,
    },
    {
      id: 'noticias',
      rotulo: 'Notícias',
      alinhar: 'right',
      celula: (l) => <TseBarraValor valor={l.articleCount} max={maxNoticias} formatado={fmtInt(l.articleCount)} />,
    },
    {
      id: 'fontes',
      rotulo: 'Principais fontes',
      className: 'hidden max-w-[360px] md:table-cell',
      celula: (l) => <RadarTopItens itens={l.topSources.map((s) => ({ nome: s.source_name, qtd: s.count }))} />,
    },
  ]

  if (carregando && mencoes.length === 0) return <TseCarregando texto="Carregando notícias…" />

  return (
    <RadarLayout
      aside={
        <>
          <RadarDadosGerais fonte={`Google Notícias + busca web · últimos ${DIAS} dias`}>
            <TseDados>
              <TseDado rotulo="Notícias" valor={fmtInt(totalNoticias)} />
              <TseDado rotulo="Fontes distintas" valor={fmtInt(fontesDistintas)} />
              <TseDado rotulo="Candidatos citados" valor={fmtInt(citados)} sufixo={`/ ${fmtInt(filtradas.length)}`} />
            </TseDados>
            {foco ? (
              <>
                <TseBarraRotulo pct={pctFoco} rotulo={`${pctFoco.toFixed(1).replace('.', ',')}%`} />
                <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Fatia das notícias que citam {foco.actor.name}</p>
              </>
            ) : null}
          </RadarDadosGerais>
          <RadarListaCandidatos
            itens={linhas.map((l) => ({ slug: l.actor.slug, nome: l.actor.name, tipo: l.actor.actor_type, valor: l.articleCount }))}
            candidato={candidato}
            onCandidatoChange={onCandidatoChange}
          />
          {fontes.length > 0 ? (
            <TseListaFiltro
              titulo="Principais fontes"
              itens={fontes.map(([nome, qtd]) => ({ id: nome, label: nome, valor: qtd, cor: 'var(--tse-zero)' }))}
              ativo={fonte}
              onChange={setFonte}
            />
          ) : null}
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-[var(--tse-muted)]">Janela: últimos {DIAS} dias · Google Notícias</span>
          {fonte ? <RadarChip onRemover={() => setFonte(null)}>Fonte: {fonte}</RadarChip> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TseBusca value={busca} onChange={setBusca} placeholder="Buscar candidato, manchete ou fonte" className="w-64" />
          <RadarColetar onClick={() => void coletar()} ocupado={coletando} disabled={setupRequired} />
        </div>
      </div>

      {setupRequired ? (
        <RadarAviso titulo="Tabelas do radar ausentes">
          Execute <RadarCodigo>database/create-google-news-radar-tables.sql</RadarCodigo> no Supabase antes da primeira
          coleta.
        </RadarAviso>
      ) : null}
      {buscaWebAtiva === false ? (
        <RadarAviso titulo="Busca web desativada">
          A coleta usa só o Google Notícias. Para incluir Google.com e Instagram indexado, configure{' '}
          <RadarCodigo>GOOGLE_CSE_API_KEY</RadarCodigo> e <RadarCodigo>GOOGLE_CSE_ID</RadarCodigo>.
        </RadarAviso>
      ) : null}
      {instavel && !erro ? <RadarAviso carregando>Conexão com o Supabase instável. Tentando novamente…</RadarAviso> : null}
      {mensagem ? <RadarAviso tom="ok" titulo="Coleta concluída">{mensagem}</RadarAviso> : null}
      {erro ? (
        <div className="mt-4">
          <TseErro>{erro}</TseErro>
        </div>
      ) : null}

      <RadarResumo
        titulo="Notícias"
        escopo={nomeCandidato ?? 'Todos os candidatos'}
        descricao={`Menções no Google Notícias e na busca web · últimos ${DIAS} dias`}
        numeros={[
          { rotulo: 'notícias', valor: fmtInt(totalNoticias) },
          { rotulo: 'fontes', valor: fmtInt(fontesDistintas) },
          { rotulo: 'citados', valor: fmtInt(citados) },
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
                  setFonte(null)
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
        {temFiltros ? ' com os filtros aplicados' : ''} · clique na linha para ver as matérias
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
              <RadarSubLista vazio="Nenhuma menção nesta janela. Rode a coleta para buscar no Google Notícias e na web.">
                {l.mentions.length > 0
                  ? l.mentions.slice(0, MAX_DETALHE).map((m) => (
                      <RadarSubItem
                        key={m.id}
                        titulo={m.title}
                        href={m.url}
                        meta={[
                          labelGoogleNewsPlatform(m.platform ?? 'website'),
                          m.source_name ?? '—',
                          labelGoogleNewsCollectChannel(m.collect_channel ?? 'google_news_rss'),
                          fmtData(m.published_at ?? m.collected_at),
                        ].join(' · ')}
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
