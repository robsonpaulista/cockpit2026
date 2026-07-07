'use client'

import { BarChart3, Building2, LayoutGrid, MapPin, Maximize2, Minimize2 } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import { IPT_INDICADOR_OPCOES, type IptIndicador } from '@/lib/ipt'
import { cn } from '@/lib/utils'

const INDICADOR_ICONE: Record<IptIndicador | 'geral', typeof LayoutGrid> = {
  geral: LayoutGrid,
  visitas: MapPin,
  obras: Building2,
  pesquisa: BarChart3,
}

const INDICADOR_LABEL_CURTO: Record<IptIndicador | 'geral', string> = {
  geral: 'Geral',
  visitas: 'Campo',
  obras: 'Obras',
  pesquisa: 'Pesquisa',
}

type IptMapCardHeaderProps = {
  loading: boolean
  filtroIndicador: IptIndicador | 'geral'
  isNativeFullscreen: boolean
  mapEmpty: boolean
  onIndicadorChange: (valor: IptIndicador | 'geral') => void
  onToggleFullscreen: () => void
}

export function IptMapCardHeader({
  loading,
  filtroIndicador,
  isNativeFullscreen,
  mapEmpty,
  onIndicadorChange,
  onToggleFullscreen,
}: IptMapCardHeaderProps) {
  return (
    <div className="ipt-map-card__header">
      <div className="min-w-0">
        <h2 className="ipt-map-card__title">Mapa territorial</h2>
        <p className="ipt-map-card__subtitle">Cores = diagnóstico geral · clique no município para detalhes</p>
      </div>

      <div className="ipt-lens-toggle" role="radiogroup" aria-label="Lente do mapa">
        {IPT_INDICADOR_OPCOES.map((opcao) => {
          const ativo = filtroIndicador === opcao.id
          return (
            <button
              key={opcao.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              disabled={loading}
              onClick={() => onIndicadorChange(opcao.id)}
              className={cn('ipt-lens-toggle__btn cockpit-sidebar-item', ativo && 'ipt-lens-toggle__btn--active')}
              title={opcao.label}
            >
              <CockpitIcon icon={INDICADOR_ICONE[opcao.id]} size="sm" />
              <span>{INDICADOR_LABEL_CURTO[opcao.id]}</span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onToggleFullscreen}
        className="ipt-map-card__fullscreen"
        title={isNativeFullscreen ? 'Sair da tela cheia' : 'Expandir mapa'}
        disabled={loading || mapEmpty}
      >
        <CockpitIcon icon={isNativeFullscreen ? Minimize2 : Maximize2} />
      </button>
    </div>
  )
}
