'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  Filter,
  Heart,
  Megaphone,
  Minus,
  PenLine,
  RefreshCw,
  Send,
  TrendingUp,
  UserRound,
  Wand2,
  X,
} from 'lucide-react'
import {
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
  DashboardPageMetaStrip,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import { FLUXO_DIGITAL_DEMO } from '@/lib/fluxo-digital/demo-data'
import type {
  FluxoDigitalResumo,
  FluxoEngajamentoNivel,
  FluxoEtapaId,
  FluxoEtapaStatus,
  PlanejamentoFluxoFromAgenda,
  ProducaoFluxoResumo,
} from '@/lib/fluxo-digital/types'
import { ghostButtonClass, primaryButtonClass } from '@/lib/premium-ui-classes'
import { typographyPageLeadClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import { FluxoDigitalNovaVisita } from '@/components/fluxo-digital/fluxo-digital-nova-visita'
import Link from 'next/link'
import '@/app/dashboard/shared/ipt-page-palette.css'
import '@/app/dashboard/fluxo-digital/fluxo-digital.css'

const ETAPA_COLS: { id: FluxoEtapaId; label: string }[] = [
  { id: 'planejado', label: 'Planejado' },
  { id: 'produzido', label: 'Produzido' },
  { id: 'enviado', label: 'Enviado' },
  { id: 'divulgado', label: 'Divulgado' },
  { id: 'visita', label: 'Visita' },
  { id: 'pos_visita', label: 'Pós-visita' },
  { id: 'concluido', label: 'Concluído' },
]

const ETAPA_ICONS = {
  planejado: Calendar,
  produzido: PenLine,
  enviado: Send,
  divulgado: Megaphone,
  visita: UserRound,
  pos_visita: FileText,
  concluido: CheckCircle2,
} as const

function StatusIcon({ status }: { status: FluxoEtapaStatus }) {
  if (status === 'ok') {
    return (
      <span className="fd-status fd-status--ok" title="Concluído">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </span>
    )
  }
  if (status === 'parcial') {
    return (
      <span className="fd-status fd-status--parcial" title="Em andamento">
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </span>
    )
  }
  return (
    <span className="fd-status fd-status--pendente" title="Pendente">
      <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
    </span>
  )
}

function engLabel(n: FluxoEngajamentoNivel): string {
  if (n === 'alto') return 'Alto'
  if (n === 'medio') return 'Médio'
  return 'Baixo'
}

function redeLabel(rede: 'instagram' | 'facebook' | 'tiktok'): string {
  if (rede === 'instagram') return 'IG'
  if (rede === 'facebook') return 'FB'
  return 'TT'
}

export function FluxoDigitalPanel() {
  const topbarVisible = useDashboardTopbarVisible()
  const [data, setData] = useState<FluxoDigitalResumo>(FLUXO_DIGITAL_DEMO)
  const [planejamento, setPlanejamento] = useState<PlanejamentoFluxoFromAgenda | null>(
    null
  )
  const [producao, setProducao] = useState<ProducaoFluxoResumo | null>(null)
  const [agendaErro, setAgendaErro] = useState<string | null>(null)
  const [agendaLoading, setAgendaLoading] = useState(true)
  const [removendoId, setRemovendoId] = useState<string | null>(null)
  const [gerandoId, setGerandoId] = useState<string | null>(null)

  const carregarAgenda = useCallback(async () => {
    setAgendaLoading(true)
    setAgendaErro(null)
    try {
      const [resPlan, resProd] = await Promise.all([
        fetch('/api/fluxo-digital/planejamento', { cache: 'no-store' }),
        fetch('/api/fluxo-digital/producao', { cache: 'no-store' }),
      ])
      const jsonPlan = (await resPlan.json()) as PlanejamentoFluxoFromAgenda & {
        error?: string
      }
      const jsonProd = (await resProd.json()) as ProducaoFluxoResumo & { error?: string }

      if (!resPlan.ok) {
        throw new Error(jsonPlan.error || 'Falha ao carregar agenda')
      }
      setPlanejamento(jsonPlan)

      if (resProd.ok) {
        setProducao(jsonProd)
      } else {
        setProducao(null)
        if (jsonProd.error) setAgendaErro(jsonProd.error)
      }

      setData((prev) => {
        const cidadesPlan = jsonPlan.municipiosUnicos
        const pctPlan = Math.round((cidadesPlan / 224) * 1000) / 10
        const cidadesProd = resProd.ok ? jsonProd.municipiosUnicos : 0
        const pctProd = Math.round((cidadesProd / 224) * 1000) / 10
        return {
          ...prev,
          atualizadoEm: new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          etapas: prev.etapas.map((etapa) => {
            if (etapa.id === 'planejado') {
              return {
                ...etapa,
                cidades: cidadesPlan,
                pct: Number.isFinite(pctPlan) ? pctPlan : 0,
              }
            }
            if (etapa.id === 'produzido' && resProd.ok) {
              return {
                ...etapa,
                cidades: cidadesProd,
                pct: Number.isFinite(pctProd) ? pctProd : 0,
              }
            }
            return etapa
          }),
        }
      })
    } catch (e) {
      setAgendaErro(e instanceof Error ? e.message : 'Erro ao carregar agenda')
    } finally {
      setAgendaLoading(false)
    }
  }, [])

  useEffect(() => {
    document.body.setAttribute('data-ipt-palette', '')
    return () => {
      document.body.removeAttribute('data-ipt-palette')
    }
  }, [])

  useEffect(() => {
    void carregarAgenda()
  }, [carregarAgenda])

  const removerDaProgramacao = async (agendaId: string) => {
    setRemovendoId(agendaId)
    try {
      const res = await fetch(`/api/campo/agendas/${agendaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incluir_fluxo_digital: false }),
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error || 'Falha ao remover')
      }
      await carregarAgenda()
    } catch (e) {
      setAgendaErro(e instanceof Error ? e.message : 'Erro ao remover da programação')
    } finally {
      setRemovendoId(null)
    }
  }

  const gerarPecas = async (agendaId: string) => {
    setGerandoId(agendaId)
    setAgendaErro(null)
    try {
      const res = await fetch('/api/fluxo-digital/producao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendaId }),
      })
      const json = (await res.json()) as { error?: string; total?: number; jaExistia?: boolean }
      if (!res.ok) throw new Error(json.error || 'Falha ao gerar peças')
      await carregarAgenda()
    } catch (e) {
      setAgendaErro(e instanceof Error ? e.message : 'Erro ao gerar peças')
    } finally {
      setGerandoId(null)
    }
  }

  const pecasPorAgenda = new Map<string, number>()
  for (const item of producao?.itens ?? []) {
    pecasPorAgenda.set(item.agendaId, (pecasPorAgenda.get(item.agendaId) ?? 0) + 1)
  }

  let tipoAcc = 0
  const tipoStops = data.tipos.map((t) => {
    const start = tipoAcc
    tipoAcc += t.pct
    return `${t.cor} ${start}% ${tipoAcc}%`
  })
  const donutConic = {
    background: `conic-gradient(${tipoStops.join(', ')})`,
  }

  const description = (
    <span className={typographyPageLeadClass}>
      Acompanhe o fluxo completo do conteúdo — do planejamento à conclusão pós-visita
      <span className="mx-1.5 text-text-muted" aria-hidden>
        ·
      </span>
      {data.escopoLabel}
      <span className="mx-1.5 text-text-muted" aria-hidden>
        ·
      </span>
      {data.periodoLabel}
    </span>
  )

  return (
    <DashboardPageShell className="fluxo-digital-page">
      <DashboardPageChrome>
        {topbarVisible ? (
          <DashboardPageMetaStrip>
            <div className="fd-meta-row">
              <span>{description}</span>
              <span className="fd-meta-fresh">Última atualização: {data.atualizadoEm}</span>
            </div>
          </DashboardPageMetaStrip>
        ) : (
          <DashboardPageHeader
            title="Fluxo Digital da Campanha"
            description={description}
            action={
              <div className="fd-header-actions">
                <button type="button" className={ghostButtonClass} disabled title="Em breve">
                  <Filter className="h-3.5 w-3.5" aria-hidden />
                  Filtros
                </button>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => void carregarAgenda()}
                  disabled={agendaLoading}
                >
                  <RefreshCw
                    className={cn('h-3.5 w-3.5', agendaLoading && 'animate-spin')}
                    aria-hidden
                  />
                  Atualizar dados
                </button>
              </div>
            }
          />
        )}
      </DashboardPageChrome>

      <DashboardPageContent className="fluxo-digital-page__content">
        <p className="fd-banner-demo">
          Pipeline: <strong>Planejado</strong> → <strong>Produzido</strong> (pacote de templates) →
          Canva/Claude gera a arte. Demais etapas ainda usam demonstração.
          {agendaErro ? (
            <>
              {' '}
              <span className="text-red-600">{agendaErro}</span>
            </>
          ) : null}
          {planejamento && !agendaErro ? (
            <>
              {' '}
              · {planejamento.visitasPlanejadas} na programação
              {producao
                ? ` · ${producao.totalPecas} peça(s) · ${producao.produzidos} produzida(s)`
                : null}
            </>
          ) : null}
        </p>

        <section className="fd-card">
          <div className="fd-table-head">
            <h2 className="fd-card__title">Programação (planejado)</h2>
            <span className="fd-meta-fresh">
              {agendaLoading
                ? 'Carregando…'
                : planejamento
                  ? `${planejamento.eventos.length} evento(s)`
                  : '—'}
            </span>
          </div>

          <FluxoDigitalNovaVisita onCreated={() => void carregarAgenda()} />

          {planejamento && planejamento.eventos.length > 0 ? (
            <div className="fd-table-wrap" style={{ marginTop: 12 }}>
              <table className="fd-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Município</th>
                    <th>Descrição</th>
                    <th>Peças</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {planejamento.eventos.slice(0, 40).map((ev) => {
                    const nPecas = pecasPorAgenda.get(ev.id) ?? 0
                    return (
                      <tr key={ev.id}>
                        <td>
                          {ev.date
                            ? new Date(`${ev.date}T12:00:00`).toLocaleDateString('pt-BR')
                            : '—'}
                          {ev.hora_evento ? ` · ${ev.hora_evento.slice(0, 5)}` : ''}
                        </td>
                        <td>
                          <strong>{ev.cidade}</strong>
                        </td>
                        <td>{ev.description || '—'}</td>
                        <td>{nPecas > 0 ? `${nPecas} template(s)` : '—'}</td>
                        <td>
                          <div className="fd-row-actions">
                            {nPecas === 0 ? (
                              <button
                                type="button"
                                className="fd-btn-acao"
                                disabled={gerandoId === ev.id}
                                onClick={() => void gerarPecas(ev.id)}
                              >
                                <Wand2 className="h-3 w-3" aria-hidden />
                                {gerandoId === ev.id ? 'Gerando…' : 'Gerar peças'}
                              </button>
                            ) : (
                              <Link
                                href="/dashboard/conteudo/cards"
                                className="fd-btn-acao"
                              >
                                Ver em Conteúdo
                              </Link>
                            )}
                            <button
                              type="button"
                              className="fd-btn-remover"
                              disabled={removendoId === ev.id}
                              onClick={() => void removerDaProgramacao(ev.id)}
                            >
                              {removendoId === ev.id ? '…' : 'Tirar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="fd-empty-agenda" style={{ marginTop: 12 }}>
              {agendaLoading
                ? 'Buscando programação…'
                : 'Nenhum compromisso na programação. Use “Nova visita na programação” ou marque a opção em Território → Visitas.'}
            </p>
          )}
        </section>

        <section className="fd-card">
          <div className="fd-table-head">
            <h2 className="fd-card__title">Produção (templates)</h2>
            <span className="fd-meta-fresh">
              {agendaLoading
                ? 'Carregando…'
                : producao
                  ? `${producao.rascunho} rascunho · ${producao.produzidos} produzido(s)`
                  : '—'}
            </span>
          </div>
          <p className="fd-producao-hint">
            Cada visita gera 6 templates (antes / durante / depois). Claude + Canva entram na geração
            da arte; no Cockpit você acompanha o status e aprova.
          </p>
          {producao && producao.itens.length > 0 ? (
            <div className="fd-table-wrap">
              <table className="fd-table">
                <thead>
                  <tr>
                    <th>Município</th>
                    <th>Fase</th>
                    <th>Template</th>
                    <th>Formato</th>
                    <th>Status</th>
                    <th>Arte</th>
                  </tr>
                </thead>
                <tbody>
                  {producao.itens.slice(0, 24).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.cidade}</strong>
                      </td>
                      <td>{item.fase || '—'}</td>
                      <td>{item.template || '—'}</td>
                      <td>{item.formato || '—'}</td>
                      <td>
                        <span className={cn('fd-status-pill', `fd-status-pill--${item.status}`)}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {item.imagemUrl ? (
                          <a
                            href={item.imagemUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="fd-btn-acao"
                          >
                            {item.fundoOrigem === 'canva' ? 'Canva' : 'Abrir'}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="fd-empty-agenda">
              {agendaLoading
                ? 'Buscando peças…'
                : 'Nenhuma peça ainda. Na programação, clique em “Gerar peças” na visita de Altos (ou peça ao Claude: criar_pacote_conteudo).'}
            </p>
          )}
        </section>

        <section className="fd-card">
          <h2 className="fd-card__title">Fluxo do conteúdo</h2>
          <ol className="fd-pipeline">
            {data.etapas.map((etapa, index) => {
              const Icon = ETAPA_ICONS[etapa.id]
              return (
                <li key={etapa.id} className="fd-pipeline__step">
                  {index > 0 ? <span className="fd-pipeline__arrow" aria-hidden /> : null}
                  <div className={cn('fd-pipeline__card', `fd-pipeline__card--${etapa.id}`)}>
                    <span className="fd-pipeline__ico">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="fd-pipeline__label">
                      {index + 1}. {etapa.label}
                    </span>
                    <strong>{etapa.cidades}</strong>
                    <em>cidades · {etapa.pct}%</em>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <div className="fd-grid-perf">
          <section className="fd-card">
            <h2 className="fd-card__title">Desempenho dos conteúdos</h2>
            <div className="fd-kpis">
              {data.kpis.map((kpi) => (
                <div key={kpi.id} className="fd-kpi">
                  <span className="fd-kpi__label">{kpi.label}</span>
                  <strong className="fd-kpi__valor">{kpi.valor}</strong>
                  <em className="fd-kpi__detalhe">{kpi.detalhe}</em>
                  <span className="fd-kpi__delta">
                    <ArrowUpRight className="h-3 w-3" aria-hidden />
                    +{kpi.deltaPct}%
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="fd-card">
            <h2 className="fd-card__title">Desempenho por tipo de conteúdo</h2>
            <div className="fd-tipos">
              <div className="fd-donut" style={donutConic} aria-hidden>
                <div className="fd-donut__hole">
                  <strong>{data.totalConteudos}</strong>
                  <span>conteúdos</span>
                </div>
              </div>
              <ul className="fd-tipos__legend">
                {data.tipos.map((t) => (
                  <li key={t.id}>
                    <i style={{ background: t.cor }} />
                    <span>{t.label}</span>
                    <strong>{t.pct}%</strong>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <div className="fd-grid-main">
          <section className="fd-card fd-card--table">
            <div className="fd-table-head">
              <h2 className="fd-card__title">Situação do fluxo por município</h2>
              <button type="button" className="fd-link" disabled>
                Ver todos os 224 municípios →
              </button>
            </div>
            <div className="fd-table-wrap">
              <table className="fd-table">
                <thead>
                  <tr>
                    <th>Município</th>
                    {ETAPA_COLS.map((c) => (
                      <th key={c.id}>{c.label}</th>
                    ))}
                    <th>Conteúdos</th>
                    <th>Engajamento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.municipios.map((m) => (
                    <tr key={m.municipio}>
                      <td>
                        <div className="fd-muni">
                          <strong>{m.municipio}</strong>
                          {m.prioridade ? <em>{m.prioridade}</em> : null}
                        </div>
                      </td>
                      {ETAPA_COLS.map((c) => (
                        <td key={c.id}>
                          <StatusIcon status={m.etapas[c.id]} />
                        </td>
                      ))}
                      <td>{m.conteudos}</td>
                      <td>
                        <span
                          className={cn(
                            'fd-eng',
                            m.engajamento === 'alto' && 'fd-eng--alto',
                            m.engajamento === 'medio' && 'fd-eng--medio',
                            m.engajamento === 'baixo' && 'fd-eng--baixo'
                          )}
                        >
                          {engLabel(m.engajamento)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="fd-side-stack">
            <section className="fd-card">
              <h2 className="fd-card__title">Retorno gerado pelos conteúdos</h2>
              <ul className="fd-retornos">
                {data.retornos.map((r) => (
                  <li key={r.id}>
                    <TrendingUp className="h-3.5 w-3.5 fd-retornos__ico" aria-hidden />
                    <span>{r.label}</span>
                    <strong>{r.valor}</strong>
                    <em>+{r.deltaPct}%</em>
                  </li>
                ))}
              </ul>
            </section>

            <section className="fd-card">
              <h2 className="fd-card__title">Desempenho por bandeira</h2>
              <ul className="fd-bandeiras">
                {data.bandeiras.map((b) => (
                  <li key={b.id}>
                    <div className="fd-bandeiras__row">
                      <span>{b.nome}</span>
                      <strong>{b.pct}%</strong>
                    </div>
                    <div className="fd-bar" aria-hidden>
                      <i style={{ width: `${b.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <div className="fd-grid-bottom">
          <section className="fd-card">
            <h2 className="fd-card__title">Últimos conteúdos destaque</h2>
            <div className="fd-destaques">
              {data.destaques.map((d) => (
                <article key={d.id} className="fd-destaque">
                  <div className="fd-destaque__thumb" aria-hidden>
                    <span className="fd-destaque__rede">{redeLabel(d.rede)}</span>
                  </div>
                  <h3>{d.titulo}</h3>
                  <p>
                    {d.local} · {d.data}
                  </p>
                  <div className="fd-destaque__metrics">
                    <span>
                      <Eye className="h-3 w-3" aria-hidden />
                      {d.alcance}
                    </span>
                    <span>
                      <Heart className="h-3 w-3" aria-hidden />
                      {d.curtidas}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="fd-card">
            <h2 className="fd-card__title">Próximas ações recomendadas</h2>
            <ul className="fd-acoes">
              {data.acoes.map((a) => (
                <li key={a.id} className={cn('fd-acao', `fd-acao--${a.tom}`)}>
                  <div>
                    <strong>{a.quantidade}</strong>
                    <span>{a.rotulo}</span>
                  </div>
                  <button type="button" className={ghostButtonClass} disabled>
                    Ver
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </DashboardPageContent>
    </DashboardPageShell>
  )
}
