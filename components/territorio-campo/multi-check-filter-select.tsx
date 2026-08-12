'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MultiCheckFilterOption = {
  id: string
  label: string
}

type Props = {
  options: MultiCheckFilterOption[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  /** Rótulo quando nada está marcado (= todos). */
  allLabel?: string
  title?: string
  ariaLabel?: string
  className?: string
  /** Classe do botão trigger (ex.: wr-copiloto-filter-select). */
  triggerClassName?: string
  /** Classe dos botões Todos / Marcar todos. */
  actionClassName?: string
  emptyOptionsLabel?: string
}

type MenuPos = { top: number; left: number; width: number }

/**
 * Dropdown multi-seleção com checkboxes — padrão War Room Obras (status).
 * `selected` vazio = “todos”. Menu em portal (não fica atrás da tabela).
 */
export function MultiCheckFilterSelect({
  options,
  selected,
  onChange,
  allLabel = 'Todos',
  title,
  ariaLabel,
  className,
  triggerClassName,
  actionClassName,
  emptyOptionsLabel = 'Nenhuma opção',
}: Props) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const updatePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 16)
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    setMenuPos({
      top: rect.bottom + 4,
      left,
      width,
    })
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updatePosition()
    const onReposition = () => updatePosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label =
    selected.size === 0
      ? allLabel
      : selected.size === 1
        ? options.find((o) => selected.has(o.id))?.label ?? '1 selecionado'
        : `${selected.size} selecionados`

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const limpar = () => onChange(new Set())
  const marcarTodos = () => onChange(new Set(options.map((o) => o.id)))

  const checkboxClass =
    'h-3.5 w-3.5 shrink-0 rounded border-card accent-[#f2d06b] focus:ring-2 focus:ring-[color-mix(in_srgb,#f2d06b_35%,transparent)]'

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="wr-obras-status-menu fixed z-[120] rounded-xl border border-card p-2 shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
            role="listbox"
            aria-multiselectable="true"
            aria-label={ariaLabel ?? allLabel}
          >
            <div className="mb-2 flex flex-wrap gap-1.5 border-b border-card pb-2">
              <button type="button" onClick={limpar} className={actionClassName}>
                Todos
              </button>
              <button type="button" onClick={marcarTodos} className={actionClassName}>
                Marcar todos
              </button>
            </div>
            <ul className="max-h-56 space-y-0.5 overflow-y-auto">
              {options.length === 0 ? (
                <li className="px-2 py-1.5 text-xs text-text-muted">{emptyOptionsLabel}</li>
              ) : (
                options.map((opt) => {
                  const checked = selected.has(opt.id)
                  return (
                    <li key={opt.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-primary hover:bg-bg-app/80">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(opt.id)}
                          className={checkboxClass}
                        />
                        <span className="min-w-0 truncate">{opt.label}</span>
                      </label>
                    </li>
                  )
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex max-w-[16rem] items-center justify-between gap-2 text-left',
          triggerClassName,
          selected.size > 0 && 'font-medium',
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-text-secondary transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {menu}
    </div>
  )
}
