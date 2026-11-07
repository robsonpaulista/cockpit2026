'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchSidebarNavTargets } from '@/lib/sidebar-nav-routes'

export function TopbarSystemSearch({ className }: { className?: string }) {
  const router = useRouter()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const hits = useMemo(() => searchSidebarNavTargets(q, 8), [q])

  useEffect(() => {
    setActive(0)
  }, [q])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const irPara = (href: string) => {
    setOpen(false)
    setQ('')
    router.push(href)
  }

  return (
    <div ref={rootRef} className={cn('relative hidden min-w-0 sm:block', className)}>
      <label className="sr-only" htmlFor="cockpit-topbar-search">
        Buscar no sistema
      </label>
      <div className="flex h-8 w-[min(100%,220px)] items-center gap-2 rounded-full bg-white px-3 shadow-sm lg:w-[240px]">
        <Search className="h-3.5 w-3.5 shrink-0 text-[#717171]" aria-hidden />
        <input
          id="cockpit-topbar-search"
          type="search"
          value={q}
          autoComplete="off"
          placeholder="Buscar no sistema..."
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && hits.length > 0}
          className="min-w-0 flex-1 bg-transparent text-[12px] text-[#333333] outline-none placeholder:text-[#9A9A9A]"
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)))
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
              return
            }
            if (e.key === 'Enter' && hits[active]) {
              e.preventDefault()
              irPara(hits[active].href)
            }
          }}
        />
      </div>
      {open && q.trim() && (
        <ul
          id={listId}
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-72 w-[min(100vw-2rem,280px)] overflow-auto rounded-xl border border-[#E6E6E3] bg-white py-1 shadow-lg"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-[12px] text-[#717171]">Nenhuma página encontrada</li>
          ) : (
            hits.map((hit, i) => (
              <li key={hit.href} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full flex-col items-start px-3 py-2 text-left text-[12px]',
                    i === active ? 'bg-[#FFF8D6]' : 'hover:bg-[#F4F4F2]',
                  )}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => irPara(hit.href)}
                >
                  <span className="font-semibold text-[#333333]">{hit.label}</span>
                  <span className="truncate text-[10px] text-[#717171]">{hit.href}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
