'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, RefreshCw, Star, Tags, Trash2 } from 'lucide-react'
import { RadarClassificarModal } from '@/components/monitoramento/radar-classificar-modal'
import { RadarFeedsModal } from '@/components/monitoramento/radar-feeds-modal'
import {
  TseBarraRotulo,
  TseBusca,
  TseCarregando,
  TseCarregarMais,
  TseDado,
  TseDados,
  TseListaFiltro,
  TseStatus,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoPrimarioClass,
  tseCardClass,
  tseControleClass,
  tseLinkAcaoClass,
  tseTabela,
  type TseItemLista,
} from '@/components/tse/tse-ui'
import {
  RadarAviso,
  RadarDadosGerais,
  RadarLayout,
  RadarLinhaContagem,
  RadarResumo,
  fmtInt,
  normalizar,
  plural,
  type RadarAbaProps,
} from '@/components/monitoramento/radar-ui'
import { loadLixoIds, saveLixoIds } from '@/lib/noticias-lixo-store'
import {
  dateGroupLabel,
  dateKeyForItem,
  formatNewsMetaDate,
  isTodayNews,
  newsItemDate,
  riskLabel,
  sanitizeNewsItem,
  sentimentLabel,
  sortNewsForDisplay,
} from '@/lib/noticias-page-utils'
import {
  alternarDestaqueAlerta,
  coletarAlertas,
  fetchAlertasFeeds,
  fetchAlertasNoticias,
  type AlertaFeed,
} from '@/lib/services/radar-eleitoral-client'
import { stripHtml } from '@/lib/strip-html'
import { cn } from '@/lib/utils'
import type { NewsItem } from '@/types'

const PAGE_SIZE = 30
type Sentimento = NewsItem['sentiment']
type Risco = NewsItem['risk_level']

const VERMELHO = 'rgb(185 28 28)'
const COR_SENTIMENTO: Record<Sentimento, string> = {
  positive: 'var(--tse-green)',
  negative: VERMELHO,
  neutral: 'var(--tse-zero)',
}
const COR_RISCO: Record<Risco, string> = {
  high: VERMELHO,
  medium: 'var(--tse-yellow)',
  low: 'var(--tse-zero)',
}
const SENTIMENTOS: Sentimento[] = ['negative', 'neutral', 'positive']
const RISCOS: Risco[] = ['high', 'medium', 'low']

type Grupo = { chave: string; rotulo: string; risco: boolean; itens: NewsItem[] }

function agrupar(itens: NewsItem[]): Grupo[] {
  const grupos: Grupo[] = []
  const altos = itens.filter((n) => n.risk_level === 'high')
  if (altos.length) grupos.push({ chave: 'risco', rotulo: 'Risco alto', risco: true, itens: altos })
  const porDia = new Map<string, NewsItem[]>()
  for (const n of itens) {
    if (n.risk_level === 'high') continue
    const k = dateKeyForItem(n)
    porDia.set(k, [...(porDia.get(k) ?? []), n])
  }
  ;[...porDia.keys()]
    .sort((a, b) => b.localeCompare(a))
    .forEach((k) => grupos.push({ chave: k, rotulo: dateGroupLabel(k), risco: false, itens: porDia.get(k) ?? [] }))
  return grupos
}

