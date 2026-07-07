'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import {
  DashboardPageChrome,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { IptMapCardHeader } from '@/components/ipt/ipt-map-card-header'
import { IptPageFilters } from '@/components/ipt/ipt-page-filters'
import { IptPageHeader } from '@/components/ipt/ipt-page-header'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import { useIpt } from '@/hooks/use-ipt'
import { type IptIndicador, type IptPrioridade } from '@/lib/ipt'
import { filtrarIptMunicipiosPorTd } from '@/lib/ipt-td'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { cn } from '@/lib/utils'
import '@/app/dashboard/territorio/ipt/ipt-visual-refine.css'

const IPT_PAGE_TITLE = 'Mapa de diagnóstico da campanha'
const IPT_PAGE_DESCRIPTION =
  'Gestão à vista: diagnóstico territorial por município — chips no mapa, popup completo no clique.'

const IptMapSection = dynamic(
  () => import('@/components/ipt/ipt-map-section').then((mod) => mod.IptMapSection),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-text-muted">
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
  const topbarVisible = useDashboardTopbarVisible()
  const { loading, error, municipios, recarregar } = useIpt()

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
  const municipiosNoMapa = municipiosFiltrados

  const toggleFiltroPrioridade = useCallback((prioridade: IptPrioridade) => {
    setFiltroPrioridade((atual) => (atual === prioridade ? null : prioridade))
  }, [])

  useEffect(() => {
    document.body.dataset.iptRefine = 'true'
    return () => {
      delete document.body.dataset.iptRefine
    }
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
    <button
      type="button"
      onClick={() => void recarregar()}
      className="ipt-btn-atualizar"
      disabled={loading}
    >
      <CockpitIcon icon={RefreshCw} size="sm" className={loading ? 'animate-spin' : undefined} />
      Atualizar
    </button>
  )

  return (
    <DashboardPageShell className="ipt-page-shell">
      {!isNativeFullscreen ? (
        <DashboardPageChrome>
          <IptPageHeader
            compact={topbarVisible}
            title={IPT_PAGE_TITLE}
            description={IPT_PAGE_DESCRIPTION}
            action={headerAction}
          />
        </DashboardPageChrome>
      ) : null}

      <div className="ipt-page-body flex min-h-0 flex-1 flex-col">
        {error ? (
          <div className="ipt-page-alert rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {!isNativeFullscreen ? (
          <IptPageFilters
            loading={loading}
            filtroPrioridade={filtroPrioridade}
            filtroTd={filtroTd}
            contagemPorPrioridade={contagemPorPrioridade}
            totalMunicipios={municipiosNoEscopo.length}
            totalMunicipiosPi={municipios.length}
            onTogglePrioridade={toggleFiltroPrioridade}
            onTdChange={setFiltroTd}
          />
        ) : null}

        <div
          ref={mapContainerRef}
          className={cn(
            'ipt-map-card flex min-h-0 flex-1 flex-col',
            isNativeFullscreen && 'ipt-map-card--fullscreen',
          )}
        >
          <IptMapCardHeader
            loading={loading}
            filtroIndicador={filtroIndicador}
            isNativeFullscreen={isNativeFullscreen}
            mapEmpty={municipiosNoMapa.length === 0}
            onIndicadorChange={setFiltroIndicador}
            onToggleFullscreen={toggleFullscreen}
          />

          <div className="ipt-map-card__body flex min-h-0 flex-1 flex-col">
            {loading ? (
              <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-text-muted">
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
                onInsightSaved={recarregar}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardPageShell>
  )
}
