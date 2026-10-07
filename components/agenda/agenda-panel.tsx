'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, Maximize2, RefreshCw, Settings, X } from 'lucide-react'
import { ArrivalNotificationsPanel } from '@/components/arrival-notifications-panel'
import { AgendaEventosTabela } from '@/components/agenda/agenda-eventos-tabela'
import { GoogleCalendarConfigModal } from '@/components/google-calendar-config-modal'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'
import {
  TseBarraRotulo,
  TseBusca,
  TseCarregando,
  TseCarregarMais,
  TseDado,
  TseDados,
  TseErro,
  TseFilterBar,
  TseListaFiltro,
  TsePage,
  TseSelectGrande,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoPrimarioClass,
  tseCardClass,
  tseControleClass,
  tseLinkAcaoClass,
  type TseItemLista,
} from '@/components/tse/tse-ui'
import { useAgendaGoogle } from '@/hooks/use-agenda-google'
import {
  formatAgendaDatePt,
  formatAgendaTimePt,
  getCalendarEventDate,
  normalizeAgendaText,
} from '@/lib/agenda/calendar-event-utils'
import {
  AGENDA_PERIODOS,
  AGENDA_SITUACOES,
  chaveDia,
  corDaOrigem,
  diaDaChave,
  diaDoEvento,
  eventoJaComecou,
  noPeriodo,
  origemETitulo,
  rotuloDia,
  SEM_ORIGEM,
  situacaoDoEvento,
  type AgendaPeriodo,
  type AgendaSituacao,
} from '@/lib/agenda/agenda-filtros'
import type { AgendaEvento } from '@/lib/services/agenda-google-client'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 30
const DIAS_NA_LISTA = 10
const VALOR_DIA = 'dia'

const fmt = (n: number): string => n.toLocaleString('pt-BR')
const fmtPct = (n: number): string => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
const tempo = (e: AgendaEvento): number => getCalendarEventDate(e)?.getTime() ?? 0
const plural = (n: number, um: string, varios: string): string => `${fmt(n)} ${n === 1 ? um : varios}`

