'use client'

import { BarChart3, Building2, LayoutGrid, MapPin, Maximize2, Minimize2, Smartphone } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import { IPT_INDICADOR_OPCOES, type IptIndicador } from '@/lib/ipt'
import {
  IPT_EVOLUCAO_FILTRO_OPCOES,
  type IptEvolucaoFiltro,
} from '@/lib/ipt-evolucao'
import { cn } from '@/lib/utils'

const INDICADOR_ICONE: Record<IptIndicador | 'geral', typeof LayoutGrid> = {
  geral: LayoutGrid,
  visitas: MapPin,
  obras: Building2,
  pesquisa: BarChart3,
  digital: Smartphone,
}

const INDICADOR_LABEL_CURTO: Record<IptIndicador | 'geral', string> = {
  geral: 'Geral',
  visitas: 'Campo',
  obras: 'Obras',
  pesquisa: 'Pesquisa',
  digital: 'Digital',
}

type IptMapCardHeaderProps = {
  loading: boolean
  filtroIndicador: IptIndicador | 'geral'
  filtroEvolucao: IptEvolucaoFiltro
  isNativeFullscreen: boolean
  mapEmpty: boolean
  onIndicadorChange: (valor: IptIndicador | 'geral') => void
  onEvolucaoChange: (valor: IptEvolucaoFiltro) => void
  onToggleFullscreen: () => void
}

export function IptMapCardHeader({
  loading,
  filtroIndicador,
  filtroEvolucao,
  isNativeFullscreen,
  mapEmpty,
  onIndicadorChange,
  onEvolucaoChange,
  onToggleFullscreen,
}: IptMapCardHeaderProps) {
  const evolucaoDisponivel = filtroIndicador !== 'obras'

  const subtitulo =
    filtroIndicador === 'digital'
      ? 'Lente digital · chips com seguidores e % no top Instagram'
      : filtroIndicador === 'pesquisa'
        ? 'Lente pesquisa · média de intenção + evolução entre ondas'
        : filtroIndicador === 'visitas'
          ? 'Lente campo · visitas 0–30d vs 31–60d'
          : 'Cores = diagnóstico geral · clique no município para detalhes'

  return (
    <div className="ipt-map-card__header">
      <div className="ipt-map-card__header-top">
        <div className="min-w-0">
          <h2 className="ipt-map-card__title">Mapa territorial</h2>
          <p className="ipt-map-card__subtitle">{subtitulo}</p>
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

      <div className="ipt-map-card__filters">
        <div className="ipt-filter-group">
          <span className="ipt-filter-group__label">Status:</span>
          <div className="ipt-lens-toggle" role="radiogroup" aria-label="Status do mapa">
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
                  className={cn(
                    'ipt-lens-toggle__btn cockpit-sidebar-item',
                    ativo && 'ipt-lens-toggle__btn--active'
                  )}
                  title={opcao.label}
                >
                  <CockpitIcon icon={INDICADOR_ICONE[opcao.id]} size="sm" />
                  <span>{INDICADOR_LABEL_CURTO[opcao.id]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {evolucaoDisponivel ? (
          <div className="ipt-filter-group">
            <span className="ipt-filter-group__label">Evolução:</span>
            <div
              className="ipt-lens-toggle ipt-lens-toggle--evolucao"
              role="radiogroup"
              aria-label="Filtro de evolução"
            >
              {IPT_EVOLUCAO_FILTRO_OPCOES.map((opcao) => {
                const ativo = filtroEvolucao === opcao.id
                return (
                  <button
                    key={opcao.id}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    disabled={loading}
                    onClick={() => onEvolucaoChange(opcao.id)}
                    className={cn(
                      'ipt-lens-toggle__btn',
                      ativo && 'ipt-lens-toggle__btn--active',
                      opcao.id === 'cresceu' && 'ipt-evolucao-btn--up',
                      opcao.id === 'diminuiu' && 'ipt-evolucao-btn--down',
                      opcao.id === 'estavel' && 'ipt-evolucao-btn--flat'
                    )}
                    title={opcao.label}
                  >
                    <span>{opcao.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="ipt-map-card__evolucao-hint">
            Evolução não se aplica a Obras.
          </p>
        )}
      </div>
    </div>
  )
}
