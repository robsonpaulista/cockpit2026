'use client'

import { MapWrapperLeaflet } from '@/components/mapa-wrapper-leaflet'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import type { IptIndicador, IptMunicipio } from '@/lib/ipt'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface IptMapSectionProps {
  municipios: IptMunicipio[]
  indicadorFiltro?: IptIndicador | null
  filtroTd?: TerritorioDesenvolvimentoPI | null
  municipiosBoundsTd?: IptMunicipio[]
  isFullscreen?: boolean
  onInsightSaved?: () => void
}

export function IptMapSection({
  municipios,
  indicadorFiltro = null,
  filtroTd = null,
  municipiosBoundsTd = [],
  isFullscreen = false,
  onInsightSaved,
}: IptMapSectionProps) {
  const { appearance } = useTheme()

  return (
    <div className={cn('overflow-hidden', isFullscreen ? 'h-full min-h-0 flex-1' : 'h-full')}>
      <MapWrapperLeaflet
        cidadesComPresenca={[]}
        municipiosPiaui={municipiosPiaui as Array<{ nome: string; lat: number; lng: number }>}
        appearance={appearance === 'dark' ? 'dark' : 'light'}
        showRegionLabels={false}
        compactMarkers
        iptMunicipios={municipios}
        iptIndicadorFiltro={indicadorFiltro}
        iptFiltroTd={filtroTd}
        iptMunicipiosBounds={municipiosBoundsTd}
        onIptInsightSaved={onInsightSaved}
      />
    </div>
  )
}