export function GoogleAlertsPanel({ atores, candidato }: RadarAbaProps) {
  const [noticias, setNoticias] = useState<NewsItem[]>([])
  const [feeds, setFeeds] = useState<AlertaFeed[]>([])
  const [carregando, setCarregando] = useState<boolean>(true)
  const [atualizando, setAtualizando] = useState<boolean>(false)
  const [coletaAuto, setColetaAuto] = useState<string | null>(null)
  const [atualizadoEm, setAtualizadoEm] = useState<Date>(() => new Date())
  const [gerenciarFeeds, setGerenciarFeeds] = useState<boolean>(false)
  const [editando, setEditando] = useState<NewsItem | null>(null)
  const [sentimento, setSentimento] = useState<Sentimento | null>(null)
  const [risco, setRisco] = useState<Risco | null>(null)
  const [soDestacadas, setSoDestacadas] = useState<boolean>(false)
  const [ocultarLixo, setOcultarLixo] = useState<boolean>(false)
  const [busca, setBusca] = useState<string>('')
  const [lixo, setLixo] = useState<Set<string>>(() => new Set())
  const [desfazer, setDesfazer] = useState<Set<string>>(() => new Set())
  const [destacando, setDestacando] = useState<string | null>(null)
  const [limite, setLimite] = useState<number>(PAGE_SIZE)
  const timers = useRef<Map<string, number>>(new Map())

  const carregarNoticias = useCallback(async () => {
    const dados = await fetchAlertasNoticias()
    if (dados) {
      setNoticias(dados.map(sanitizeNewsItem))
      setAtualizadoEm(new Date())
    }
  }, [])

  const carregarFeeds = useCallback(async () => {
    const dados = await fetchAlertasFeeds()
    if (dados) setFeeds(dados)
  }, [])

  const carregar = useCallback(async () => {
    try {
      await Promise.all([carregarNoticias(), carregarFeeds()])
    } finally {
      setCarregando(false)
    }
  }, [carregarNoticias, carregarFeeds])

  useEffect(() => {
    setLixo(loadLixoIds())
    void carregar()
    setColetaAuto('Atualizando alertas automaticamente…')
    void coletarAlertas()
      .then(async () => {
        await carregar()
        setColetaAuto(null)
      })
      .catch(() => {
        setColetaAuto('Não foi possível atualizar automaticamente.')
        window.setTimeout(() => setColetaAuto(null), 5000)
      })
  }, [carregar])

  useEffect(() => {
    const mapa = timers.current
    return () => mapa.forEach((id) => window.clearTimeout(id))
  }, [])

  useEffect(() => {
    setLimite(PAGE_SIZE)
  }, [sentimento, risco, soDestacadas, ocultarLixo, busca, candidato])

  const atualizar = async () => {
    setAtualizando(true)
    try {
      await carregar()
    } finally {
      setAtualizando(false)
    }
  }

  const alterarLixo = (id: string, marcar: boolean) => {
    setLixo((prev) => {
      const prox = new Set(prev)
      if (marcar) prox.add(id)
      else prox.delete(id)
      saveLixoIds(prox)
      return prox
    })
    const anterior = timers.current.get(id)
    if (anterior) window.clearTimeout(anterior)
    timers.current.delete(id)
    setDesfazer((prev) => {
      const prox = new Set(prev)
      if (marcar) prox.add(id)
      else prox.delete(id)
      return prox
    })
    if (!marcar) return
    timers.current.set(
      id,
      window.setTimeout(() => {
        setDesfazer((prev) => {
          const prox = new Set(prev)
          prox.delete(id)
          return prox
        })
        timers.current.delete(id)
      }, 5000),
    )
  }

  const alternarDestaque = async (item: NewsItem) => {
    setDestacando(item.id)
    try {
      const destacar = !item.dashboard_highlight
      const { rebaixadoId } = await alternarDestaqueAlerta(item.id, destacar)
      setNoticias((prev) =>
        prev.map((n) => {
          if (n.id === item.id) return { ...n, dashboard_highlight: destacar }
          if (rebaixadoId && n.id === rebaixadoId) return { ...n, dashboard_highlight: false }
          return n
        }),
      )
    } catch {
      /* mantém o estado anterior; o usuário pode tentar de novo */
    } finally {
      setDestacando(null)
    }
  }

  const feedsAtivos = useMemo(() => feeds.filter((f) => f.active !== false), [feeds])

  /** Notícias de feeds desativados saem da lista (só faz efeito quando há feeds de adversário inativos). */
  const daBase = useMemo(() => {
    const ativos = new Set(feedsAtivos.map((f) => `${f.type}-${f.id}`))
    const filtrarFeeds = ativos.size > 0 && ativos.size < feeds.length
    const ator = candidato ? atores.find((a) => a.slug === candidato) : undefined
    const termos = ator
      ? [ator.name, ...(ator.youtube_search_terms ?? []).map((t) => t.term)].map(normalizar).filter(Boolean)
      : []
    return noticias.filter((n) => {
      if (filtrarFeeds && n.adversary_id && !ativos.has(`adversary_feed-${n.adversary_id}`)) return false
      if (termos.length) {
        const texto = normalizar(`${n.title} ${n.content ?? ''}`)
        if (!termos.some((t) => texto.includes(t))) return false
      }
      return true
    })
  }, [noticias, feeds.length, feedsAtivos, candidato, atores])

  const termo = normalizar(busca.trim())
  const filtradas = useMemo(
    () =>
      sortNewsForDisplay(
        daBase.filter(
          (n) =>
            (!sentimento || n.sentiment === sentimento) &&
            (!risco || n.risk_level === risco) &&
            (!soDestacadas || n.dashboard_highlight) &&
            (!ocultarLixo || !lixo.has(n.id)) &&
            (!termo || normalizar(`${n.title} ${n.source} ${n.theme ?? ''}`).includes(termo)),
        ),
      ),
    [daBase, sentimento, risco, soDestacadas, ocultarLixo, lixo, termo],
  )
  const grupos = useMemo(() => agrupar(filtradas.slice(0, limite)), [filtradas, limite])

  const hoje = daBase.filter(isTodayNews).length
  const altos = daBase.filter((n) => n.risk_level === 'high').length
  const destacadas = daBase.filter((n) => n.dashboard_highlight).length
  const negativas = daBase.filter((n) => n.sentiment === 'negative').length
  const pctNegativas = daBase.length ? (negativas / daBase.length) * 100 : 0
  const nomeCandidato = atores.find((a) => a.slug === candidato)?.name
  const temFiltros = Boolean(sentimento || risco || soDestacadas || ocultarLixo || termo)
  const minutos = Math.floor((Date.now() - atualizadoEm.getTime()) / 60_000)
  const atualizadoTxt = minutos < 1 ? 'atualizado agora' : `atualizado há ${minutos} min`

  const itensSentimento: TseItemLista<Sentimento>[] = SENTIMENTOS.map((s) => ({
    id: s,
    label: sentimentLabel(s),
    valor: daBase.filter((n) => n.sentiment === s).length,
    cor: COR_SENTIMENTO[s],
  }))
  const itensRisco: TseItemLista<Risco>[] = RISCOS.map((r) => ({
    id: r,
    label: `Risco ${riskLabel(r).toLowerCase()}`,
    valor: daBase.filter((n) => n.risk_level === r).length,
    cor: COR_RISCO[r],
  }))

  const limpar = () => {
    setSentimento(null)
    setRisco(null)
    setSoDestacadas(false)
    setOcultarLixo(false)
    setBusca('')
  }

  if (carregando && noticias.length === 0) return <TseCarregando texto="Carregando alertas…" />

  return (
    <RadarLayout
      aside={
        <>
          <RadarDadosGerais fonte={`Inbox RSS · ${atualizadoTxt}`}>
            <TseDados>
              <TseDado rotulo="Notícias" valor={fmtInt(daBase.length)} />
              <TseDado rotulo="Captadas hoje" valor={fmtInt(hoje)} />
              <TseDado rotulo="Risco alto" valor={fmtInt(altos)} />
              <TseDado rotulo="Destacadas" valor={fmtInt(destacadas)} />
            </TseDados>
            <TseBarraRotulo pct={pctNegativas} rotulo={`${pctNegativas.toFixed(1).replace('.', ',')}%`} />
            <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Fatia de notícias com sentimento negativo</p>
          </RadarDadosGerais>
          <TseListaFiltro titulo="Sentimento" itens={itensSentimento} ativo={sentimento} onChange={setSentimento} />
          <TseListaFiltro titulo="Risco" itens={itensRisco} ativo={risco} onChange={setRisco} />
          <section className={tseCardClass}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold">Alertas ativos</h2>
              <button type="button" onClick={() => setGerenciarFeeds(true)} className={tseLinkAcaoClass}>
                Gerenciar
              </button>
            </div>
            {feedsAtivos.length === 0 ? (
              <p className="mt-3 text-[13px] text-[var(--tse-muted)]">Nenhum alerta configurado.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-[13px]">
                {feedsAtivos.map((f) => (
                  <li key={`${f.type}-${f.id}`} className="flex items-center gap-2 px-2 py-0.5">
                    <span className="h-3 w-3 shrink-0 bg-[var(--tse-green)]" aria-hidden />
                    <span className="truncate">{stripHtml(f.name)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={soDestacadas ? 'destacadas' : 'todas'}
            onChange={(e) => setSoDestacadas(e.target.value === 'destacadas')}
            className={tseControleClass}
            aria-label="Destaque"
          >
            <option value="todas">Todas as notícias</option>
            <option value="destacadas">Só destacadas no painel</option>
          </select>
          <label className="flex items-center gap-1.5 text-[13px] font-semibold">
            <input
              type="checkbox"
              checked={ocultarLixo}
              onChange={(e) => setOcultarLixo(e.target.checked)}
              className="h-4 w-4 accent-[var(--tse-olive)]"
            />
            Ocultar lixo
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TseBusca value={busca} onChange={setBusca} placeholder="Buscar manchete, fonte ou tema" className="w-64" />
          <button type="button" onClick={() => void atualizar()} disabled={atualizando} className={tseBotaoCinzaClass}>
            <RefreshCw className={cn(tseBotaoIconeClass, atualizando && 'animate-spin')} />
            Atualizar
          </button>
          <button type="button" onClick={() => setGerenciarFeeds(true)} className={tseBotaoPrimarioClass}>
            <Plus className="h-4 w-4" />
            Novo alerta
          </button>
        </div>
      </div>

      {coletaAuto ? <RadarAviso carregando={coletaAuto.startsWith('Atualizando')}>{coletaAuto}</RadarAviso> : null}

      <RadarResumo
        titulo="Alertas"
        escopo={nomeCandidato ?? 'Todos os candidatos'}
        descricao={
          nomeCandidato
            ? `Notícias do inbox que citam ${nomeCandidato} ou seus termos`
            : 'Inbox de notícias dos feeds RSS e Google Alerts'
        }
        numeros={[
          { rotulo: 'hoje', valor: fmtInt(hoje) },
          { rotulo: 'risco alto', valor: fmtInt(altos) },
          { rotulo: 'destacadas', valor: fmtInt(destacadas) },
        ]}
      />

      <RadarLinhaContagem
        acoes={
          temFiltros ? (
            <button type="button" onClick={limpar} className={tseLinkAcaoClass}>
              Limpar filtros
            </button>
          ) : undefined
        }
      >
        {plural(filtradas.length, 'notícia', 'notícias')}
        {temFiltros ? ' com os filtros aplicados' : ''} · risco alto primeiro, depois por data
      </RadarLinhaContagem>

      <div className="mt-3">
        {filtradas.length === 0 ? (
          <TseVazio>
            {noticias.length === 0 ? (
              <>
                Nenhuma notícia coletada ainda.{' '}
                <button type="button" onClick={() => setGerenciarFeeds(true)} className={tseLinkAcaoClass}>
                  Configurar alertas RSS
                </button>
              </>
            ) : (
              'Nenhuma notícia corresponde aos filtros. Afrouxe sentimento, risco ou a busca.'
            )}
          </TseVazio>
        ) : (
          <div className={tseTabela.container}>
            <table className={tseTabela.table} data-tse-tabela>
              <thead className={tseTabela.thead}>
                <tr>
                  <th className={tseTabela.th}>Notícia</th>
                  <th className={cn(tseTabela.th, 'hidden w-32 sm:table-cell')}>Sentimento</th>
                  <th className={cn(tseTabela.th, 'hidden w-32 md:table-cell')}>Risco</th>
                  <th className={cn(tseTabela.th, 'w-28 text-right')}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <Fragment key={g.chave}>
                    <tr className="border-t border-[#EEEEEE] bg-[var(--tse-bar)]">
                      <td
                        colSpan={4}
                        className={cn(
                          'px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide',
                          g.risco ? 'text-red-700' : 'text-[var(--tse-muted)]',
                        )}
                      >
                        {g.rotulo} · {fmtInt(g.itens.length)}
                      </td>
                    </tr>
                    {g.itens.map((n) => {
                      const ehLixo = lixo.has(n.id)
                      const data = newsItemDate(n)
                      return (
                        <tr
                          key={n.id}
                          className={cn(
                            tseTabela.tr,
                            n.dashboard_highlight && 'bg-[var(--tse-yellow-soft)]',
                            ehLixo && 'opacity-50',
                          )}
                        >
                          <td className={tseTabela.td}>
                            <p className="font-semibold leading-snug">
                              {n.url ? (
                                <a
                                  href={n.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-[var(--tse-olive)] hover:underline"
                                >
                                  {n.title}
                                </a>
                              ) : (
                                n.title
                              )}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--tse-muted)]">
                              <span>
                                {n.source} · {data ? formatNewsMetaDate(data) : '—'}
                              </span>
                              {n.theme ? (
                                <span className="rounded-full bg-[var(--tse-bar)] px-2 font-semibold text-[var(--tse-text)]">
                                  {n.theme}
                                </span>
                              ) : null}
                              <span className="sm:hidden">
                                {sentimentLabel(n.sentiment)} · risco {riskLabel(n.risk_level).toLowerCase()}
                              </span>
                              {ehLixo ? <span className="font-bold">Lixo</span> : null}
                              {ehLixo && desfazer.has(n.id) ? (
                                <button
                                  type="button"
                                  onClick={() => alterarLixo(n.id, false)}
                                  className={tseLinkAcaoClass}
                                >
                                  Desfazer
                                </button>
                              ) : null}
                            </p>
                          </td>
                          <td className={cn(tseTabela.td, 'hidden sm:table-cell')}>
                            <TseStatus cor={COR_SENTIMENTO[n.sentiment]}>{sentimentLabel(n.sentiment)}</TseStatus>
                          </td>
                          <td className={cn(tseTabela.td, 'hidden md:table-cell')}>
                            <TseStatus cor={COR_RISCO[n.risk_level]}>{riskLabel(n.risk_level)}</TseStatus>
                          </td>
                          <td className={cn(tseTabela.td, 'text-right')}>
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => void alternarDestaque(n)}
                                disabled={destacando === n.id}
                                title={n.dashboard_highlight ? 'Remover do briefing' : 'Destacar no briefing'}
                                aria-label={n.dashboard_highlight ? 'Remover do briefing' : 'Destacar no briefing'}
                                className="rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-gold-text)] disabled:opacity-50"
                              >
                                <Star
                                  className={cn(
                                    'h-4 w-4',
                                    n.dashboard_highlight && 'fill-[var(--tse-yellow)] text-[var(--tse-yellow)]',
                                  )}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditando(n)}
                                title="Classificar"
                                aria-label="Classificar notícia"
                                className="rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-olive)]"
                              >
                                <Tags className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => alterarLixo(n.id, !ehLixo)}
                                title={ehLixo ? 'Tirar do lixo' : 'Marcar como lixo'}
                                aria-label={ehLixo ? 'Tirar do lixo' : 'Marcar como lixo'}
                                className="rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TseCarregarMais restantes={filtradas.length - limite} onClick={() => setLimite((n) => n + PAGE_SIZE)} />
      </div>

      {gerenciarFeeds ? (
        <RadarFeedsModal feeds={feeds} onClose={() => setGerenciarFeeds(false)} onAlterado={() => void carregar()} />
      ) : null}

      {editando ? (
        <RadarClassificarModal
          noticia={editando}
          onClose={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            void carregarNoticias()
          }}
        />
      ) : null}
    </RadarLayout>
  )
}
