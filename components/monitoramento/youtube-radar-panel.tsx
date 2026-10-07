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
import { coletarYoutube, fetchYoutubeMencoes } from '@/lib/services/radar-eleitoral-client'
import { buildYoutubeCompareRows, type YoutubeCompareActorRow } from '@/lib/youtube-radar-aggregate'
import type { YoutubeMentionWithActor } from '@/lib/youtube-radar-types'

const DIAS = 30
const MAX_VIDEOS_DETALHE = 30
type Coluna = 'nome' | 'videos' | 'views' | 'canais'
const COLUNAS_TEXTO: readonly Coluna[] = ['nome', 'canais']

export function YoutubeRadarPanel({
  atores,
  candidato,
  onCandidatoChange,
  youtubeConfigurado,
}: RadarAbaProps & { youtubeConfigurado: boolean | null }) {
  const [mencoes, setMencoes] = useState<YoutubeMentionWithActor[]>([])
  const [setupRequired, setSetupRequired] = useState<boolean>(false)
  const [carregando, setCarregando] = useState<boolean>(true)
  const [coletando, setColetando] = useState<boolean>(false)
  const [instavel, setInstavel] = useState<boolean>(false)
  const [erro, setErro] = useState<string>('')
  const [mensagem, setMensagem] = useState<string>('')
  const [busca, setBusca] = useState<string>('')
  const [canal, setCanal] = useState<string | null>(null)
  const { ordem, asc, ordenar } = useOrdenacao<Coluna>('videos', COLUNAS_TEXTO)
  const { abertas, alternar, setAbertas } = useLinhasAbertas(candidato)

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const r = await fetchYoutubeMencoes(DIAS)
      if (!r.instavel) setMencoes(r.dados)
      setSetupRequired(r.setupRequired)
      setInstavel(r.instavel)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar vídeos.')
    } finally {
      setCarregando(false)
    }
  }, [])

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
    setErro('')
    try {
      setMensagem(await coletarYoutube(DIAS))
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setColetando(false)
    }
  }

  const mencoesDoCanal = useMemo(
    () => (canal ? mencoes.filter((m) => (m.channel_title ?? '—') === canal) : mencoes),
    [mencoes, canal],
  )
  const linhas = useMemo(() => buildYoutubeCompareRows(atores, mencoesDoCanal), [atores, mencoesDoCanal])
  const ranking = useMemo(() => rankPor(linhas, (l) => l.actor.slug, (l) => l.videoCount * 1e12 + l.totalViews), [linhas])

  const canais = useMemo(() => {
    const cont = new Map<string, number>()
    for (const l of buildYoutubeCompareRows(atores, mencoes)) {
      if (candidato && l.actor.slug !== candidato) continue
      for (const m of l.mentions) cont.set(m.channel_title ?? '—', (cont.get(m.channel_title ?? '—') ?? 0) + 1)
    }
    return [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [atores, mencoes, candidato])

  const termo = normalizar(busca.trim())
  const filtradas = linhas.filter(
    (l) =>
      (!candidato || l.actor.slug === candidato) &&
      (!termo ||
        normalizar(l.actor.name).includes(termo) ||
        l.mentions.some((m) => normalizar(m.video_title).includes(termo) || normalizar(m.channel_title).includes(termo))),
  )
  const visiveis = ordenarLinhas<YoutubeCompareActorRow, Coluna>(
    filtradas,
    (l, c) =>
      c === 'nome'
        ? l.actor.name
        : c === 'views'
          ? l.totalViews
          : c === 'canais'
            ? (l.topChannels[0]?.channel_title ?? '')
            : l.videoCount,
    ordem,
    asc,
  )

  const totalVideos = filtradas.reduce((s, l) => s + l.videoCount, 0)
  const totalViews = filtradas.reduce((s, l) => s + l.totalViews, 0)
  const canaisDistintos = new Set(filtradas.flatMap((l) => l.mentions.map((m) => m.channel_title ?? '—'))).size
  const todosVideos = linhas.reduce((s, l) => s + l.videoCount, 0)
  const foco = linhas.find((l) => l.actor.slug === candidato) ?? linhas.find((l) => l.actor.actor_type === 'own_candidate')
  const pctFoco = todosVideos > 0 && foco ? (foco.videoCount / todosVideos) * 100 : 0
  const maxVideos = Math.max(1, ...linhas.map((l) => l.videoCount))
  const maxViews = Math.max(1, ...linhas.map((l) => l.totalViews))
  const nomeCandidato = linhas.find((l) => l.actor.slug === candidato)?.actor.name
  const temFiltros = Boolean(termo || canal)
  const todosAbertos = visiveis.length > 0 && visiveis.every((l) => abertas.has(l.actor.slug))

  const colunas: RadarColuna<YoutubeCompareActorRow, Coluna>[] = [
    {
      id: 'nome',
      rotulo: 'Candidato',
      celula: (l) => <RadarCandidatoNome nome={l.actor.name} tipo={l.actor.actor_type} />,
    },
    {
      id: 'videos',
      rotulo: 'Vídeos',
      alinhar: 'right',
      celula: (l) => <TseBarraValor valor={l.videoCount} max={maxVideos} formatado={fmtInt(l.videoCount)} />,
    },
    {
      id: 'views',
      rotulo: 'Visualizações',
      alinhar: 'right',
      className: 'hidden sm:table-cell',
      celula: (l) => (
        <TseBarraValor valor={l.totalViews} max={maxViews} formatado={fmtInt(l.totalViews)} larguraNumero="w-24" cor="amarelo" />
      ),
    },
    {
      id: 'canais',
      rotulo: 'Principais canais',
      className: 'hidden max-w-[320px] xl:table-cell',
      celula: (l) => <RadarTopItens itens={l.topChannels.map((c) => ({ nome: c.channel_title, qtd: c.count }))} />,
    },
  ]

  if (carregando && mencoes.length === 0) return <TseCarregando texto="Carregando vídeos do YouTube…" />

  return (
    <RadarLayout
      aside={
        <>
          <RadarDadosGerais fonte={`YouTube Data API · últimos ${DIAS} dias`}>
            <TseDados>
              <TseDado rotulo="Vídeos" valor={fmtInt(totalVideos)} />
              <TseDado rotulo="Visualizações" valor={fmtInt(totalViews)} />
              <TseDado rotulo="Canais distintos" valor={fmtInt(canaisDistintos)} />
            </TseDados>
            {foco ? (
              <>
                <TseBarraRotulo pct={pctFoco} rotulo={`${pctFoco.toFixed(1).replace('.', ',')}%`} />
                <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Fatia dos vídeos que citam {foco.actor.name}</p>
              </>
            ) : null}
          </RadarDadosGerais>
          <RadarListaCandidatos
            itens={linhas.map((l) => ({ slug: l.actor.slug, nome: l.actor.name, tipo: l.actor.actor_type, valor: l.videoCount }))}
            candidato={candidato}
            onCandidatoChange={onCandidatoChange}
          />
          {canais.length > 0 ? (
            <TseListaFiltro
              titulo="Principais canais"
              itens={canais.map(([nome, qtd]) => ({ id: nome, label: nome, valor: qtd, cor: 'var(--tse-zero)' }))}
              ativo={canal}
              onChange={setCanal}
            />
          ) : null}
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-[var(--tse-muted)]">Janela: últimos {DIAS} dias</span>
          {canal ? <RadarChip onRemover={() => setCanal(null)}>Canal: {canal}</RadarChip> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TseBusca value={busca} onChange={setBusca} placeholder="Buscar candidato, vídeo ou canal" className="w-64" />
          <RadarColetar
            onClick={() => void coletar()}
            ocupado={coletando}
            disabled={youtubeConfigurado === false || setupRequired}
          />
        </div>
      </div>

      {setupRequired ? (
        <RadarAviso titulo="Tabelas do radar ausentes">
          Execute <RadarCodigo>database/create-youtube-radar-tables.sql</RadarCodigo> no Supabase antes da primeira coleta.
        </RadarAviso>
      ) : null}
      {youtubeConfigurado === false ? (
        <RadarAviso titulo="YouTube não configurado">
          Configure <RadarCodigo>YOUTUBE_DATA_API_KEY</RadarCodigo> no ambiente e reinicie o servidor.
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
        titulo="YouTube"
        escopo={nomeCandidato ?? 'Todos os candidatos'}
        descricao={`Menções em vídeos públicos · últimos ${DIAS} dias`}
        numeros={[
          { rotulo: 'vídeos', valor: fmtInt(totalVideos) },
          { rotulo: 'visualizações', valor: fmtInt(totalViews) },
          { rotulo: 'canais', valor: fmtInt(canaisDistintos) },
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
                  setCanal(null)
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
        {temFiltros ? ' com os filtros aplicados' : ''} · clique na linha para ver os vídeos
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
              <RadarSubLista vazio="Nenhum vídeo nesta janela. Rode a coleta para buscar no YouTube.">
                {l.mentions.length > 0
                  ? l.mentions.slice(0, MAX_VIDEOS_DETALHE).map((m) => (
                      <RadarSubItem
                        key={m.id}
                        titulo={m.video_title}
                        href={m.url}
                        meta={`${m.channel_title ?? '—'} · ${fmtData(m.published_at)} · termo “${m.search_term}”`}
                        valor={`${fmtInt(m.views)} views`}
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
