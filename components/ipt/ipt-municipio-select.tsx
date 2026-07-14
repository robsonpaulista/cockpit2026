'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { cn } from '@/lib/utils'

const IPT_MUNI_SELECT_Z_INDEX = 6500

type MunicipioPi = { nome: string }

const MUNICIPIOS_PI = (municipiosPiaui as MunicipioPi[])
  .map((m) => m.nome)
  .sort((a, b) => a.localeCompare(b, 'pt-BR'))

type Props = {
  value: string | null
  disabled?: boolean
  /** Quando true, restringe a lista aos municípios do escopo atual (ex.: TD filtrado). */
  opcoes?: string[]
  onChange: (municipio: string | null) => void
}

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function IptMunicipioSelect({
  value,
  disabled = false,
  opcoes,
  onChange,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState<boolean>(false)
  const [query, setQuery] = useState<string>('')
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const [mounted, setMounted] = useState<boolean>(false)

  const baseList = opcoes && opcoes.length > 0 ? opcoes : MUNICIPIOS_PI
  const total = baseList.length

  const filtrados = useMemo(() => {
    const q = normalizeSearch(query)
    if (!q) return baseList
    return baseList.filter((nome) => normalizeSearch(nome).includes(q))
  }, [baseList, query])

  const triggerLabel = value ? value : `Município · ${total}`

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
      const maxHeight = Math.min(320, window.innerHeight - rect.bottom - gap - viewportPadding)
      const width = Math.max(rect.width, 240)

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
        maxHeight: Math.max(180, maxHeight),
        zIndex: IPT_MUNI_SELECT_Z_INDEX,
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
    const t = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const selectValue = (municipio: string | null) => {
    onChange(municipio)
    setOpen(false)
  }

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        className="ipt-td-select-menu ipt-muni-select-menu"
        style={menuStyle}
        role="listbox"
        aria-label="Selecionar município"
      >
        <div className="ipt-td-select-menu__shine" aria-hidden />
        <div className="ipt-muni-select-search">
          <CockpitIcon icon={Search} size="sm" className="ipt-muni-select-search__icon" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar município..."
            className="ipt-muni-select-search__input"
            aria-label="Buscar município"
          />
        </div>

        <button
          type="button"
          role="option"
          aria-selected={!value}
          onClick={() => selectValue(null)}
          className={cn('ipt-td-select-option', !value && 'ipt-td-select-option--selected')}
        >
          <span className="min-w-0 truncate">Todos os municípios · {total}</span>
          {!value ? <CockpitIcon icon={Check} className="ipt-td-select-check" strokeWidth={2} /> : null}
        </button>

        <div className="ipt-muni-select-menu__list">
          {filtrados.length === 0 ? (
            <p className="ipt-muni-select-empty">Nenhum município encontrado.</p>
          ) : (
            filtrados.map((nome) => {
              const selected = value === nome
              return (
                <button
                  key={nome}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => selectValue(nome)}
                  className={cn('ipt-td-select-option', selected && 'ipt-td-select-option--selected')}
                >
                  <span className="min-w-0 truncate">{nome}</span>
                  {selected ? (
                    <CockpitIcon icon={Check} className="ipt-td-select-check" strokeWidth={2} />
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </div>
    ) : null

  return (
    <>
      <div ref={rootRef} className="ipt-stat-select-wrap ipt-td-select">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Selecionar município"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'ipt-stat-select ipt-stat-select-trigger',
            Boolean(value) && 'ipt-stat-select-trigger--active',
            open && 'ipt-stat-select-trigger--open'
          )}
        >
          <span className="min-w-0 truncate">{triggerLabel}</span>
          <CockpitIcon
            icon={ChevronDown}
            className={cn('ipt-stat-select-chevron', open && 'rotate-180')}
          />
        </button>
      </div>

      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  )
}
