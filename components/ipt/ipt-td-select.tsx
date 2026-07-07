'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import { IPT_TD_LABEL_CURTO } from '@/lib/ipt-td'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import { cn } from '@/lib/utils'

const IPT_TD_SELECT_Z_INDEX = 6500

type IptTdSelectProps = {
  value: TerritorioDesenvolvimentoPI | null
  totalMunicipios: number
  totalMunicipiosPi: number
  disabled?: boolean
  active?: boolean
  variant?: 'scope' | 'inline'
  onChange: (td: TerritorioDesenvolvimentoPI | null) => void
}

export function IptTdSelect({
  value,
  totalMunicipios,
  totalMunicipiosPi,
  disabled = false,
  active = false,
  variant = 'inline',
  onChange,
}: IptTdSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<boolean>(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const [mounted, setMounted] = useState<boolean>(false)

  const regionLabel = value ? IPT_TD_LABEL_CURTO[value] : 'Piauí'
  const scopedCount = value ? totalMunicipios : totalMunicipiosPi
  const triggerLabel =
    variant === 'scope'
      ? `${regionLabel} · ${scopedCount} municípios`
      : value
        ? IPT_TD_LABEL_CURTO[value]
        : `Piauí · ${totalMunicipiosPi}`

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const viewportPadding = 12
      const gap = 6
      const maxHeight = Math.min(280, window.innerHeight - rect.bottom - gap - viewportPadding)
      const width = Math.max(rect.width, 220)

      let left = rect.left
      if (left + width > window.innerWidth - viewportPadding) {
        left = window.innerWidth - viewportPadding - width
      }
      left = Math.max(viewportPadding, left)

      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + gap,
        left,
        width,
        maxHeight: Math.max(160, maxHeight),
        zIndex: IPT_TD_SELECT_Z_INDEX,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const selectValue = (td: TerritorioDesenvolvimentoPI | null) => {
    onChange(td)
    setOpen(false)
  }

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        className="ipt-td-select-menu"
        style={menuStyle}
        role="listbox"
        aria-label="Território de Desenvolvimento"
      >
        <div className="ipt-td-select-menu__shine" aria-hidden />
        <button
          type="button"
          role="option"
          aria-selected={!value}
          onClick={() => selectValue(null)}
          className={cn('ipt-td-select-option', !value && 'ipt-td-select-option--selected')}
        >
          <span className="min-w-0 truncate">Piauí · {totalMunicipiosPi} municípios</span>
          {!value ? <CockpitIcon icon={Check} className="ipt-td-select-check" strokeWidth={2} /> : null}
        </button>

        {TERRITORIOS_DESENVOLVIMENTO_PI.map((td) => {
          const selected = value === td
          return (
            <button
              key={td}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => selectValue(td)}
              className={cn('ipt-td-select-option', selected && 'ipt-td-select-option--selected')}
            >
              <span className="min-w-0 truncate">{IPT_TD_LABEL_CURTO[td]}</span>
              {selected ? (
                <CockpitIcon icon={Check} className="ipt-td-select-check" strokeWidth={2} />
              ) : null}
            </button>
          )
        })}
      </div>
    ) : null

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          variant === 'scope' ? 'ipt-scope-select-wrap' : 'ipt-stat-select-wrap ipt-td-select',
        )}
      >
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Filtrar por Território de Desenvolvimento"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            variant === 'scope' ? 'ipt-scope-select' : 'ipt-stat-select ipt-stat-select-trigger',
            variant === 'scope' && active && 'ipt-scope-select--active',
            open &&
              (variant === 'scope' ? 'ipt-scope-select--open' : 'ipt-stat-select-trigger--open'),
          )}
        >
          <span className="min-w-0 truncate">{triggerLabel}</span>
          <CockpitIcon
            icon={ChevronDown}
            className={cn(
              variant === 'scope' ? 'ipt-scope-select__chevron' : 'ipt-stat-select-chevron',
              open && 'rotate-180',
            )}
          />
        </button>
      </div>

      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  )
}
