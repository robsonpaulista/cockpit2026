'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { IptKpiStrip } from '@/components/ipt/ipt-kpi-strip'
import { IptMapToolbar } from '@/components/ipt/ipt-map-toolbar'
import { useIpt } from '@/hooks/use-ipt'
import { IPT_INDICADOR_OPCOES, buildContagemIptPorIndicador, type IptIndicador, type IptPrioridade } from '@/lib/ipt'
import { filtrarIptMunicipiosPorTd, buildContagemIptPorTd, IPT_TD_LABEL_CURTO } from '@/lib/ipt-td'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { chromeButtonClass } from '@/lib/button-chrome'
import { cn } from '@/lib/utils'
import {
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
} from '@/components/dashboard/dashboard-page-chrome'

const IPT_PAGE_TITLE = 'Mapa de Diagnóstico da Campanha'
const IPT_PAGE_DESCRIPTION =
  'Gestão à vista: diagnóstico territorial por município — chips no mapa, popup completo no clique.'

const IptMapSection = dynamic(
  () => import('@/components/ipt/ipt-map-section').then((mod) => mod.IptMapSection),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[420px] items-center justify-center bg-bg-app text-sm text-text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Carregando mapa…
      </div>
    ),
  }
)

export function IptPanel() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false)
  const [filtroPrioridade, setFiltroPrioridade] = useState<IptPrioridade | null>(null)
  const [filtroIndicador, setFiltroIndicador] = useState<IptIndicador | 'geral'>('geral')
  const [filtroTd, setFiltroTd] = useState<TerritorioDesenvolvimentoPI | null>(null)
  const { loading, error, municipios, resumo, recarregar } = useIpt()

  const municipiosNoEscopo = useMemo(
    () => filtrarIptMunicipiosPorTd(municipios, filtroTd),
    [municipios, filtroTd]
  )

  const contagemPorPrioridade = useMemo(() => {
    const map: Record<IptPrioridade, number> = {
      critico: 0,
      atencao: 0,
      estavel: 0,
      forte: 0,
      sem_expectativa: 0,
    }
    for (const m of municipiosNoEscopo) map[m.prioridade] += 1
    return map
  }, [municipiosNoEscopo])

  const municipiosFiltrados = useMemo(() => {
    if (!filtroPrioridade) return municipiosNoEscopo
    return municipiosNoEscopo.filter((m) => m.prioridade === filtroPrioridade)
  }, [municipiosNoEscopo, filtroPrioridade])

  const indicadorAtivo = filtroIndicador === 'geral' ? null : filtroIndicador

  /** Com lente de indicador: todos com expectativa, independente da prioridade. */
  const municipiosNoMapa = useMemo(() => {
    if (indicadorAtivo) {
      return municipiosNoEscopo.filter((m) => m.prioridade !== 'sem_expectativa')
    }
    return municipiosFiltrados
  }, [municipiosNoEscopo, municipiosFiltrados, indicadorAtivo])

  const contagemPorIndicador = useMemo(() => buildContagemIptPorIndicador(municipiosNoEscopo), [municipiosNoEscopo])

  const contagemPorTd = useMemo(() => buildContagemIptPorTd(municipios), [municipios])

  const legendaIndicadorAtiva = IPT_INDICADOR_OPCOES.find((o) => o.id === filtroIndicador)?.label ?? ''
  const rotuloTdAtivo = filtroTd ? IPT_TD_LABEL_CURTO[filtroTd] : null

  const toggleFiltroPrioridade = useCallback((prioridade: IptPrioridade) => {
    setFiltroPrioridade((atual) => (atual === prioridade ? null : prioridade))
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const container = mapContainerRef.current
    if (!container) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void container.requestFullscreen()
    }
  }, [])

  const headerAction = (
    <button type="button" onClick={() => void recarregar()} className={chromeButtonClass} disabled={loading}>
      <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
      Atualizar
    </button>
  )

  return (
    <>
      <DashboardPageChrome>
        <DashboardPageHeader
          title={IPT_PAGE_TITLE}
          description={IPT_PAGE_DESCRIPTION}
          action={headerAction}
        />
      </DashboardPageChrome>

      <DashboardPageContent>
        {!isNativeFullscreen ? <IptKpiStrip resumo={resumo} /> : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div
          ref={mapContainerRef}
          className={cn(
            'mt-4 overflow-hidden rounded-xl border border-card bg-bg-surface',
            '[&:fullscreen]:mt-0 [&:fullscreen]:flex [&:fullscreen]:h-screen [&:fullscreen]:w-full [&:fullscreen]:flex-col [&:fullscreen]:min-h-0 [&:fullscreen]:rounded-none [&:fullscreen]:border-none [&:fullscreen]:bg-bg-surface'
          )}
        >
          {isNativeFullscreen ? (
            <DashboardPageHeader
              title={IPT_PAGE_TITLE}
              description={IPT_PAGE_DESCRIPTION}
              action={headerAction}
            />
          ) : null}

          <div className={cn('border-b border-card bg-bg-surface/80 px-3 py-2.5 sm:px-4', isNativeFullscreen && 'shrink-0')}>
            <IptMapToolbar
              loading={loading}
              filtroPrioridade={filtroPrioridade}
              filtroIndicador={filtroIndicador}
              filtroTd={filtroTd}
              contagemPorPrioridade={contagemPorPrioridade}
              totalMunicipios={municipiosNoEscopo.length}
              totalMunicipiosPi={municipios.length}
              contagemPorIndicador={contagemPorIndicador}
              contagemPorTd={contagemPorTd}
              indicadorAtivo={indicadorAtivo}
              isNativeFullscreen={isNativeFullscreen}
              onTogglePrioridade={toggleFiltroPrioridade}
              onClearPrioridade={() => setFiltroPrioridade(null)}
              onIndicadorChange={(valor) => {
                setFiltroIndicador(valor)
                if (valor !== 'geral') setFiltroPrioridade(null)
              }}
              onTdChange={setFiltroTd}
              onToggleFullscreen={toggleFullscreen}
              showHint={!isNativeFullscreen}
              hint={
                indicadorAtivo
                  ? `${legendaIndicadorAtiva}${rotuloTdAtivo ? ` · TD ${rotuloTdAtivo}` : ''} · ${contagemPorIndicador[indicadorAtivo]} com dado · ${municipiosNoMapa.length} no mapa · verde bem · amarelo neutro · vermelho mal · cinza sem dado`
                  : filtroPrioridade
                    ? `${municipiosFiltrados.length} município${municipiosFiltrados.length === 1 ? '' : 's'} no mapa${rotuloTdAtivo ? ` · TD ${rotuloTdAtivo}` : ''} · clique em «Todos» ou no chip ativo para limpar`
                    : rotuloTdAtivo
                      ? `TD ${rotuloTdAtivo} · ${municipiosNoEscopo.length} municípios · filtre por diagnóstico ou escolha uma lente`
                      : 'Filtre por território, diagnóstico ou lente para ler o mapa por recorte'
              }
            />
          </div>

          <div className={cn(isNativeFullscreen ? 'flex min-h-0 flex-1 flex-col' : 'h-[560px]')}>
            {loading ? (
              <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-text-muted">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Calculando prioridades…
              </div>
            ) : (
              <IptMapSection
                municipios={municipiosNoMapa}
                indicadorFiltro={indicadorAtivo}
                filtroTd={filtroTd}
                municipiosBoundsTd={municipiosNoEscopo}
                isFullscreen={isNativeFullscreen}
              />
            )}
          </div>
        </div>
      </DashboardPageContent>
    </>
  )
}
