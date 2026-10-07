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
  TseVazio,
  tseControleClass,
  tseLinkAcaoClass,
} from '@/components/tse/tse-ui'
import {
  RadarAviso,
  RadarCandidatoNome,
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
import { buildInstagramRadarCompareRows, type InstagramRadarCompareActorRow } from '@/lib/instagram-radar-aggregate'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import { loadInstagramConfigAsync } from '@/lib/instagramApi'
import {
  coletarInstagramRadar,
  fetchInstagramRadar,
  fetchInstagramRadarStatus,
  type InstagramRadarStatus,
} from '@/lib/services/radar-eleitoral-client'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

const PERIODOS = [30, 60, 90] as const
const MAX_POSTS_DETALHE = 12
type Coluna = 'nome' | 'posts' | 'semana' | 'engajamento' | 'reels'
const COLUNAS_TEXTO: readonly Coluna[] = ['nome']

const fmtDec = (n: number): string => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Avatar({ nome, url }: { nome: string; url: string | null | undefined }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  }
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tse-yellow-soft)] text-[12px] font-black text-[var(--tse-gold-text)]"
      aria-hidden
    >
      {(nome.trim().charAt(0) || '?').toUpperCase()}
    </span>
  )
}

export function InstagramRadarPanel({ atores, candidato, onCandidatoChange }: RadarAbaProps) {
  const [dias, setDias] = useState<number>(30)
  const [atoresIg, setAtoresIg] = useState<PoliticalActorWithTerms[]>([])
  const [posts, setPosts] = useState<InstagramRadarPostWithActor[]>([])
  const [status, setStatus] = useState<InstagramRadarStatus | null>(null)
  const [setupRequired, setSetupRequired] = useState<boolean>(false)
  const [carregando, setCarregando] = useState<boolean>(true)
  const [coletando, setColetando] = useState<boolean>(false)
  const [erro, setErro] = useState<string>('')
  const [mensagem, setMensagem] = useState<string>('')
  const [avisos, setAvisos] = useState<string[]>([])
  const [busca, setBusca] = useState<string>('')
  const { ordem, asc, ordenar } = useOrdenacao<Coluna>('engajamento', COLUNAS_TEXTO)
  const { abertas, alternar, setAbertas } = useLinhasAbertas(candidato)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const r = await fetchInstagramRadar(dias)
      setSetupRequired(r.setupRequired)
      setAtoresIg(r.dados.atores)
      setPosts(r.dados.posts)
      if (r.dados.status) setStatus(r.dados.status)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar Instagram.')
    } finally {
      setCarregando(false)
    }
  }, [dias])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const coletar = async () => {
    setColetando(true)
    setMensagem('')
    setAvisos([])
    setErro('')
    try {
      const config = await loadInstagramConfigAsync()
      const r = await coletarInstagramRadar(config.businessAccountId || undefined)
      setMensagem(r.mensagem)
      setAvisos(r.avisos)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setColetando(false)
      const s = await fetchInstagramRadarStatus().catch(() => null)
      if (s) setStatus(s)
    }
  }

  /** O bootstrap traz o @ do candidato próprio (API Graph); o cadastro global traz as edições recentes. */
  const atoresMesclados = useMemo(() => {
    if (atores.length === 0) return atoresIg
    const doIg = new Map(atoresIg.map((a) => [a.id, a]))
    return atores.map((a) => {
      const ig = doIg.get(a.id)
      return ig
        ? {
            ...a,
            instagram_username: a.instagram_username ?? ig.instagram_username,
            instagram_avatar_url: a.instagram_avatar_url ?? ig.instagram_avatar_url,
          }
        : a
    })
  }, [atores, atoresIg])

  const linhas = useMemo(
    () => buildInstagramRadarCompareRows(atoresMesclados, posts, dias),
    [atoresMesclados, posts, dias],
  )
  const ranking = useMemo(() => rankPor(linhas, (l) => l.actor.slug, (l) => l.avgEngagement), [linhas])

  const termo = normalizar(busca.trim())
  const filtradas = linhas.filter(
    (l) =>
      (!candidato || l.actor.slug === candidato) &&
      (!termo ||
        normalizar(l.actor.name).includes(termo) ||
        normalizar(l.instagramUsername).includes(termo) ||
        l.posts.some((p) => normalizar(p.caption).includes(termo))),
  )
  const comIg = filtradas.filter((l) => l.instagramUsername)
  const semIg = filtradas.filter((l) => !l.instagramUsername)
  const visiveis = ordenarLinhas<InstagramRadarCompareActorRow, Coluna>(
    comIg,
    (l, c) =>
      c === 'nome'
        ? l.actor.name
        : c === 'posts'
          ? l.postCount
          : c === 'semana'
            ? l.postsPerWeek
            : c === 'reels'
              ? l.reelCount
              : l.avgEngagement,
    ordem,
    asc,
  )

  const totalPosts = comIg.reduce((s, l) => s + l.postCount, 0)
  const engajamentoTotal = comIg.reduce((s, l) => s + l.avgEngagement * l.postCount, 0)
  const engMedio = totalPosts > 0 ? engajamentoTotal / totalPosts : 0
  const todosPosts = linhas.reduce((s, l) => s + l.postCount, 0)
  const foco = linhas.find((l) => l.actor.slug === candidato) ?? linhas.find((l) => l.actor.actor_type === 'own_candidate')
  const pctFoco = todosPosts > 0 && foco ? (foco.postCount / todosPosts) * 100 : 0
  const maxPosts = Math.max(1, ...linhas.map((l) => l.postCount))
  const maxEng = Math.max(1, ...linhas.map((l) => l.avgEngagement))
  const nomeCandidato = linhas.find((l) => l.actor.slug === candidato)?.actor.name
  const todosAbertos = visiveis.length > 0 && visiveis.every((l) => abertas.has(l.actor.slug))

  const cooldown = status?.cooldownEnabled ?? true
  const podeColetar = status?.canCollect ?? false
  const fonteConfigurada = Boolean(status?.apifyConfigured || status?.ownAccountConfigured)
  const coletaBloqueada = setupRequired || !fonteConfigurada || (cooldown && !podeColetar)

  const colunas: RadarColuna<InstagramRadarCompareActorRow, Coluna>[] = [
    {
      id: 'nome',
      rotulo: 'Candidato',
      celula: (l) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar nome={l.actor.name} url={l.actor.instagram_avatar_url} />
          <RadarCandidatoNome
            nome={l.actor.name}
            tipo={l.actor.actor_type}
            extra={<span>@{l.instagramUsername}</span>}
          />
        </div>
      ),
    },
    {
      id: 'posts',
      rotulo: 'Posts',
      alinhar: 'right',
      celula: (l) => <TseBarraValor valor={l.postCount} max={maxPosts} formatado={fmtInt(l.postCount)} />,
    },
    {
      id: 'semana',
      rotulo: 'Por semana',
      alinhar: 'right',
      className: 'hidden md:table-cell',
      celula: (l) => <span className="font-bold tabular-nums">{fmtDec(l.postsPerWeek)}</span>,
    },
    {
      id: 'engajamento',
      rotulo: 'Eng. médio',
      alinhar: 'right',
      className: 'hidden sm:table-cell',
      celula: (l) => (
        <TseBarraValor valor={l.avgEngagement} max={maxEng} formatado={fmtInt(Math.round(l.avgEngagement))} larguraNumero="w-20" cor="amarelo" />
      ),
    },
    {
      id: 'reels',
      rotulo: 'Reels',
      alinhar: 'right',
      className: 'hidden lg:table-cell',
      celula: (l) => <span className="font-bold tabular-nums">{fmtInt(l.reelCount)}</span>,
    },
  ]

  if (carregando && posts.length === 0 && atoresIg.length === 0) return <TseCarregando texto="Carregando posts do Instagram…" />

  return (
    <RadarLayout
      aside={
        <>
          <RadarDadosGerais fonte={`Instagram dos candidatos · últimos ${dias} dias`}>
            <TseDados>
              <TseDado rotulo="Posts" valor={fmtInt(totalPosts)} />
              <TseDado rotulo="Engajamento médio" valor={fmtInt(Math.round(engMedio))} sufixo="por post" />
              <TseDado rotulo="Perfis com @" valor={fmtInt(comIg.length)} sufixo={`/ ${fmtInt(filtradas.length)}`} />
            </TseDados>
            {foco ? (
              <>
                <TseBarraRotulo pct={pctFoco} rotulo={`${pctFoco.toFixed(1).replace('.', ',')}%`} />
                <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Fatia dos posts publicados por {foco.actor.name}</p>
              </>
            ) : null}
          </RadarDadosGerais>
          <RadarListaCandidatos
            titulo="Candidatos · eng. médio"
            itens={linhas
              .filter((l) => l.instagramUsername)
              .map((l) => ({
                slug: l.actor.slug,
                nome: l.actor.name,
                tipo: l.actor.actor_type,
                valor: Math.round(l.avgEngagement),
              }))}
            candidato={candidato}
            onCandidatoChange={onCandidatoChange}
          />
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex flex-wrap items-center gap-2">
          <TseBusca value={busca} onChange={setBusca} placeholder="Buscar candidato, @ ou legenda" className="w-64" />
          <RadarColetar
            onClick={() => void coletar()}
            ocupado={coletando}
            disabled={coletaBloqueada}
            title={
              cooldown && !podeColetar && status?.nextCollectAt
                ? `Próxima coleta: ${fmtDataHora(status.nextCollectAt)}`
                : undefined
            }
          />
        </div>
      </div>

      {setupRequired ? (
        <RadarAviso titulo="Tabelas do radar ausentes">
          Execute <RadarCodigo>database/create-instagram-radar-tables.sql</RadarCodigo> no Supabase e configure o
          candidato próprio em Instagram Pessoal.
        </RadarAviso>
      ) : null}
      {status && !fonteConfigurada && !setupRequired ? (
        <RadarAviso titulo="Coleta não configurada">
          Configure o Apify (concorrentes) ou a conta própria do Instagram para habilitar a coleta.
        </RadarAviso>
      ) : null}
      {cooldown && status && !podeColetar && status.nextCollectAt && !coletando ? (
        <RadarAviso titulo="Coleta em intervalo">
          Próxima coleta disponível em {fmtDataHora(status.nextCollectAt)}.
        </RadarAviso>
      ) : null}
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
        titulo="Instagram"
        escopo={nomeCandidato ?? 'Todos os candidatos'}
        descricao={`Conteúdo e engajamento relativo (não seguidores) · últimos ${dias} dias`}
        numeros={[
          { rotulo: 'posts', valor: fmtInt(totalPosts) },
          { rotulo: 'eng. médio', valor: fmtInt(Math.round(engMedio)) },
          { rotulo: 'perfis', valor: fmtInt(comIg.length) },
        ]}
      />

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
                onClick={() => setAbertas(todosAbertos ? new Set() : new Set(visiveis.map((l) => l.actor.slug)))}
                className={tseLinkAcaoClass}
              >
                {todosAbertos ? 'Recolher todos' : 'Expandir todos'}
              </button>
            ) : null}
          </>
        }
      >
        {plural(visiveis.length, 'perfil', 'perfis')}
        {termo ? ' com a busca aplicada' : ''} · clique na linha para ver os posts
      </RadarLinhaContagem>

      <div className="mt-3">
        {visiveis.length === 0 ? (
          <TseVazio>
            {linhas.length === 0
              ? 'Nenhum candidato ativo. Cadastre candidatos em “Candidatos”.'
              : 'Nenhum perfil encontrado. Cadastre o @ Instagram dos candidatos em “Candidatos”.'}
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
              <RadarSubLista vazio="Nenhum post nesta janela. Rode a coleta de posts.">
                {l.posts.length > 0
                  ? l.posts.slice(0, MAX_POSTS_DETALHE).map((p) => (
                      <RadarSubItem
                        key={p.id}
                        titulo={p.caption?.trim() || '(sem legenda)'}
                        href={p.post_url}
                        meta={`${fmtData(p.posted_at)}${p.post_type ? ` · ${p.post_type}` : ''} · ${fmtInt(
                          p.likes_count,
                        )} curtidas · ${fmtInt(p.comments_count)} comentários`}
                        valor={fmtInt(p.likes_count + p.comments_count)}
                      />
                    ))
                  : null}
              </RadarSubLista>
            )}
          />
        )}
        {semIg.length > 0 ? (
          <p className="mt-3 text-[12px] text-[var(--tse-muted)]">
            Sem @ Instagram cadastrado: {semIg.map((l) => l.actor.name).join(', ')}.
          </p>
        ) : null}
      </div>
    </RadarLayout>
  )
}
