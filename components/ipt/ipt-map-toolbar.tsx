'use client'

import type { CSSProperties } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleOff,
  Eye,
  LayoutGrid,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { iptPrioridadeTheme } from '@/lib/ipt-chip'
import { IPT_FAIXAS, IPT_INDICADOR_OPCOES, type IptIndicador, type IptPrioridade } from '@/lib/ipt'
import { IPT_TD_LABEL_CURTO } from '@/lib/ipt-td'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import { cn } from '@/lib/utils'

const PRIORIDADE_ICONE: Record<IptPrioridade, typeof CheckCircle2> = {
  forte: CheckCircle2,
  estavel: Eye,
  atencao: AlertCircle,
  critico: AlertTriangle,
  sem_expectativa: CircleOff,
}

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

type IptMapToolbarProps = {
  loading: boolean
  filtroPrioridade: IptPrioridade | null
  filtroIndicador: IptIndicador | 'geral'
  filtroTd: TerritorioDesenvolvimentoPI | null
  contagemPorPrioridade: Record<IptPrioridade, number>
  totalMunicipios: number
  totalMunicipiosPi: number
  contagemPorIndicador: Record<IptIndicador, number>
  indicadorAtivo: IptIndicador | null
  isNativeFullscreen: boolean
  onTogglePrioridade: (prioridade: IptPrioridade) => void
  onClearPrioridade: () => void
  onIndicadorChange: (valor: IptIndicador | 'geral') => void
  onTdChange: (td: TerritorioDesenvolvimentoPI | null) => void
  onToggleFullscreen: () => void
  hint: string
  showHint: boolean
  /** Contagens por TD (escopo PI completo). */
  contagemPorTd: Record<TerritorioDesenvolvimentoPI, number>
}

