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
import { PerfilPopulacaoPanel } from '@/components/perfil-populacao-panel'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import { useIpt } from '@/hooks/use-ipt'
import { type IptIndicador, type IptPrioridade, iptMunicipioComCoberturaIndicador } from '@/lib/ipt'
import {
  evolucaoDaLente,
  municipioPassaFiltroEvolucao,
  type IptEvolucaoFiltro,
} from '@/lib/ipt-evolucao'
import { filtrarIptMunicipiosPorTd } from '@/lib/ipt-td'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { useTheme } from '@/contexts/theme-context'
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
  const [municipioSelecionado, setMunicipioSelecionado] = useState<string | null>(null)
  const topbarVisible = useDashboardTopbarVisible()
  const { appearance } = useTheme()
  const { loading, error, conexaoInstavel, municipios, recarregar } = useIpt()

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
    // Obras: sem filtro de evolução (sem série eleitoral).
    if (filtroIndicador === 'obras') {
      return municipiosFiltrados.filter((m) => iptMunicipioComCoberturaIndicador(m, 'obras'))
    }

    // Lente específica: só municípios com dado daquele indicador.
    // Geral: mantém o universo filtrado por prioridade/TD.
    const base =
      indicadorAtivo == null
        ? municipiosFiltrados
        : municipiosFiltrados.filter((m) =>
            iptMunicipioComCoberturaIndicador(m, indicadorAtivo)
          )

    // Evolução: Todos = base da lente; Cresceu/Estável/Diminuiu filtram a classificação
    // (1 onda de pesquisa → estável).
    if (filtroEvolucao === 'todos') return base
    return base.filter((m) =>
      municipioPassaFiltroEvolucao(evolucaoDaLente(m, indicadorAtivo), filtroEvolucao)
    )
  }, [municipiosFiltrados, filtroIndicador, filtroEvolucao, indicadorAtivo])

  const baseEvolucao = useMemo(() => {
    if (filtroIndicador === 'obras') return []
    if (indicadorAtivo == null) return municipiosFiltrados
    return municipiosFiltrados.filter((m) =>
      iptMunicipioComCoberturaIndicador(m, indicadorAtivo)
    )
  }, [municipiosFiltrados, filtroIndicador, indicadorAtivo])

  const contagemEvolucao = useMemo(() => {
    const counts: Record<IptEvolucaoFiltro, number> = {
      todos: baseEvolucao.length,
      cresceu: 0,
      estavel: 0,
      diminuiu: 0,
    }
    for (const m of baseEvolucao) {
      const e = evolucaoDaLente(m, indicadorAtivo)
      if (e === 'cresceu' || e === 'estavel' || e === 'diminuiu') counts[e] += 1
    }
    return counts
  }, [baseEvolucao, indicadorAtivo])

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
            contagemEvolucao={contagemEvolucao}
            isNativeFullscreen={isNativeFullscreen}
            mapEmpty={municipiosNoMapa.length === 0}
            onIndicadorChange={handleIndicadorChange}
            onEvolucaoChange={setFiltroEvolucao}
            onToggleFullscreen={toggleFullscreen}
          />

          <div className="ipt-map-card__body flex min-h-0 flex-1 flex-row overflow-hidden">
            {loading ? (
              <div className="flex h-full min-h-[320px] flex-1 items-center justify-center text-sm text-text-muted">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Calculando prioridades…
              </div>
            ) : (
              <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                <IptMapSection
                  municipios={municipiosNoMapa}
                  indicadorFiltro={indicadorAtivo}
                  evolucaoFiltro={filtroEvolucao}
                  filtroTd={filtroTd}
                  municipiosBoundsTd={municipiosNoEscopo}
                  isFullscreen={isNativeFullscreen}
                  onInsightSaved={recarregar}
                  onMunicipioSelect={setMunicipioSelecionado}
                />
              </div>
            )}
            <PerfilPopulacaoPanel
              municipio={municipioSelecionado}
              appearance={appearance === 'dark' ? 'dark' : 'light'}
              className="ipt-perfil-populacao w-[min(360px,40vw)] shrink-0"
              onClear={() => setMunicipioSelecionado(null)}
            />
          </div>
        </div>
      </div>
    </DashboardPageShell>
  )
}
