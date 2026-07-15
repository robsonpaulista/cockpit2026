'use client'

import { MapWrapperLeaflet } from '@/components/mapa-wrapper-leaflet'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import type { IptIndicador, IptMunicipio } from '@/lib/ipt'
import type { IptEvolucaoFiltro } from '@/lib/ipt-evolucao'
import type { IptMissaoFiltro } from '@/lib/ipt-missoes'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { useTheme } from '@/contexts/theme-context'

/** Referências estáveis — evita remount do Leaflet a cada re-render (ex.: seleção IBGE). */
const IPT_CIDADES_PRESENCA_VAZIAS: string[] = []
const IPT_MUNICIPIOS_BOUNDS_VAZIOS: IptMunicipio[] = []
const IPT_MUNICIPIOS_PIAUI = municipiosPiaui as Array<{ nome: string; lat: number; lng: number }>

interface IptMapSectionProps {
  municipios: IptMunicipio[]
  indicadorFiltro?: IptIndicador | null
  evolucaoFiltro?: IptEvolucaoFiltro
  filtroTd?: TerritorioDesenvolvimentoPI | null
  municipiosBoundsTd?: IptMunicipio[]
  missaoFiltro?: IptMissaoFiltro | null
  isFullscreen?: boolean
  onInsightSaved?: () => void
  onMunicipioSelect?: (municipio: string) => void
  onMunicipioToggleFiltro?: (municipio: string) => void
}

export function IptMapSection({
  municipios,
  indicadorFiltro = null,
  evolucaoFiltro = 'todos',
  filtroTd = null,
  municipiosBoundsTd = IPT_MUNICIPIOS_BOUNDS_VAZIOS,
  missaoFiltro = null,
  isFullscreen: _isFullscreen = false,
  onInsightSaved,
  onMunicipioSelect,
  onMunicipioToggleFiltro,
}: IptMapSectionProps) {
  const { appearance } = useTheme()

  return (
    <div className="h-full min-h-0 flex-1 overflow-hidden">
      <MapWrapperLeaflet
        cidadesComPresenca={IPT_CIDADES_PRESENCA_VAZIAS}
        municipiosPiaui={IPT_MUNICIPIOS_PIAUI}
        appearance={appearance === 'dark' ? 'dark' : 'light'}
        showRegionLabels={false}
        compactMarkers
        iptMunicipios={municipios}
        iptIndicadorFiltro={indicadorFiltro}
        iptEvolucaoFiltro={evolucaoFiltro}
        iptFiltroTd={filtroTd}
        iptMunicipiosBounds={municipiosBoundsTd}
        iptMissaoFiltro={missaoFiltro}
        onIptInsightSaved={onInsightSaved}
        onIptMunicipioSelect={onMunicipioSelect}
        onIptMunicipioToggleFiltro={onMunicipioToggleFiltro}
      />
    </div>
  )
}
