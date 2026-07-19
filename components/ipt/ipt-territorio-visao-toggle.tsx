'use client'

import { cn } from '@/lib/utils'

export type IptTerritorioVisao = 'lista' | 'mapa'

type Props = {
  value: IptTerritorioVisao
  onChange: (value: IptTerritorioVisao) => void
  className?: string
}

/** Seletor Prioridades | Mapa (dentro do header da seção). */
export function IptTerritorioVisaoToggle({ value, onChange, className }: Props) {
  return (
    <div
      className={cn('ipt-territorio-visao', className)}
      role="tablist"
      aria-label="Visão do território"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'lista'}
        className={cn(
          'ipt-territorio-visao__btn',
          value === 'lista' && 'ipt-territorio-visao__btn--active'
        )}
        onClick={() => onChange('lista')}
      >
        Prioridades
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'mapa'}
        className={cn(
          'ipt-territorio-visao__btn',
          value === 'mapa' && 'ipt-territorio-visao__btn--active'
        )}
        onClick={() => onChange('mapa')}
      >
        Mapa
      </button>
    </div>
  )
}
