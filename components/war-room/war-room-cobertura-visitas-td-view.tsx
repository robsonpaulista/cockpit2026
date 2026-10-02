'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileDown, Loader2, MapPin } from 'lucide-react'
import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import type { IptMunicipio } from '@/lib/ipt'
import { normalizeIptMunicipio } from '@/lib/ipt'
import {
  buildAgendaProximosPorMunicipio,
  type WarRoomAgendaProximoItem,
} from '@/lib/war-room/agenda-proximos'
import {
  buildCoberturaVisitasTdModel,
  COBERTURA_VISITAS_JANELA_DIAS,
  formatMeta,
  formatPeso,
  formatProximaAgendaLabel,
  formatUltimaVisitaLabel,
  type CoberturaCampoVisitaInfo,
  type CoberturaCidadeRow,
  type CoberturaTdRow,
  type CoberturaVisitasTdModel,
} from '@/lib/war-room/cobertura-visitas-td'
import { exportCoberturaAnexoPdf } from '@/lib/war-room/cobertura-visitas-td-pdf'
import { cn } from '@/lib/utils'
import '@/app/dashboard/shared/cobertura-cx-chrome.css'

/** Agenda futura considerada para status “agendada” (além da janela de 15 dias do home). */
const AGENDA_COBERTURA_JANELA_DIAS = 90

type Props = {
  municipios: IptMunicipio[]
  loading?: boolean
}

function padRank(n: number): string {
  return String(n).padStart(2, '0')
}

function cityStatusLabel(
  row: CoberturaCidadeRow,
  tone: 'sem' | 'agendada' | 'visitada',
): string {
  if (tone === 'agendada') {
    const next = formatProximaAgendaLabel(row)
    return next === '—' ? 'Sem data' : next
  }
  if (tone === 'visitada') {
    if (row.daysSinceLastVisit === 0) return 'Hoje'
    if (row.daysSinceLastVisit != null) return `Há ${row.daysSinceLastVisit} dias`
    return formatUltimaVisitaLabel(row)
  }
  // Sem cobertura: só o essencial (nunca / data da última)
  if (!row.ultimaVisita) return 'Nunca visitada'
  const label = formatUltimaVisitaLabel(row)
  return label.startsWith('última visita em ')
    ? label.replace('última visita em ', 'Última ')
    : label.charAt(0).toUpperCase() + label.slice(1)
}

function formatVisitasCount(n: number): string {
  if (n <= 0) return '0'
  return n.toLocaleString('pt-BR')
}

function CityRow({ row, tone }: { row: CoberturaCidadeRow; tone: 'sem' | 'agendada' | 'visitada' }) {
  return (
    <li className={cn('wr-cob-td__city', `wr-cob-td__city--${tone}`)}>
      <span className="wr-cob-td__city-name">{row.municipio}</span>
      <span className="wr-cob-td__city-peso tabular-nums">{formatPeso(row.pesoPct)}</span>
      <span className="wr-cob-td__city-visitas tabular-nums">
        {formatVisitasCount(row.visitasNoJanela)}
      </span>
      <span className="wr-cob-td__city-status">{cityStatusLabel(row, tone)}</span>
    </li>
  )
}

function CityGroup({
  title,
  count,
  pesoPct,
  cities,
  tone,
  statusHeader,
}: {
  title: string
  count: number
  pesoPct: number
  cities: CoberturaCidadeRow[]
  tone: 'sem' | 'agendada' | 'visitada'
  statusHeader: string
}) {
  return (
    <section className={cn('wr-cob-td__group', `wr-cob-td__group--${tone}`)}>
      <header className="wr-cob-td__group-head">
        <h3 className="wr-cob-td__group-title">
          {title}
          <span className="wr-cob-td__group-count">
            {count}
            {cities.length > 0 ? ` · ${formatPeso(pesoPct)}` : ''}
          </span>
        </h3>
      </header>
      {cities.length === 0 ? (
        <p className="wr-cob-td__empty">Nenhuma cidade nesta categoria.</p>
      ) : (
        <ul className="wr-cob-td__city-list">
          <li className="wr-cob-td__city-list-head" aria-hidden>
            <span>Cidade</span>
            <span>Peso</span>
            <span>Visitas</span>
            <span>{statusHeader}</span>
          </li>
          {cities.map((c) => (
            <CityRow key={c.municipioKey} row={c} tone={tone} />
          ))}
        </ul>
      )}
    </section>
  )
}

