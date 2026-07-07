'use client'

import type { CSSProperties } from 'react'
import { IptTdSelect } from '@/components/ipt/ipt-td-select'
import { iptPrioridadeTheme } from '@/lib/ipt-chip'
import {
  IPT_FAIXAS,
  IPT_LIMIAR_ALERTA_CRITICO,
  type IptPrioridade,
} from '@/lib/ipt'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { cn } from '@/lib/utils'

type IptPageFiltersProps = {
  loading: boolean
  filtroPrioridade: IptPrioridade | null
  filtroTd: TerritorioDesenvolvimentoPI | null
  contagemPorPrioridade: Record<IptPrioridade, number>
  totalMunicipios: number
  totalMunicipiosPi: number
  onTogglePrioridade: (prioridade: IptPrioridade) => void
  onTdChange: (td: TerritorioDesenvolvimentoPI | null) => void
}

export function IptPageFilters({
  loading,
  filtroPrioridade,
  filtroTd,
  contagemPorPrioridade,
  totalMunicipios,
  totalMunicipiosPi,
  onTogglePrioridade,
  onTdChange,
}: IptPageFiltersProps) {
  const criticoAlerta = contagemPorPrioridade.critico >= IPT_LIMIAR_ALERTA_CRITICO
  const escopoAtivo = !filtroPrioridade

  return (
    <div className="ipt-controls">
      <div className="ipt-category-row" role="group" aria-label="Filtrar por diagnóstico">
        <IptTdSelect
          variant="scope"
          value={filtroTd}
          totalMunicipios={totalMunicipios}
          totalMunicipiosPi={totalMunicipiosPi}
          disabled={loading}
          active={escopoAtivo}
          onChange={onTdChange}
        />

        {IPT_FAIXAS.map((faixa) => {
          const theme = iptPrioridadeTheme(faixa.prioridade)
          const qtd = contagemPorPrioridade[faixa.prioridade]
          const ativo = filtroPrioridade === faixa.prioridade
          const disabled = loading || qtd === 0
          const alerta =
            faixa.prioridade === 'critico' && criticoAlerta && qtd > 0

          return (
            <button
              key={faixa.prioridade}
              type="button"
              disabled={disabled}
              aria-pressed={ativo}
              onClick={() => onTogglePrioridade(faixa.prioridade)}
              className={cn(
                'ipt-category-pill',
                ativo && 'ipt-category-pill--active',
                alerta && 'ipt-category-pill--alert',
              )}
              style={
                {
                  '--ipt-cat-bg': theme.bg,
                  '--ipt-cat-text': theme.text,
                  '--ipt-cat-sub': theme.sub,
                  '--ipt-cat-border': theme.border,
                } as CSSProperties
              }
            >
              <span className="ipt-category-pill__count">{qtd}</span>
              <span className="ipt-category-pill__label">{faixa.descricao}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
