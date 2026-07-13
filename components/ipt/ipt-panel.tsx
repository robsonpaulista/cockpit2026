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
import {
  evolucaoDaLente,
  municipioPassaFiltroEvolucao,
  type IptEvolucaoFiltro,
} from '@/lib/ipt-evolucao'
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
  const [filtroEvolucao, setFiltroEvolucao] = useState<IptEvolucaoFiltro>('todos')
  const [filtroTd, setFiltroTd] = useState<TerritorioDesenvolvimentoPI | null>(null)
  const topbarVisible = useDashboardTopbarVisible()
  const { loading, error, conexaoInstavel, municipios, recarregar, presencaDigitalCobertura } =
    useIpt()

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

  const municipiosNoMapa = useMemo(() => {
    if (filtroIndicador === 'obras' || filtroEvolucao === 'todos') return municipiosFiltrados
    return municipiosFiltrados.filter((m) =>
      municipioPassaFiltroEvolucao(evolucaoDaLente(m, indicadorAtivo), filtroEvolucao)
    )
  }, [municipiosFiltrados, filtroIndicador, filtroEvolucao, indicadorAtivo])

  const handleIndicadorChange = useCallback((valor: IptIndicador | 'geral') => {
    setFiltroIndicador(valor)
    if (valor === 'obras') setFiltroEvolucao('todos')
  }, [])

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
        {conexaoInstavel && !error ? (
          <div className="ipt-page-alert flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Conexão com o Supabase instável. Tentando novamente…
          </div>
        ) : null}
        {error ? (
          <div className="ipt-page-alert rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {presencaDigitalCobertura && presencaDigitalCobertura.totalLabels > 0 ? (
          <div className="ipt-page-alert rounded-lg border border-[#C8900A]/30 bg-[#C8900A]/8 px-4 py-3 text-sm text-text-primary">
            <p className="font-medium text-[#854F0B]">
              Presença digital · Instagram → mapa PI:{' '}
              {presencaDigitalCobertura.matchedPi}/{presencaDigitalCobertura.totalLabels} cidades
              normalizadas
              {presencaDigitalCobertura.todasNormalizadasNoMapa
                ? ' (todas casaram com o mapa)'
                : ''}
            </p>
            {!presencaDigitalCobertura.todasNormalizadasNoMapa ? (
              <p className="mt-1 text-[12px] text-text-muted">
                Fora do PI / sem match ({presencaDigitalCobertura.unmatched.length}):{' '}
                {presencaDigitalCobertura.unmatched
                  .slice(0, 12)
                  .map((r) => r.labelInstagram)
                  .join(' · ')}
                {presencaDigitalCobertura.unmatched.length > 12
                  ? ` · +${presencaDigitalCobertura.unmatched.length - 12}`
                  : ''}
              </p>
            ) : null}
          </div>
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
            filtroEvolucao={filtroEvolucao}
            isNativeFullscreen={isNativeFullscreen}
            mapEmpty={municipiosNoMapa.length === 0}
            onIndicadorChange={handleIndicadorChange}
            onEvolucaoChange={setFiltroEvolucao}
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