function TdDetail({ td, totalTds }: { td: CoberturaTdRow; totalTds: number }) {
  return (
    <section className="wr-cob-td__detail" aria-labelledby={`wr-cob-td-${td.rank}`}>
      <p className="wr-cob-td__detail-eyebrow">
        Território {padRank(td.rank)} de {padRank(totalTds)} · por peso eleitoral
      </p>
      <h2 id={`wr-cob-td-${td.rank}`} className="wr-cob-td__detail-title">
        {td.territorio}
      </h2>
      <div className="wr-cob-td__detail-kpis">
        <div className="wr-cob-td__detail-kpi">
          <strong>{td.municipios}</strong>
          <span>municípios</span>
        </div>
        <div className="wr-cob-td__detail-kpi">
          <strong>{formatPeso(td.pesoPct)}</strong>
          <span>do peso estadual</span>
        </div>
        <div className="wr-cob-td__detail-kpi wr-cob-td__detail-kpi--ok">
          <strong>{td.visitadas}</strong>
          <span>visitadas</span>
        </div>
        <div className="wr-cob-td__detail-kpi wr-cob-td__detail-kpi--warn">
          <strong>{td.agendadas}</strong>
          <span>agendadas</span>
        </div>
        <div className="wr-cob-td__detail-kpi wr-cob-td__detail-kpi--bad">
          <strong>{td.semCobertura}</strong>
          <span>sem cobertura</span>
        </div>
        <div className="wr-cob-td__detail-kpi">
          <strong>{formatMeta(td.eleitoresSemCobertura)}</strong>
          <span>eleitores sem cobertura</span>
        </div>
      </div>

      <CityGroup
        title="Sem cobertura"
        count={td.semCobertura}
        pesoPct={td.pesoSemCoberturaPct}
        cities={td.cidadesSemCobertura}
        tone="sem"
        statusHeader="Situação"
      />
      <CityGroup
        title="Agendadas"
        count={td.agendadas}
        pesoPct={td.pesoAgendadasPct}
        cities={td.cidadesAgendadas}
        tone="agendada"
        statusHeader="Próxima"
      />
      <CityGroup
        title="Visitadas (≤45 dias)"
        count={td.visitadas}
        pesoPct={td.pesoVisitadasPct}
        cities={td.cidadesVisitadas}
        tone="visitada"
        statusHeader="Última visita"
      />
    </section>
  )
}