export function AgendaPanel() {
  const agenda = useAgendaGoogle()
  const { config, configCarregada, eventos, carregando, atualizando, erro, presencas, linksCampo, agora } = agenda
  const [periodo, setPeriodo] = useState<AgendaPeriodo>('todos')
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const [situacao, setSituacao] = useState<AgendaSituacao | null>(null)
  const [origem, setOrigem] = useState<string | null>(null)
  const [busca, setBusca] = useState<string>('')
  const [limite, setLimite] = useState<number>(PAGE_SIZE)
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set())
  const [telaCheia, setTelaCheia] = useState<boolean>(false)
  const [mostrarConfig, setMostrarConfig] = useState<boolean>(false)

  useEffect(() => {
    setLimite(PAGE_SIZE)
  }, [periodo, diaSelecionado, situacao, origem, busca])

  const ordenados = useMemo(() => [...eventos].sort((a, b) => tempo(a) - tempo(b)), [eventos])

  const doPeriodo = useMemo(() => {
    const diaFixo = diaSelecionado ? diaDaChave(diaSelecionado) : null
    return ordenados.filter((e) => {
      const dia = diaDoEvento(e)
      if (dia == null) return false
      return diaFixo != null ? dia === diaFixo : noPeriodo(dia, periodo, agora)
    })
  }, [ordenados, diaSelecionado, periodo, agora])

  const termo = normalizeAgendaText(busca)
  const filtrados = doPeriodo.filter((e) => {
    if (situacao && situacaoDoEvento(presencas[e.id]) !== situacao) return false
    if (origem && origemETitulo(e).origem !== origem) return false
    if (!termo) return true
    return normalizeAgendaText([e.summary, e.location, e.description].filter(Boolean).join(' ')).includes(termo)
  })

  const totalPorDia = new Map<number, number>()
  for (const e of filtrados) {
    const dia = diaDoEvento(e)
    if (dia != null) totalPorDia.set(dia, (totalPorDia.get(dia) ?? 0) + 1)
  }
  const visiveis = filtrados.slice(0, limite)

  const contagemSituacao: TseItemLista<AgendaSituacao>[] = AGENDA_SITUACOES.map((s) => ({
    id: s.id,
    label: s.label,
    cor: s.cor,
    valor: doPeriodo.filter((e) => situacaoDoEvento(presencas[e.id]) === s.id).length,
  }))
  const qtdSituacao = (id: AgendaSituacao): number => contagemSituacao.find((s) => s.id === id)?.valor ?? 0

  const porOrigem = new Map<string, number>()
  for (const e of doPeriodo) {
    const o = origemETitulo(e).origem
    porOrigem.set(o, (porOrigem.get(o) ?? 0) + 1)
  }
  const origens: TseItemLista<string>[] = [...porOrigem.entries()]
    .sort((a, b) => (a[0] === SEM_ORIGEM ? 1 : b[0] === SEM_ORIGEM ? -1 : b[1] - a[1]))
    .map(([id, valor], i) => ({ id, label: id, valor, cor: corDaOrigem(i) }))

  const porDia = new Map<number, number>()
  for (const e of ordenados) {
    const dia = diaDoEvento(e)
    if (dia != null) porDia.set(dia, (porDia.get(dia) ?? 0) + 1)
  }
  const proximosDias: TseItemLista<string>[] = [...porDia.entries()].slice(0, DIAS_NA_LISTA).map(([dia, valor]) => ({
    id: chaveDia(dia),
    label: rotuloDia(dia, agora),
    valor,
    cor: noPeriodo(dia, 'hoje', agora) ? 'var(--tse-yellow)' : 'var(--tse-green)',
  }))

  const iniciados = doPeriodo.filter((e) => eventoJaComecou(e, agora))
  const atendidosIniciados = iniciados.filter((e) => presencas[e.id]?.attended === true).length
  const pctAtendidos = iniciados.length ? (atendidosIniciados / iniciados.length) * 100 : 0
  const noCampo = doPeriodo.filter((e) => linksCampo[e.id]).length
  const hoje = ordenados.filter((e) => {
    const dia = diaDoEvento(e)
    return dia != null && noPeriodo(dia, 'hoje', agora)
  }).length
  const diasComAgenda = new Set(doPeriodo.map(diaDoEvento)).size

  const escopo = diaSelecionado
    ? formatAgendaDatePt(new Date(diaDaChave(diaSelecionado)))
    : (AGENDA_PERIODOS.find((p) => p.id === periodo)?.label ?? '')
  const temFiltros = Boolean(situacao || origem || termo)
  const algumAguardando = eventos.some((e) => presencas[e.id]?.arrival_time && presencas[e.id]?.attended == null)
  const iminente = agenda.proximoAlertaId ? eventos.find((e) => e.id === agenda.proximoAlertaId) : undefined
  const todosAbertos = visiveis.length > 0 && visiveis.every((e) => abertos.has(e.id))

  const escolherDia = (chave: string | null) => {
    setDiaSelecionado(chave)
    if (chave) setPeriodo('todos')
  }

  const alternar = (id: string) =>
    setAbertos((prev) => {
      const prox = new Set(prev)
      if (prox.has(id)) prox.delete(id)
      else prox.add(id)
      return prox
    })

  const limparFiltros = () => {
    setSituacao(null)
    setOrigem(null)
    setBusca('')
  }

  const tabela = (
    <AgendaEventosTabela
      eventos={visiveis}
      totalPorDia={totalPorDia}
      abertos={abertos}
      onAlternar={alternar}
      agenda={agenda}
    />
  )

  const conteudo = !configCarregada ? (
    <TseCarregando texto="Carregando configuração…" />
  ) : !config ? (
    <TseVazio>
      <p>Nenhum Google Calendar configurado.</p>
      <button
        type="button"
        onClick={() => setMostrarConfig(true)}
        className={cn(tseBotaoPrimarioClass, 'mx-auto mt-3')}
      >
        <Settings className="h-4 w-4" />
        Configurar Google Calendar
      </button>
    </TseVazio>
  ) : carregando && eventos.length === 0 ? (
    <TseCarregando texto="Carregando compromissos…" />
  ) : (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[270px_1fr]">
      <aside className="space-y-4">
        <section className={tseCardClass}>
          <h2 className="text-xl font-bold">Dados Gerais</h2>
          <p className="mt-2 text-[10px] font-semibold text-[var(--tse-muted)]">Google Calendar · {escopo}</p>
          <TseDados>
            <TseDado rotulo="Compromissos" valor={fmt(doPeriodo.length)} />
            <TseDado rotulo="Hoje" valor={fmt(hoje)} />
            <TseDado rotulo="Registrados em Campo" valor={fmt(noCampo)} sufixo={`/ ${fmt(doPeriodo.length)}`} />
          </TseDados>
          <TseBarraRotulo pct={pctAtendidos} rotulo={fmtPct(pctAtendidos)} />
          <p className="mt-1 text-[11px] text-[var(--tse-muted)]">
            {iniciados.length
              ? `Atendidos entre os ${plural(iniciados.length, 'compromisso iniciado', 'compromissos iniciados')}`
              : 'Nenhum compromisso iniciado no período'}
          </p>
        </section>

        <TseListaFiltro titulo="Situação" itens={contagemSituacao} ativo={situacao} onChange={setSituacao} />

        {proximosDias.length > 0 ? (
          <TseListaFiltro titulo="Próximos dias" itens={proximosDias} ativo={diaSelecionado} onChange={escolherDia} />
        ) : null}

        {origens.some((o) => o.id !== SEM_ORIGEM) ? (
          <TseListaFiltro titulo="Origem" itens={origens} ativo={origem} onChange={setOrigem} />
        ) : null}
      </aside>

      <main className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={situacao ?? ''}
              onChange={(e) => setSituacao((e.target.value || null) as AgendaSituacao | null)}
              className={tseControleClass}
              aria-label="Filtrar por situação"
            >
              <option value="">Todas as situações</option>
              {AGENDA_SITUACOES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={diaSelecionado ?? ''}
              onChange={(e) => escolherDia(e.target.value || null)}
              className={tseControleClass}
              aria-label="Escolher um dia"
            />
            {diaSelecionado ? (
              <button
                type="button"
                onClick={() => escolherDia(null)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)] px-2.5 text-[13px] font-semibold"
              >
                Dia: {escopo}
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <TseBusca value={busca} onChange={setBusca} placeholder="Buscar compromisso, local ou descrição" className="w-72" />
        </div>

        {iminente ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--tse-yellow-soft)] px-4 py-3 text-[13px] shadow-[inset_3px_0_0_var(--tse-yellow)]">
            <AlertCircle className="h-5 w-5 shrink-0 animate-pulse text-[var(--tse-gold-text)]" aria-hidden />
            <p>
              <strong>Compromisso em menos de 5 minutos:</strong> {origemETitulo(iminente).titulo} às{' '}
              {formatAgendaTimePt(iminente)}
            </p>
          </div>
        ) : null}

        {erro ? (
          <div className="mt-4">
            <TseErro>{erro}</TseErro>
          </div>
        ) : null}

        <section className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-white px-5 py-4 shadow-sm">
          <div className="min-w-[180px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-bold uppercase">Agenda</p>
              <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold text-white">
                {escopo}
              </span>
            </div>
            <p className="text-[15px] text-[var(--tse-muted)]">
              {plural(doPeriodo.length, 'compromisso', 'compromissos')} · {plural(diasComAgenda, 'dia', 'dias')}
            </p>
          </div>
          {(['aguardando', 'atendido', 'sem-marcacao'] as const).map((id) => (
            <div key={id} className="text-right">
              <p className="text-3xl font-black">{fmt(qtdSituacao(id))}</p>
              <p className="text-[13px] lowercase text-[var(--tse-muted)]">
                {AGENDA_SITUACOES.find((s) => s.id === id)?.label}
              </p>
            </div>
          ))}
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-[var(--tse-muted)]">
            {plural(filtrados.length, 'compromisso', 'compromissos')}
            {temFiltros ? ' com os filtros aplicados' : ''} · em ordem cronológica
          </p>
          <div className="flex items-center gap-4">
            {temFiltros ? (
              <button type="button" onClick={limparFiltros} className={tseLinkAcaoClass}>
                Limpar filtros
              </button>
            ) : null}
            {visiveis.length > 0 ? (
              <button
                type="button"
                onClick={() => setAbertos(todosAbertos ? new Set() : new Set(visiveis.map((e) => e.id)))}
                className={tseLinkAcaoClass}
              >
                {todosAbertos ? 'Recolher todos' : 'Expandir todos'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3">
          {filtrados.length === 0 ? (
            <TseVazio>
              {doPeriodo.length === 0
                ? 'Nenhum compromisso no período selecionado.'
                : 'Nenhum compromisso encontrado para os filtros selecionados.'}
            </TseVazio>
          ) : (
            tabela
          )}
        </div>
        <TseCarregarMais restantes={filtrados.length - limite} onClick={() => setLimite((n) => n + PAGE_SIZE)} />
      </main>
    </div>
  )

  return (
    <TsePage className={cn(algumAguardando && 'lg:pr-80 2xl:pr-80')}>
      <ArrivalNotificationsPanel events={eventos} attendanceStatuses={presencas} />

      <TseFilterBar>
        <TseSelectGrande
          icone={CalendarDays}
          rotulo="Período"
          value={diaSelecionado ? VALOR_DIA : periodo}
          onChange={(e) => {
            if (e.target.value === VALOR_DIA) return
            setPeriodo(e.target.value as AgendaPeriodo)
            setDiaSelecionado(null)
          }}
        >
          {AGENDA_PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          {diaSelecionado ? <option value={VALOR_DIA}>{escopo}</option> : null}
        </TseSelectGrande>
        <div className="min-w-0 text-[13px] leading-tight">
          <p className="font-bold">Google Calendar</p>
          <p className="truncate text-[var(--tse-muted)]">
            {!configCarregada ? 'Carregando…' : config ? config.calendarId : 'Não configurado'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {config ? (
            <>
              <button type="button" onClick={agenda.atualizar} disabled={atualizando || carregando} className={tseBotaoCinzaClass}>
                <RefreshCw className={cn(tseBotaoIconeClass, atualizando && 'animate-spin')} />
                Atualizar
              </button>
              <button type="button" onClick={() => setTelaCheia(true)} className={tseBotaoCinzaClass}>
                <Maximize2 className={tseBotaoIconeClass} />
                Tela cheia
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setMostrarConfig(true)}
            disabled={!configCarregada}
            className={tseBotaoCinzaClass}
          >
            <Settings className={tseBotaoIconeClass} />
            {config ? 'Reconfigurar' : 'Configurar'}
          </button>
        </div>
      </TseFilterBar>

      <div className="mt-5">{conteudo}</div>

      {telaCheia ? (
        <div style={TSE_TOKENS} className="fixed inset-0 z-50 overflow-y-auto bg-[var(--tse-bg)] text-[var(--tse-text)]">
          <ArrivalNotificationsPanel events={eventos} attendanceStatuses={presencas} zIndex={60} />
          <div className={cn('mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6', algumAguardando && 'lg:pr-80')}>
            <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-6 py-3 shadow-sm">
              <CalendarDays className="h-6 w-6 fill-[var(--tse-yellow)] text-[var(--tse-yellow)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-semibold">Agenda · {escopo}</p>
                <p className="text-[13px] text-[var(--tse-muted)]">
                  {plural(filtrados.length, 'compromisso', 'compromissos')}
                  {temFiltros ? ' com os filtros aplicados' : ''}
                </p>
              </div>
              <button type="button" onClick={() => setTelaCheia(false)} className={tseBotaoCinzaClass}>
                <X className={tseBotaoIconeClass} />
                Fechar
              </button>
            </div>
            <div className="mt-5">
              {filtrados.length === 0 ? <TseVazio>Nenhum compromisso para mostrar.</TseVazio> : tabela}
            </div>
            <TseCarregarMais restantes={filtrados.length - limite} onClick={() => setLimite((n) => n + PAGE_SIZE)} />
          </div>
        </div>
      ) : null}

      {mostrarConfig ? (
        <GoogleCalendarConfigModal
          onClose={() => setMostrarConfig(false)}
          onSave={agenda.salvarConfig}
          currentConfig={config ?? undefined}
        />
      ) : null}
    </TsePage>
  )
}
