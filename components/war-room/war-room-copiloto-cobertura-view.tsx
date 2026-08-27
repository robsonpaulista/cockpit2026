'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2, MapPin, Target, Eye, Navigation, Maximize2, Minimize2 } from 'lucide-react'
import type { PrioridadeCampoMapaRow } from '@/components/mapa-presenca'
import type { IptMunicipio } from '@/lib/ipt'
import { IPT_VISITAS_JANELA_DIAS } from '@/lib/ipt'
import { cn } from '@/lib/utils'

const MapaPresenca = dynamic(
  () => import('@/components/mapa-presenca').then((mod) => mod.MapaPresenca),
  {
    ssr: false,
    loading: () => (
      <div className="wr-cobertura__map-loading">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando mapa…
      </div>
    ),
  },
)

const MAP_CONTAINER_ID = 'wr-cobertura-fs-root'

type ListaFiltro = 'todas' | 'visitadas' | 'sem-visita'

type Props = {
  municipios: IptMunicipio[]
  loading?: boolean
}

function formatNum(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * Copiloto · Cobertura — mapa de visitas (últimos 30 dias) × meta de votos.
 */
export function WarRoomCopilotoCoberturaView({ municipios, loading = false }: Props) {
  const [listaFiltro, setListaFiltro] = useState<ListaFiltro>('sem-visita')
  const [busca, setBusca] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onFs = () => {
      const fs = document.fullscreenElement
      setIsFullscreen(!!(fs && fs.id === MAP_CONTAINER_ID))
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const handleFullscreen = useCallback(() => {
    const container = document.getElementById(MAP_CONTAINER_ID)
    if (!container) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void container.requestFullscreen()
    }
  }, [])

  const base = useMemo(() => {
    return municipios.filter((m) => m.expectativaVotos > 0 || m.detalhes.visitasNoPeriodo > 0)
  }, [municipios])

  const prioridadeCampoLista = useMemo<PrioridadeCampoMapaRow[]>(() => {
    return base.map((m) => {
      const visitas = m.detalhes.visitasNoPeriodo
      return {
        cidade: m.municipio,
        expectativaVotos: m.expectativaVotos,
        visitas,
        agendas: 0,
        motivo:
          visitas > 0
            ? `${visitas} visita${visitas === 1 ? '' : 's'} nos últimos ${IPT_VISITAS_JANELA_DIAS} dias`
            : `Sem visita nos últimos ${IPT_VISITAS_JANELA_DIAS} dias`,
        ultimaVisita: m.ultimaVisita ?? null,
        semExpectativa: m.expectativaVotos <= 0,
      }
    })
  }, [base])

  const cidadesVisitadas = useMemo(
    () => base.filter((m) => m.detalhes.visitasNoPeriodo > 0).map((m) => m.municipio),
    [base],
  )

  const cidadesComPresenca = useMemo(
    () => base.filter((m) => m.expectativaVotos > 0).map((m) => m.municipio),
    [base],
  )

  const expectativaPorCidadeLista = useMemo(
    () =>
      base
        .filter((m) => m.expectativaVotos > 0)
        .map((m) => ({ cidade: m.municipio, expectativaVotos: m.expectativaVotos })),
    [base],
  )

  const kpis = useMemo(() => {
    const comExpectativa = base.filter((m) => m.expectativaVotos > 0)
    const visitadas = comExpectativa.filter((m) => m.detalhes.visitasNoPeriodo > 0)
    const semVisita = comExpectativa.filter((m) => m.detalhes.visitasNoPeriodo <= 0)
    const totalVisitas = base.reduce((acc, m) => acc + m.detalhes.visitasNoPeriodo, 0)
    const expTotal = comExpectativa.reduce((acc, m) => acc + m.expectativaVotos, 0)
    const expVisitada = visitadas.reduce((acc, m) => acc + m.expectativaVotos, 0)
    const pctExp =
      expTotal > 0 ? Math.round((expVisitada / expTotal) * 1000) / 10 : 0
    return {
      visitadas: visitadas.length,
      semVisita: semVisita.length,
      totalCidades: comExpectativa.length,
      totalVisitas,
      expVisitada,
      expSemVisita: expTotal - expVisitada,
      pctExp,
    }
  }, [base])

  const lista = useMemo(() => {
    const termo = busca
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

    let rows = [...base]
    if (listaFiltro === 'visitadas') {
      rows = rows.filter((m) => m.detalhes.visitasNoPeriodo > 0)
    } else if (listaFiltro === 'sem-visita') {
      rows = rows.filter((m) => m.expectativaVotos > 0 && m.detalhes.visitasNoPeriodo <= 0)
    }

    if (termo) {
      rows = rows.filter((m) =>
        m.municipio
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes(termo),
      )
    }

    return rows.sort((a, b) => {
      if (listaFiltro === 'visitadas') {
        const byVisitas = b.detalhes.visitasNoPeriodo - a.detalhes.visitasNoPeriodo
        if (byVisitas !== 0) return byVisitas
      }
      return b.expectativaVotos - a.expectativaVotos || a.municipio.localeCompare(b.municipio, 'pt-BR')
    })
  }, [base, listaFiltro, busca])

  if (loading && municipios.length === 0) {
    return (
      <div className="wr-copiloto-view__state">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--wr-accent,#F04B23)]" strokeWidth={1.5} />
        <span>Carregando cobertura de visitas…</span>
      </div>
    )
  }

  return (
    <section
      id={MAP_CONTAINER_ID}
      className={cn('wr-cobertura', isFullscreen && 'wr-cobertura--fs')}
      aria-label="Cobertura de visitas"
    >
      <header className="wr-cobertura__head">
        <div>
          <h2 className="wr-cobertura__title">Cobertura de visitas</h2>
          <p className="wr-cobertura__sub">
            Últimos {IPT_VISITAS_JANELA_DIAS} dias · meta da Base Eleitoral · mesma relação da
            aba Cidades
          </p>
        </div>
        <button
          type="button"
          className="wr-cobertura__fs-btn"
          onClick={handleFullscreen}
          title={isFullscreen ? 'Sair da tela cheia' : 'Ver mapa em tela cheia'}
          aria-label={isFullscreen ? 'Sair da tela cheia' : 'Ver mapa em tela cheia'}
        >
          {isFullscreen ? (
            <Minimize2 size={15} strokeWidth={2.2} aria-hidden />
          ) : (
            <Maximize2 size={15} strokeWidth={2.2} aria-hidden />
          )}
          {isFullscreen ? 'Sair' : 'Tela cheia'}
        </button>
      </header>

      <div className="wr-cobertura__kpis" role="list">
        <article className="wr-cobertura__kpi" role="listitem">
          <span className="wr-cobertura__kpi-ico wr-cobertura__kpi-ico--visit">
            <Navigation size={14} strokeWidth={2.2} aria-hidden />
          </span>
          <div>
            <p className="wr-cobertura__kpi-label">Visitadas</p>
            <p className="wr-cobertura__kpi-val tabular-nums">
              {formatNum(kpis.visitadas)}
              <span> / {formatNum(kpis.totalCidades)}</span>
            </p>
          </div>
        </article>
        <article className="wr-cobertura__kpi" role="listitem">
          <span className="wr-cobertura__kpi-ico wr-cobertura__kpi-ico--gap">
            <MapPin size={14} strokeWidth={2.2} aria-hidden />
          </span>
          <div>
            <p className="wr-cobertura__kpi-label">Sem visita</p>
            <p className="wr-cobertura__kpi-val tabular-nums">{formatNum(kpis.semVisita)}</p>
          </div>
        </article>
        <article className="wr-cobertura__kpi" role="listitem">
          <span className="wr-cobertura__kpi-ico wr-cobertura__kpi-ico--count">
            <Eye size={14} strokeWidth={2.2} aria-hidden />
          </span>
          <div>
            <p className="wr-cobertura__kpi-label">Visitas no período</p>
            <p className="wr-cobertura__kpi-val tabular-nums">{formatNum(kpis.totalVisitas)}</p>
          </div>
        </article>
        <article className="wr-cobertura__kpi" role="listitem">
          <span className="wr-cobertura__kpi-ico wr-cobertura__kpi-ico--exp">
            <Target size={14} strokeWidth={2.2} aria-hidden />
          </span>
          <div>
            <p className="wr-cobertura__kpi-label">Meta coberta</p>
            <p className="wr-cobertura__kpi-val tabular-nums">
              {formatNum(kpis.pctExp)}%
              <span> · {formatNum(kpis.expVisitada)} votos</span>
            </p>
          </div>
        </article>
      </div>

      <div className="wr-cobertura__body">
        <div className="wr-cobertura__map">
          <MapaPresenca
            embedded
            hideFooterLegend={false}
            showStatsOverlay={false}
            fullscreenChrome={false}
            markerTheme="war-room"
            expectativaLabel="Meta"
            onFullscreen={handleFullscreen}
            cidadesComPresenca={cidadesComPresenca}
            cidadesVisitadas={cidadesVisitadas}
            expectativaPorCidadeLista={expectativaPorCidadeLista}
            prioridadeCampoLista={prioridadeCampoLista}
            totalCidades={Math.max(cidadesComPresenca.length, 1)}
          />
        </div>

        <aside className="wr-cobertura__side" aria-label="Lista de municípios">
          <div className="wr-cobertura__side-tools">
            <div className="wr-cobertura__filters" role="tablist" aria-label="Filtro da lista">
              {(
                [
                  { id: 'sem-visita' as const, label: 'Sem visita' },
                  { id: 'visitadas' as const, label: 'Visitadas' },
                  { id: 'todas' as const, label: 'Todas' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={listaFiltro === opt.id}
                  className={cn(
                    'wr-cobertura__filter',
                    listaFiltro === opt.id && 'wr-cobertura__filter--on',
                  )}
                  onClick={() => setListaFiltro(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cidade…"
              className="wr-cobertura__search"
              aria-label="Buscar município"
            />
          </div>

          <ul className="wr-cobertura__list">
            {lista.length === 0 ? (
              <li className="wr-cobertura__empty">Nenhuma cidade neste filtro.</li>
            ) : (
              lista.map((m) => {
                const visitas = m.detalhes.visitasNoPeriodo
                const visitada = visitas > 0
                return (
                  <li key={m.municipio} className="wr-cobertura__row">
                    <span
                      className={cn(
                        'wr-cobertura__dot',
                        visitada ? 'wr-cobertura__dot--on' : 'wr-cobertura__dot--off',
                      )}
                      aria-hidden
                    />
                    <div className="wr-cobertura__row-main">
                      <strong>{m.municipio}</strong>
                      <span>
                        {visitada
                          ? `${visitas}× · última ${formatDate(m.ultimaVisita)}`
                          : 'Ainda não visitada'}
                      </span>
                    </div>
                    <div className="wr-cobertura__row-exp">
                      <em className="tabular-nums">{formatNum(m.expectativaVotos)}</em>
                      <span>meta</span>
                    </div>
                  </li>
                )
              })
            )}
          </ul>

          <p className="wr-cobertura__foot">
            Meta sem visita: <strong className="tabular-nums">{formatNum(kpis.expSemVisita)}</strong>{' '}
            votos
          </p>
        </aside>
      </div>
    </section>
  )
}