function CoberturaBody({ model }: { model: CoberturaVisitasTdModel }) {
  type CoberturaSubTab = 'resumo' | 'anexo' | number
  const [subTab, setSubTab] = useState<CoberturaSubTab>('resumo')
  const [pdfBusy, setPdfBusy] = useState(false)

  const barOk = Math.max(0, Math.min(100, model.pesoCobertasPct))
  const barWarn = Math.max(0, Math.min(100 - barOk, model.pesoAgendadasPct))
  const barBad = Math.max(0, 100 - barOk - barWarn)

  const activeTd =
    typeof subTab === 'number'
      ? model.territorios.find((t) => t.rank === subTab) ?? null
      : null

  const handleExportAnexoPdf = () => {
    if (pdfBusy || model.anexoSemCobertura.length === 0) return
    setPdfBusy(true)
    try {
      exportCoberturaAnexoPdf(model)
    } finally {
      // allow UI to paint the spinner briefly
      window.setTimeout(() => setPdfBusy(false), 400)
    }
  }

  return (
    <div className="wr-cob-td">
      <header className="wr-cob-td__hero">
        <h1 className="wr-cob-td__title">Cobertura por território</h1>
        <p className="wr-cob-td__sub">
          {model.cidadesRanking} cidades · {model.territorios.length} TDs · {model.atualizadoEm}
        </p>
      </header>

      <div className="wr-cob-td__kpis" role="group" aria-label="Resumo de cobertura">
        <article className="wr-cob-td__kpi">
          <span className="wr-cob-td__kpi-label">Cidades no ranking</span>
          <strong className="wr-cob-td__kpi-val">{model.cidadesRanking}</strong>
          <span className="wr-cob-td__kpi-hint">{model.cidadesRanking} municípios mapeados</span>
        </article>
        <article className="wr-cob-td__kpi">
          <span className="wr-cob-td__kpi-label">Cobertas (≤{model.janelaDias} dias)</span>
          <strong className="wr-cob-td__kpi-val">{model.cobertas}</strong>
          <span className="wr-cob-td__kpi-hint">{formatPeso(model.pesoCobertasPct)} do peso total</span>
        </article>
        <article className="wr-cob-td__kpi">
          <span className="wr-cob-td__kpi-label">Agendadas</span>
          <strong className="wr-cob-td__kpi-val">{model.agendadas}</strong>
          <span className="wr-cob-td__kpi-hint">
            fora do prazo ou nunca visitadas, com data marcada
          </span>
        </article>
        <article className="wr-cob-td__kpi">
          <span className="wr-cob-td__kpi-label">Sem cobertura</span>
          <strong className="wr-cob-td__kpi-val">{model.semCobertura}</strong>
          <span className="wr-cob-td__kpi-hint">
            {formatPeso(model.pesoSemCoberturaPct)} do peso · {formatMeta(model.eleitoresSemCobertura)}{' '}
            eleitores
          </span>
        </article>
      </div>

      <section className="wr-cob-td__weight" aria-label="Peso eleitoral coberto x descoberto">
        <h2 className="wr-cob-td__weight-title">
          Peso eleitoral coberto x descoberto — cobertura válida por {model.janelaDias} dias
        </h2>
        <div className="wr-cob-td__weight-bar" role="img" aria-label="Distribuição de peso">
          <span className="wr-cob-td__weight-seg wr-cob-td__weight-seg--ok" style={{ width: `${barOk}%` }} />
          <span
            className="wr-cob-td__weight-seg wr-cob-td__weight-seg--warn"
            style={{ width: `${barWarn}%` }}
          />
          <span className="wr-cob-td__weight-seg wr-cob-td__weight-seg--bad" style={{ width: `${barBad}%` }} />
        </div>
        <ul className="wr-cob-td__weight-legend">
          <li>
            <span className="wr-cob-td__dot wr-cob-td__dot--ok" />
            Visitadas (dentro de {model.janelaDias} dias) — {formatPeso(model.pesoCobertasPct)} do peso
          </li>
          <li>
            <span className="wr-cob-td__dot wr-cob-td__dot--warn" />
            Agendadas — {formatPeso(model.pesoAgendadasPct)} do peso
          </li>
          <li>
            <span className="wr-cob-td__dot wr-cob-td__dot--bad" />
            Sem cobertura — {formatPeso(model.pesoSemCoberturaPct)} do peso
          </li>
        </ul>
        <p className="wr-cob-td__note">
          Janela de cobertura: {model.janelaDias} dias. Uma cidade só conta como “visitada” se a última
          visita ocorreu nos últimos {model.janelaDias} dias (a partir de {model.atualizadoEm} — visitas
          antes de {model.cutoffLabel} não contam). Cidade com visita mais antiga que isso entra em “Sem
          cobertura”, a menos que já tenha uma próxima visita agendada, caso em que entra em
          “Agendada”. Os Territórios de Desenvolvimento seguem a divisão oficial do Governo do Piauí (12
          territórios, 224 municípios no total; {model.cidadesRanking} constam neste ranking).
        </p>
      </section>

      <div className="wr-cob-td__subtabs-wrap">
        <div
          className="wr-cob-td__subtabs"
          role="tablist"
          aria-label="Territórios de Desenvolvimento"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'resumo'}
            className={cn(
              'wr-cob-td__subtab',
              subTab === 'resumo' && 'wr-cob-td__subtab--on',
            )}
            onClick={() => setSubTab('resumo')}
          >
            Resumo
          </button>
          {model.territorios.map((td) => (
            <button
              key={td.territorio}
              type="button"
              role="tab"
              aria-selected={subTab === td.rank}
              title={td.territorio}
              className={cn(
                'wr-cob-td__subtab',
                subTab === td.rank && 'wr-cob-td__subtab--on',
              )}
              onClick={() => setSubTab(td.rank)}
            >
              <span className="wr-cob-td__subtab-rank">{padRank(td.rank)}</span>
              <span className="wr-cob-td__subtab-name">{td.territorio}</span>
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'anexo'}
            className={cn(
              'wr-cob-td__subtab',
              subTab === 'anexo' && 'wr-cob-td__subtab--on',
            )}
            onClick={() => setSubTab('anexo')}
          >
            Anexo
          </button>
        </div>
      </div>

      {subTab === 'resumo' ? (
        <section className="wr-cob-td__table-wrap" aria-labelledby="wr-cob-td-table-title">
          <h2 id="wr-cob-td-table-title" className="wr-cob-td__section-title">
            Territórios ordenados por peso eleitoral
          </h2>
          <div className="wr-cob-td__table-scroll">
            <table className="wr-cob-td__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Território</th>
                  <th>Municípios</th>
                  <th>Peso %</th>
                  <th>Visitadas</th>
                  <th>Agendadas</th>
                  <th>Sem cobertura</th>
                  <th>Eleitores sem cobertura</th>
                </tr>
              </thead>
              <tbody>
                {model.territorios.map((td) => (
                  <tr key={td.territorio}>
                    <td>{padRank(td.rank)}</td>
                    <td>
                      <button
                        type="button"
                        className="wr-cob-td__td-link"
                        onClick={() => setSubTab(td.rank)}
                      >
                        {td.territorio}
                      </button>
                    </td>
                    <td>{td.municipios}</td>
                    <td>{formatPeso(td.pesoPct)}</td>
                    <td className="wr-cob-td__num--ok">{td.visitadas}</td>
                    <td className="wr-cob-td__num--warn">{td.agendadas}</td>
                    <td className="wr-cob-td__num--bad">{td.semCobertura}</td>
                    <td>{formatMeta(td.eleitoresSemCobertura)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTd ? (
        <div className="wr-cob-td__details">
          <TdDetail td={activeTd} totalTds={model.territorios.length} />
        </div>
      ) : null}

      {subTab === 'anexo' ? (
        <section className="wr-cob-td__anexo" aria-labelledby="wr-cob-td-anexo">
          <div className="wr-cob-td__anexo-head">
            <div>
              <h2 id="wr-cob-td-anexo" className="wr-cob-td__section-title">
                Anexo · Sem cobertura válida
              </h2>
              <p className="wr-cob-td__anexo-sub">
                {model.anexoSemCobertura.length} municípios sem visita nos últimos{' '}
                {model.janelaDias} dias
                {model.agendadas > 0
                  ? ` · ${model.agendadas} com próxima visita agendada`
                  : ''}{' '}
                · por peso eleitoral
              </p>
            </div>
            <button
              type="button"
              className="wr-cob-td__pdf-btn"
              disabled={pdfBusy || model.anexoSemCobertura.length === 0}
              onClick={handleExportAnexoPdf}
              aria-label="Gerar PDF do anexo"
              title="PDF profissional (header, KPIs e peso eleitoral)"
            >
              {pdfBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} aria-hidden />
              ) : (
                <FileDown className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              )}
              {pdfBusy ? 'Gerando…' : 'Gerar PDF'}
            </button>
          </div>
          <div className="wr-cob-td__table-scroll">
            <table className="wr-cob-td__table wr-cob-td__table--anexo">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Município</th>
                  <th>Território</th>
                  <th>Meta</th>
                  <th>Peso %</th>
                  <th>Eleitores</th>
                  <th>Última visita</th>
                  <th>Próxima visita</th>
                </tr>
              </thead>
              <tbody>
                {model.anexoSemCobertura.map((c, i) => (
                  <tr key={c.municipioKey}>
                    <td>{i + 1}</td>
                    <td>{c.municipio}</td>
                    <td>
                      {c.territorio ? (
                        <button
                          type="button"
                          className="wr-cob-td__td-link"
                          onClick={() => {
                            const td = model.territorios.find((t) => t.territorio === c.territorio)
                            if (td) setSubTab(td.rank)
                          }}
                        >
                          {c.territorio}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{formatMeta(c.meta)}</td>
                    <td>{formatPeso(c.pesoPct)}</td>
                    <td>{formatMeta(c.eleitores)}</td>
                    <td>{formatUltimaVisitaLabel(c)}</td>
                    <td>{formatProximaAgendaLabel(c)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    Total · {model.anexoSemCobertura.length} cidades
                  </td>
                  <td>
                    {formatMeta(model.anexoSemCobertura.reduce((s, c) => s + c.meta, 0))}
                  </td>
                  <td>
                    {formatPeso(
                      model.anexoSemCobertura.reduce((s, c) => s + c.pesoPct, 0),
                    )}
                  </td>
                  <td>
                    {formatMeta(model.anexoSemCobertura.reduce((s, c) => s + c.eleitores, 0))}
                  </td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}

/**
 * Aba Cobertura do War Room — layout alinhado ao painel “Cobertura de Visitas por Território”.
 * Sincroniza visitas (campo) e agenda (Google) como no mapa/cards anteriores.
 */
export function WarRoomCoberturaVisitasTdView({ municipios, loading = false }: Props) {
  const [agendaPorMunicipio, setAgendaPorMunicipio] = useState<
    Map<string, WarRoomAgendaProximoItem[]>
  >(() => new Map())
  const [campoVisitasPorMunicipio, setCampoVisitasPorMunicipio] = useState<
    Map<string, CoberturaCampoVisitaInfo>
  >(() => new Map())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [agendaRes, visitasRes] = await Promise.all([
          fetch('/api/agenda/events', { cache: 'no-store' }),
          fetch(`/api/campo/visitas-resumo-td?days=${COBERTURA_VISITAS_JANELA_DIAS}`, {
            cache: 'no-store',
          }),
        ])

        if (!cancelled) {
          if (agendaRes.ok) {
            const data = (await agendaRes.json()) as { events?: CalendarEventRow[] }
            setAgendaPorMunicipio(
              buildAgendaProximosPorMunicipio(data.events ?? [], {
                janelaDias: AGENDA_COBERTURA_JANELA_DIAS,
              }),
            )
          } else {
            setAgendaPorMunicipio(new Map())
          }

          if (visitasRes.ok) {
            const data = (await visitasRes.json()) as {
              municipios?: Array<{
                municipio: string
                visitas: number
                ultimaVisita?: string | null
              }>
            }
            const map = new Map<string, CoberturaCampoVisitaInfo>()
            for (const row of data.municipios ?? []) {
              const key = normalizeIptMunicipio(row.municipio)
              if (!key) continue
              const prev = map.get(key)
              const visitas = Math.max(0, Number(row.visitas) || 0) + (prev?.visitas ?? 0)
              const ultima =
                !prev?.ultimaVisita ||
                (row.ultimaVisita && String(row.ultimaVisita) > prev.ultimaVisita)
                  ? row.ultimaVisita ?? prev?.ultimaVisita ?? null
                  : prev.ultimaVisita
              map.set(key, { visitas, ultimaVisita: ultima })
            }
            setCampoVisitasPorMunicipio(map)
          } else {
            setCampoVisitasPorMunicipio(new Map())
          }
        }
      } catch {
        if (!cancelled) {
          setAgendaPorMunicipio(new Map())
          setCampoVisitasPorMunicipio(new Map())
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const model = useMemo(
    () =>
      buildCoberturaVisitasTdModel(municipios, agendaPorMunicipio, {
        janelaDias: COBERTURA_VISITAS_JANELA_DIAS,
        campoVisitasPorMunicipio,
      }),
    [municipios, agendaPorMunicipio, campoVisitasPorMunicipio],
  )

  if (loading && municipios.length === 0) {
    return (
      <div className="wr-copiloto-view__state">
        <Loader2 className="h-5 w-5 animate-spin text-[#e8a825]" strokeWidth={1.5} />
        <span>Carregando cobertura de visitas…</span>
      </div>
    )
  }

  if (!loading && model.cidadesRanking === 0) {
    return (
      <div className="wr-copiloto-view__state">
        <MapPin className="h-5 w-5 text-[var(--palette-aux)]" strokeWidth={1.5} aria-hidden />
        <span>Nenhuma cidade com meta de votos no ranking.</span>
      </div>
    )
  }

  return <CoberturaBody model={model} />
}
