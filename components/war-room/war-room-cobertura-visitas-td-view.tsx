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
import {
  TseCarregando,
  TseTabs,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseCardClass,
  tseTabela,
  type TseAba,
} from '@/components/tse/tse-ui'
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
    <li
      className={cn(
        'wr-cob-td__city grid grid-cols-[minmax(0,1.4fr)_0.6fr_0.5fr_1fr] items-center gap-2 border-t border-[#EEEEEE] px-3 py-2 text-[13px]',
        `wr-cob-td__city--${tone}`,
      )}
    >
      <span className="wr-cob-td__city-name truncate font-semibold text-[var(--tse-text)]">
        {row.municipio}
      </span>
      <span className="wr-cob-td__city-peso tabular-nums text-[var(--tse-muted)]">
        {formatPeso(row.pesoPct)}
      </span>
      <span className="wr-cob-td__city-visitas tabular-nums text-[var(--tse-muted)]">
        {formatVisitasCount(row.visitasNoJanela)}
      </span>
      <span className="wr-cob-td__city-status text-[12px] font-semibold">
        {cityStatusLabel(row, tone)}
      </span>
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
    <section
      className={cn(
        'wr-cob-td__group mt-4 overflow-hidden rounded-xl bg-white shadow-sm',
        `wr-cob-td__group--${tone}`,
      )}
    >
      <header className="wr-cob-td__group-head border-b border-[var(--tse-border)] bg-[var(--tse-bar)] px-4 py-2.5">
        <h3 className="wr-cob-td__group-title text-[13px] font-bold text-[var(--tse-text)]">
          {title}
          <span className="wr-cob-td__group-count ml-2 text-[12px] font-semibold text-[var(--tse-muted)]">
            {count}
            {cities.length > 0 ? ` · ${formatPeso(pesoPct)}` : ''}
          </span>
        </h3>
      </header>
      {cities.length === 0 ? (
        <p className="wr-cob-td__empty px-4 py-6 text-center text-[13px] text-[var(--tse-muted)]">
          Nenhuma cidade nesta categoria.
        </p>
      ) : (
        <ul className="wr-cob-td__city-list">
          <li
            className="wr-cob-td__city-list-head grid grid-cols-[minmax(0,1.4fr)_0.6fr_0.5fr_1fr] gap-2 bg-[var(--tse-bar)] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]"
            aria-hidden
          >
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
      <p className="wr-cob-td__detail-eyebrow text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
        Território {padRank(td.rank)} de {padRank(totalTds)} · por peso eleitoral
      </p>
      <h2
        id={`wr-cob-td-${td.rank}`}
        className="wr-cob-td__detail-title mt-1 text-[18px] font-bold text-[var(--tse-text)]"
      >
        {td.territorio}
      </h2>
      <div className="wr-cob-td__detail-kpis mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <div className={cn(tseCardClass, 'wr-cob-td__detail-kpi !p-3')}>
          <strong className="block text-[18px] tabular-nums">{td.municipios}</strong>
          <span className="text-[11px] text-[var(--tse-muted)]">municípios</span>
        </div>
        <div className={cn(tseCardClass, 'wr-cob-td__detail-kpi !p-3')}>
          <strong className="block text-[18px] tabular-nums">{formatPeso(td.pesoPct)}</strong>
          <span className="text-[11px] text-[var(--tse-muted)]">do peso estadual</span>
        </div>
        <div className={cn(tseCardClass, 'wr-cob-td__detail-kpi wr-cob-td__detail-kpi--ok !p-3')}>
          <strong className="block text-[18px] tabular-nums">{td.visitadas}</strong>
          <span className="text-[11px] text-[var(--tse-muted)]">visitadas</span>
        </div>
        <div className={cn(tseCardClass, 'wr-cob-td__detail-kpi wr-cob-td__detail-kpi--warn !p-3')}>
          <strong className="block text-[18px] tabular-nums">{td.agendadas}</strong>
          <span className="text-[11px] text-[var(--tse-muted)]">agendadas</span>
        </div>
        <div className={cn(tseCardClass, 'wr-cob-td__detail-kpi wr-cob-td__detail-kpi--bad !p-3')}>
          <strong className="block text-[18px] tabular-nums">{td.semCobertura}</strong>
          <span className="text-[11px] text-[var(--tse-muted)]">sem cobertura</span>
        </div>
        <div className={cn(tseCardClass, 'wr-cob-td__detail-kpi !p-3')}>
          <strong className="block text-[18px] tabular-nums">
            {formatMeta(td.eleitoresSemCobertura)}
          </strong>
          <span className="text-[11px] text-[var(--tse-muted)]">eleitores sem cobertura</span>
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

  const subAbas = useMemo((): readonly TseAba<string>[] => {
    return [
      { id: 'resumo', label: 'Resumo' },
      ...model.territorios.map((td) => ({
        id: `td:${td.rank}`,
        label: `${padRank(td.rank)} ${td.territorio}`,
      })),
      { id: 'anexo', label: 'Anexo' },
    ]
  }, [model.territorios])

  const subAtiva = typeof subTab === 'number' ? `td:${subTab}` : subTab

  const handleSubChange = (id: string) => {
    if (id === 'resumo' || id === 'anexo') {
      setSubTab(id)
      return
    }
    if (id.startsWith('td:')) {
      const rank = Number(id.slice(3))
      if (Number.isFinite(rank)) setSubTab(rank)
    }
  }

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
    <div className="wr-cob-td flex flex-col gap-4" data-tse-cobertura="">
      <header className="wr-cob-td__hero">
        <h1 className="wr-cob-td__title text-[18px] font-bold text-[var(--tse-text)]">
          Cobertura por território
        </h1>
        <p className="wr-cob-td__sub mt-0.5 text-[13px] text-[var(--tse-muted)]">
          {model.cidadesRanking} cidades · {model.territorios.length} TDs · {model.atualizadoEm}
        </p>
      </header>

      <div
        className="wr-cob-td__kpis grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        role="group"
        aria-label="Resumo de cobertura"
      >
        <article className={cn(tseCardClass, 'wr-cob-td__kpi')}>
          <span className="wr-cob-td__kpi-label text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
            Cidades no ranking
          </span>
          <strong className="wr-cob-td__kpi-val mt-1 block text-[28px] font-bold tabular-nums text-[var(--tse-text)]">
            {model.cidadesRanking}
          </strong>
          <span className="wr-cob-td__kpi-hint mt-1 block text-[12px] text-[var(--tse-muted)]">
            {model.cidadesRanking} municípios mapeados
          </span>
        </article>
        <article className={cn(tseCardClass, 'wr-cob-td__kpi')}>
          <span className="wr-cob-td__kpi-label text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
            Cobertas (≤{model.janelaDias} dias)
          </span>
          <strong className="wr-cob-td__kpi-val mt-1 block text-[28px] font-bold tabular-nums text-[var(--tse-olive)]">
            {model.cobertas}
          </strong>
          <span className="wr-cob-td__kpi-hint mt-1 block text-[12px] text-[var(--tse-muted)]">
            {formatPeso(model.pesoCobertasPct)} do peso total
          </span>
        </article>
        <article className={cn(tseCardClass, 'wr-cob-td__kpi')}>
          <span className="wr-cob-td__kpi-label text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
            Agendadas
          </span>
          <strong className="wr-cob-td__kpi-val mt-1 block text-[28px] font-bold tabular-nums text-[var(--tse-gold-text)]">
            {model.agendadas}
          </strong>
          <span className="wr-cob-td__kpi-hint mt-1 block text-[12px] text-[var(--tse-muted)]">
            fora do prazo ou nunca visitadas, com data marcada
          </span>
        </article>
        <article className={cn(tseCardClass, 'wr-cob-td__kpi')}>
          <span className="wr-cob-td__kpi-label text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
            Sem cobertura
          </span>
          <strong className="wr-cob-td__kpi-val mt-1 block text-[28px] font-bold tabular-nums text-[#b45309]">
            {model.semCobertura}
          </strong>
          <span className="wr-cob-td__kpi-hint mt-1 block text-[12px] text-[var(--tse-muted)]">
            {formatPeso(model.pesoSemCoberturaPct)} do peso · {formatMeta(model.eleitoresSemCobertura)}{' '}
            eleitores
          </span>
        </article>
      </div>

      <section
        className={cn(tseCardClass, 'wr-cob-td__weight')}
        aria-label="Peso eleitoral coberto x descoberto"
      >
        <h2 className="wr-cob-td__weight-title text-[15px] font-bold text-[var(--tse-text)]">
          Peso eleitoral coberto x descoberto — cobertura válida por {model.janelaDias} dias
        </h2>
        <div
          className="wr-cob-td__weight-bar mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--tse-zero)]"
          role="img"
          aria-label="Distribuição de peso"
        >
          <span
            className="wr-cob-td__weight-seg wr-cob-td__weight-seg--ok h-full"
            style={{ width: `${barOk}%` }}
          />
          <span
            className="wr-cob-td__weight-seg wr-cob-td__weight-seg--warn h-full"
            style={{ width: `${barWarn}%` }}
          />
          <span
            className="wr-cob-td__weight-seg wr-cob-td__weight-seg--bad h-full"
            style={{ width: `${barBad}%` }}
          />
        </div>
        <ul className="wr-cob-td__weight-legend mt-3 space-y-1.5 text-[13px] text-[var(--tse-text)]">
          <li className="flex items-center gap-2">
            <span className="wr-cob-td__dot wr-cob-td__dot--ok inline-block h-2.5 w-2.5 rounded-full" />
            Visitadas (dentro de {model.janelaDias} dias) — {formatPeso(model.pesoCobertasPct)} do peso
          </li>
          <li className="flex items-center gap-2">
            <span className="wr-cob-td__dot wr-cob-td__dot--warn inline-block h-2.5 w-2.5 rounded-full" />
            Agendadas — {formatPeso(model.pesoAgendadasPct)} do peso
          </li>
          <li className="flex items-center gap-2">
            <span className="wr-cob-td__dot wr-cob-td__dot--bad inline-block h-2.5 w-2.5 rounded-full" />
            Sem cobertura — {formatPeso(model.pesoSemCoberturaPct)} do peso
          </li>
        </ul>
        <p className="wr-cob-td__note mt-3 text-[12px] leading-relaxed text-[var(--tse-muted)]">
          Janela de cobertura: {model.janelaDias} dias. Uma cidade só conta como “visitada” se a última
          visita ocorreu nos últimos {model.janelaDias} dias (a partir de {model.atualizadoEm} — visitas
          antes de {model.cutoffLabel} não contam). Cidade com visita mais antiga que isso entra em “Sem
          cobertura”, a menos que já tenha uma próxima visita agendada, caso em que entra em
          “Agendada”. Os Territórios de Desenvolvimento seguem a divisão oficial do Governo do Piauí (12
          territórios, 224 municípios no total; {model.cidadesRanking} constam neste ranking).
        </p>
      </section>

      <div className="wr-cob-td__subtabs-wrap">
        <TseTabs abas={subAbas} ativa={subAtiva} onChange={handleSubChange} />
      </div>

      {subTab === 'resumo' ? (
        <section
          className="wr-cob-td__table-wrap"
          aria-labelledby="wr-cob-td-table-title"
          data-tse-tabela=""
        >
          <h2
            id="wr-cob-td-table-title"
            className="wr-cob-td__section-title mb-2 text-[15px] font-bold text-[var(--tse-text)]"
          >
            Territórios ordenados por peso eleitoral
          </h2>
          <div className={cn(tseTabela.container, 'wr-cob-td__table-scroll')}>
            <table className={cn(tseTabela.table, 'wr-cob-td__table')}>
              <thead className={tseTabela.thead}>
                <tr>
                  <th className={tseTabela.th}>#</th>
                  <th className={tseTabela.th}>Território</th>
                  <th className={tseTabela.th}>Municípios</th>
                  <th className={tseTabela.th}>Peso %</th>
                  <th className={tseTabela.th}>Visitadas</th>
                  <th className={tseTabela.th}>Agendadas</th>
                  <th className={tseTabela.th}>Sem cobertura</th>
                  <th className={tseTabela.th}>Eleitores sem cobertura</th>
                </tr>
              </thead>
              <tbody>
                {model.territorios.map((td) => (
                  <tr key={td.territorio} className={tseTabela.tr}>
                    <td className={tseTabela.td}>{padRank(td.rank)}</td>
                    <td className={tseTabela.td}>
                      <button
                        type="button"
                        className="wr-cob-td__td-link"
                        onClick={() => setSubTab(td.rank)}
                      >
                        {td.territorio}
                      </button>
                    </td>
                    <td className={cn(tseTabela.td, 'tabular-nums')}>{td.municipios}</td>
                    <td className={cn(tseTabela.td, 'tabular-nums')}>{formatPeso(td.pesoPct)}</td>
                    <td className={cn(tseTabela.td, 'wr-cob-td__num--ok tabular-nums')}>
                      {td.visitadas}
                    </td>
                    <td className={cn(tseTabela.td, 'wr-cob-td__num--warn tabular-nums')}>
                      {td.agendadas}
                    </td>
                    <td className={cn(tseTabela.td, 'wr-cob-td__num--bad tabular-nums')}>
                      {td.semCobertura}
                    </td>
                    <td className={cn(tseTabela.td, 'tabular-nums')}>
                      {formatMeta(td.eleitoresSemCobertura)}
                    </td>
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
        <section className="wr-cob-td__anexo" aria-labelledby="wr-cob-td-anexo" data-tse-tabela="">
          <div className="wr-cob-td__anexo-head mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="wr-cob-td-anexo"
                className="wr-cob-td__section-title text-[15px] font-bold text-[var(--tse-text)]"
              >
                Anexo · Sem cobertura válida
              </h2>
              <p className="wr-cob-td__anexo-sub mt-0.5 text-[13px] text-[var(--tse-muted)]">
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
              className={cn(tseBotaoCinzaClass, 'wr-cob-td__pdf-btn')}
              disabled={pdfBusy || model.anexoSemCobertura.length === 0}
              onClick={handleExportAnexoPdf}
              aria-label="Gerar PDF do anexo"
              title="PDF profissional (header, KPIs e peso eleitoral)"
            >
              {pdfBusy ? (
                <Loader2 className={cn(tseBotaoIconeClass, 'animate-spin')} aria-hidden />
              ) : (
                <FileDown className={tseBotaoIconeClass} aria-hidden />
              )}
              {pdfBusy ? 'Gerando…' : 'Gerar PDF'}
            </button>
          </div>
          {model.anexoSemCobertura.length === 0 ? (
            <TseVazio>Nenhum município sem cobertura válida.</TseVazio>
          ) : (
            <div className={cn(tseTabela.container, 'wr-cob-td__table-scroll')}>
              <table className={cn(tseTabela.table, 'wr-cob-td__table wr-cob-td__table--anexo')}>
                <thead className={tseTabela.thead}>
                  <tr>
                    <th className={tseTabela.th}>#</th>
                    <th className={tseTabela.th}>Município</th>
                    <th className={tseTabela.th}>Território</th>
                    <th className={tseTabela.th}>Meta</th>
                    <th className={tseTabela.th}>Peso %</th>
                    <th className={tseTabela.th}>Eleitores</th>
                    <th className={tseTabela.th}>Última visita</th>
                    <th className={tseTabela.th}>Próxima visita</th>
                  </tr>
                </thead>
                <tbody>
                  {model.anexoSemCobertura.map((c, i) => (
                    <tr key={c.municipioKey} className={tseTabela.tr}>
                      <td className={tseTabela.td}>{i + 1}</td>
                      <td className={cn(tseTabela.td, 'font-semibold')}>{c.municipio}</td>
                      <td className={tseTabela.td}>
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
                      <td className={cn(tseTabela.td, 'tabular-nums')}>{formatMeta(c.meta)}</td>
                      <td className={cn(tseTabela.td, 'tabular-nums')}>{formatPeso(c.pesoPct)}</td>
                      <td className={cn(tseTabela.td, 'tabular-nums')}>{formatMeta(c.eleitores)}</td>
                      <td className={tseTabela.td}>{formatUltimaVisitaLabel(c)}</td>
                      <td className={tseTabela.td}>{formatProximaAgendaLabel(c)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--tse-border)] bg-[var(--tse-bar)] font-bold">
                    <td className={tseTabela.td} colSpan={3}>
                      Total · {model.anexoSemCobertura.length} cidades
                    </td>
                    <td className={cn(tseTabela.td, 'tabular-nums')}>
                      {formatMeta(model.anexoSemCobertura.reduce((s, c) => s + c.meta, 0))}
                    </td>
                    <td className={cn(tseTabela.td, 'tabular-nums')}>
                      {formatPeso(model.anexoSemCobertura.reduce((s, c) => s + c.pesoPct, 0))}
                    </td>
                    <td className={cn(tseTabela.td, 'tabular-nums')}>
                      {formatMeta(model.anexoSemCobertura.reduce((s, c) => s + c.eleitores, 0))}
                    </td>
                    <td className={tseTabela.td} />
                    <td className={tseTabela.td} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
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
    return <TseCarregando texto="Carregando cobertura de visitas…" className="min-h-[30vh]" />
  }

  if (!loading && model.cidadesRanking === 0) {
    return (
      <TseVazio>
        <span className="inline-flex items-center justify-center gap-2">
          <MapPin className="h-5 w-5 text-[var(--tse-yellow)]" strokeWidth={1.5} aria-hidden />
          Nenhuma cidade com meta de votos no ranking.
        </span>
      </TseVazio>
    )
  }

  return <CoberturaBody model={model} />
}