export function IptMapToolbar({
  loading,
  filtroPrioridade,
  filtroIndicador,
  filtroTd,
  contagemPorPrioridade,
  totalMunicipios,
  totalMunicipiosPi,
  contagemPorIndicador,
  contagemPorTd,
  indicadorAtivo,
  isNativeFullscreen,
  onTogglePrioridade,
  onClearPrioridade,
  onIndicadorChange,
  onTdChange,
  onToggleFullscreen,
  hint,
  showHint,
}: IptMapToolbarProps) {
  return (
    <div className="ipt-toolbar">
      <div className="ipt-toolbar__row">
        <div className="ipt-toolbar__group ipt-toolbar__group--td">
          <span className="ipt-toolbar__label">Território</span>
          <div
            className={cn(
              'ipt-toolbar__select-shell',
              filtroTd && 'ipt-toolbar__select-shell--active'
            )}
          >
            <Layers className="ipt-toolbar__select-ico" strokeWidth={1.75} aria-hidden />
            <select
              value={filtroTd ?? ''}
              disabled={loading}
              onChange={(e) => {
                const valor = e.target.value
                onTdChange(valor ? (valor as TerritorioDesenvolvimentoPI) : null)
              }}
              className="ipt-toolbar__select"
              aria-label="Filtrar por Território de Desenvolvimento"
            >
              <option value="">PI · {totalMunicipiosPi}</option>
              {TERRITORIOS_DESENVOLVIMENTO_PI.map((td) => (
                <option key={td} value={td} title={td}>
                  {IPT_TD_LABEL_CURTO[td]} · {contagemPorTd[td]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ipt-toolbar__divider" aria-hidden />

        <div className="ipt-toolbar__group ipt-toolbar__group--diag">
          <span className="ipt-toolbar__label">Diagnóstico</span>
          <div className="ipt-toolbar__segments" role="group" aria-label="Filtrar por diagnóstico">
            <button
              type="button"
              onClick={onClearPrioridade}
              disabled={loading || !!indicadorAtivo}
              aria-pressed={!filtroPrioridade && !indicadorAtivo}
              title={
                indicadorAtivo
                  ? 'Volte para «Geral» na lente para filtrar por diagnóstico'
                  : filtroPrioridade
                    ? `Ver todos os ${totalMunicipios} municípios`
                    : `Todos os municípios (${totalMunicipios})`
              }
              className={cn(
                'ipt-toolbar-seg',
                !filtroPrioridade && !indicadorAtivo && 'ipt-toolbar-seg--active'
              )}
            >
              <LayoutGrid className="ipt-toolbar-seg__ico" strokeWidth={1.75} aria-hidden />
              <span>Todos</span>
              <span className="ipt-toolbar-seg__count">{totalMunicipios}</span>
            </button>
            {IPT_FAIXAS.map((faixa) => {
              const ativo = !indicadorAtivo && filtroPrioridade === faixa.prioridade
              const qtd = contagemPorPrioridade[faixa.prioridade]
              const theme = iptPrioridadeTheme(faixa.prioridade)
              const disabled = loading || qtd === 0 || !!indicadorAtivo
              const Icon = PRIORIDADE_ICONE[faixa.prioridade]

              return (
                <button
                  key={faixa.prioridade}
                  type="button"
                  onClick={() => onTogglePrioridade(faixa.prioridade)}
                  disabled={disabled}
                  aria-pressed={ativo}
                  title={
                    indicadorAtivo
                      ? 'Volte para «Geral» na lente para filtrar por diagnóstico'
                      : qtd === 0
                        ? `Nenhum município — ${faixa.descricao}`
                        : ativo
                          ? `${qtd} municípios · clique para limpar`
                          : `Filtrar: ${faixa.descricao} (${qtd})`
                  }
                  className={cn(
                    'ipt-toolbar-seg ipt-toolbar-seg--diag',
                    ativo && 'ipt-toolbar-seg--active'
                  )}
                  style={
                    ativo
                      ? ({
                          '--ipt-t-bg': theme.bg,
                          '--ipt-t-text': theme.text,
                          '--ipt-t-sub': theme.sub,
                          '--ipt-t-border': theme.border,
                          '--ipt-t-dot': theme.dot,
                        } as CSSProperties)
                      : ({ '--ipt-t-dot': theme.dot } as CSSProperties)
                  }
                >
                  <Icon className="ipt-toolbar-seg__ico ipt-toolbar-seg__ico--diag" strokeWidth={1.75} aria-hidden />
                  <span>{faixa.descricao}</span>
                  <span className="ipt-toolbar-seg__count">{qtd}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="ipt-toolbar__divider" aria-hidden />

        <div className="ipt-toolbar__group ipt-toolbar__group--lente">
          <span className="ipt-toolbar__label">Lente</span>
          <div className="ipt-toolbar__segments" role="radiogroup" aria-label="Indicador no mapa">
            {IPT_INDICADOR_OPCOES.map((opcao) => {
              const ativo = filtroIndicador === opcao.id
              const Icon = INDICADOR_ICONE[opcao.id]
              const curto = INDICADOR_LABEL_CURTO[opcao.id]
              return (
                <button
                  key={opcao.id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  disabled={loading}
                  onClick={() => onIndicadorChange(opcao.id)}
                  className={cn('ipt-toolbar-seg', ativo && 'ipt-toolbar-seg--active')}
                  title={
                    opcao.id === 'geral'
                      ? opcao.label
                      : `${opcao.label} · ${contagemPorIndicador[opcao.id]} municípios com dado`
                  }
                >
                  <Icon className="ipt-toolbar-seg__ico" strokeWidth={1.75} aria-hidden />
                  <span>{curto}</span>
                  {opcao.id !== 'geral' ? (
                    <span className="ipt-toolbar-seg__count">{contagemPorIndicador[opcao.id]}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="ipt-toolbar__actions">
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="ipt-toolbar-icon-btn"
            title={isNativeFullscreen ? 'Sair da tela cheia' : 'Expandir mapa'}
            disabled={loading || totalMunicipios === 0}
          >
            {isNativeFullscreen ? (
              <Minimize2 className="h-4 w-4" aria-hidden />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {showHint ? <p className="ipt-toolbar__hint">{hint}</p> : null}
    </div>
  )
}
